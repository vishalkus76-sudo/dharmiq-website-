import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { database, initialize } from "./db.js";
import { services, PRASADI_PRICE } from "../assets/booking-message.js";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["requested", "confirmed", "cancelled"];
const payments = ["pending", "paid"];
const digest = (text) => createHash("sha256").update(text).digest("hex");
const credentialTag = () =>
  createHmac("sha256", process.env.ADMIN_PASSWORD)
    .update("dharmique-admin-session-v1")
    .digest("hex");
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function adminConfigured() {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    throw new HttpError(
      503,
      "Admin setup is incomplete. Set ADMIN_PASSWORD (at least 12 characters) in hosting settings.",
    );
  }
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    if (
      origin.host === req.headers.host &&
      ["https:", "http:"].includes(origin.protocol) &&
      (!process.env.VERCEL || origin.protocol === "https:")
    )
      return;
  } catch {}
  throw new HttpError(403, "Please open this website directly and try again.");
}
async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
    throw new HttpError(415, "JSON required.");
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) throw new HttpError(413, "Request too large.");
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > 4096)
      throw new HttpError(413, "Request too large.");
    try {
      body = JSON.parse(body);
    } catch {
      throw new HttpError(400, "Invalid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "Invalid request.");
  if (Buffer.byteLength(JSON.stringify(body)) > 4096)
    throw new HttpError(413, "Request too large.");
  return body;
}
function ipKey(req) {
  // Vercel supplies the forwarded client address. Local preview uses its socket.
  const address = process.env.VERCEL
    ? String(req.headers["x-forwarded-for"] || "unknown")
        .split(",")[0]
        .trim()
    : req.socket?.remoteAddress || "local";
  return digest(address);
}
async function rateLimit(req, purpose, limit, seconds) {
  const window = Math.floor(Date.now() / 1000 / seconds) * seconds;
  const result = await database().query(
    `INSERT INTO dharmique.rate_limits(key,window_start,count)
    VALUES($1,$2,1) ON CONFLICT(key,window_start) DO UPDATE SET count=dharmique.rate_limits.count+1 RETURNING count`,
    [purpose + ":" + ipKey(req), window],
  );
  if (result.rows[0].count > limit)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
function cookieToken(req) {
  const token = String(req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("dharmique_admin="))
    ?.slice("dharmique_admin=".length);
  return /^[a-f0-9]{64}$/.test(token || "") ? token : null;
}
function setCookie(res, token, maxAge) {
  const secure =
    process.env.VERCEL || process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";
  res.setHeader(
    "Set-Cookie",
    `dharmique_admin=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
  );
}
async function authenticate(req) {
  adminConfigured();
  const token = cookieToken(req);
  if (!token) throw new HttpError(401, "Please log in.");
  const result = await database().query(
    "SELECT token_hash FROM dharmique.sessions WHERE token_hash=$1 AND credential_tag=$2 AND expires_at>now()",
    [digest(token), credentialTag()],
  );
  if (!result.rowCount)
    throw new HttpError(401, "Session expired. Please log in again.");
  return token;
}
function bookingData(body) {
  const text = (key, max, required = false) => {
    if (body[key] === undefined && !required) return "";
    if (typeof body[key] !== "string")
      throw new HttpError(400, "Please check your details.");
    const value = body[key].trim();
    if (value.length > max || (required && !value))
      throw new HttpError(400, "Please check your details.");
    return value;
  };
  if (
    typeof body.id !== "string" ||
    !uuid.test(body.id) ||
    typeof body.serviceId !== "string" ||
    !Object.hasOwn(services, body.serviceId) ||
    typeof body.prasadi !== "boolean"
  )
    throw new HttpError(400, "Invalid booking.");
  const name = text("name", 100, true),
    phone = text("phone", 20, true),
    gotra = text("gotra", 100);
  if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(phone))
    throw new HttpError(400, "Please check your phone number.");
  return {
    id: body.id,
    serviceId: body.serviceId,
    name,
    phone,
    gotra,
    prasadi: body.prasadi,
  };
}
async function saveBooking(req, res) {
  const data = bookingData(await jsonBody(req));
  await rateLimit(req, "booking", 20, 600);
  const service = services[data.serviceId];
  const result = await database().query(
    `INSERT INTO dharmique.bookings(id,service_id,name,phone,gotra,prasadi,seva_fee,prasadi_fee)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING RETURNING id`,
    [
      data.id,
      data.serviceId,
      data.name,
      data.phone,
      data.gotra,
      data.prasadi,
      service.price,
      data.prasadi ? PRASADI_PRICE : 0,
    ],
  );
  if (!result.rowCount) {
    const existing = await database().query(
      "SELECT service_id,name,phone,gotra,prasadi FROM dharmique.bookings WHERE id=$1",
      [data.id],
    );
    const row = existing.rows[0];
    if (
      !row ||
      row.service_id !== data.serviceId ||
      row.name !== data.name ||
      row.phone !== data.phone ||
      row.gotra !== data.gotra ||
      row.prasadi !== data.prasadi
    )
      throw new HttpError(409, "Details changed. Please try again.");
  }
  // Never return customer details from this public endpoint.
  send(res, result.rowCount ? 201 : 200, { saved: true, id: data.id });
}
async function dashboard(req, res, url) {
  await authenticate(req);
  if (url.searchParams.get("view") === "session")
    return send(res, 200, { authenticated: true });
  const page = Number(url.searchParams.get("page") || 1);
  const status = url.searchParams.get("status") || "all";
  const search = (url.searchParams.get("search") || "").trim();
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    (status !== "all" && !statuses.includes(status)) ||
    search.length > 100
  )
    throw new HttpError(400, "Invalid filter.");
  const where =
    "($1='all' OR status=$1) AND ($2='' OR name ILIKE $2 OR phone ILIKE $2)";
  const values = [status, search ? `%${search}%` : ""];
  const [stats, visits, count, bookings] = await Promise.all([
    database()
      .query(`SELECT count(*)::int AS requests, count(*) FILTER(WHERE status='requested')::int AS pending,
      count(*) FILTER(WHERE status='confirmed')::int AS confirmed, count(*) FILTER(WHERE status='cancelled')::int AS cancelled,
      count(*) FILTER(WHERE payment_status='paid')::int AS paid FROM dharmique.bookings`),
    database().query(
      `SELECT count(*)::int AS total_visits, count(*) FILTER(WHERE day=(now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS today_visits FROM dharmique.visits`,
    ),
    database().query(
      `SELECT count(*)::int AS count FROM dharmique.bookings WHERE ${where}`,
      values,
    ),
    database().query(
      `SELECT * FROM dharmique.bookings WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $3`,
      [...values, (page - 1) * 25],
    ),
  ]);
  send(res, 200, {
    stats: { ...stats.rows[0], ...visits.rows[0] },
    bookings: bookings.rows,
    total: count.rows[0].count,
    page,
    pageSize: 25,
  });
}
async function adminPost(req, res, url) {
  const action = url.searchParams.get("action");
  if (action === "login") {
    adminConfigured();
    await rateLimit(req, "login", 8, 900);
    const { password } = await jsonBody(req);
    if (
      typeof password !== "string" ||
      !timingSafeEqual(
        Buffer.from(digest(password)),
        Buffer.from(digest(process.env.ADMIN_PASSWORD)),
      )
    )
      throw new HttpError(401, "Password is incorrect.");
    const token = randomBytes(32).toString("hex");
    await database().query(
      "DELETE FROM dharmique.sessions WHERE expires_at<=now()",
    );
    await database().query(
      "DELETE FROM dharmique.rate_limits WHERE window_start<$1",
      [Math.floor(Date.now() / 1000) - 86400],
    );
    await database().query(
      "INSERT INTO dharmique.sessions(token_hash,credential_tag,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [digest(token), credentialTag()],
    );
    setCookie(res, token, 43200);
    return send(res, 200, { authenticated: true });
  }
  const token = await authenticate(req);
  if (action === "logout") {
    await database().query(
      "DELETE FROM dharmique.sessions WHERE token_hash=$1",
      [digest(token)],
    );
    setCookie(res, "", 0);
    return send(res, 200, { loggedOut: true });
  }
  if (action === "update") {
    const { id, status, paymentStatus, version } = await jsonBody(req);
    if (
      typeof id !== "string" ||
      !uuid.test(id) ||
      !statuses.includes(status) ||
      !payments.includes(paymentStatus) ||
      !Number.isInteger(version) ||
      version < 1
    )
      throw new HttpError(400, "Invalid status.");
    const result = await database().query(
      "UPDATE dharmique.bookings SET status=$1,payment_status=$2,version=version+1,updated_at=now() WHERE id=$3 AND version=$4 RETURNING id",
      [status, paymentStatus, id, version],
    );
    if (!result.rowCount)
      throw new HttpError(
        409,
        "This request changed. Refresh the list and try again.",
      );
    return send(res, 200, { updated: true });
  }
  throw new HttpError(404, "Not found.");
}
export async function api(req, res, route) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!["visit", "bookings", "admin"].includes(route))
      throw new HttpError(404, "Not found.");
    const allowed = route === "admin" ? ["GET", "POST"] : ["POST"];
    if (!allowed.includes(req.method)) {
      res.setHeader("Allow", allowed.join(", "));
      throw new HttpError(405, "Method not allowed.");
    }
    if (req.method === "POST") sameOrigin(req);
    await initialize();
    const url = new URL(req.url, "http://localhost");
    if (route === "admin")
      return req.method === "GET"
        ? await dashboard(req, res, url)
        : await adminPost(req, res, url);
    if (route === "bookings") return await saveBooking(req, res);
    const { sessionId } = await jsonBody(req);
    if (typeof sessionId !== "string" || !uuid.test(sessionId))
      throw new HttpError(400, "Invalid visit.");
    await rateLimit(req, "visit", 120, 60);
    await database().query(
      "INSERT INTO dharmique.visits(session_id) VALUES($1) ON CONFLICT DO NOTHING",
      [sessionId],
    );
    send(res, 200, { counted: true });
  } catch (error) {
    const status = error.status || 503;
    // Do not expose SQL, connection strings or customer data in logs/responses.
    send(res, status, {
      error: error.status
        ? error.message
        : "Service is unavailable. Please try again shortly.",
    });
  }
}
