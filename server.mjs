import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  statSync,
  createReadStream,
} from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, ".data"));
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const passwordFile = resolve(dataDir, "admin-password");
if (!process.env.ADMIN_PASSWORD && !existsSync(passwordFile))
  writeFileSync(passwordFile, randomBytes(24).toString("base64url"), {
    mode: 0o600,
  });
const password =
  process.env.ADMIN_PASSWORD || readFileSync(passwordFile, "utf8").trim();
if (password.length < 16)
  throw new Error("ADMIN_PASSWORD must have at least 16 characters");
const db = new DatabaseSync(resolve(dataDir, "bookings.sqlite"));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, gotra TEXT NOT NULL,
 service_id TEXT NOT NULL, service_name TEXT NOT NULL, date TEXT NOT NULL, occasion TEXT NOT NULL, notes TEXT NOT NULL,
 amount INTEGER, status TEXT NOT NULL DEFAULT 'requested', payment TEXT NOT NULL DEFAULT 'unpaid',
 order_id TEXT UNIQUE, payment_id TEXT UNIQUE, created_at TEXT NOT NULL);
`);
if (!db.prepare("SELECT id FROM settings WHERE id=1").get())
  db.prepare("INSERT INTO settings VALUES (1,?)").run(
    readFileSync(resolve(root, "assets/catalog.json"), "utf8"),
  );
// An interrupted order creation never exposed checkout credentials to the customer.
db.prepare(
  "UPDATE bookings SET order_id=NULL WHERE order_id='creating' OR order_id LIKE 'creating:%'",
).run();
const catalog = () =>
  JSON.parse(db.prepare("SELECT value FROM settings WHERE id=1").get().value);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const equal = (a, b) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const sessions = new Map();
const limits = new Map();
const states = ["requested", "confirmed", "completed", "cancelled"];
const paymentReady = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const publicBooking = (b) => ({
  id: b.id,
  name: b.name,
  service: b.service_name,
  serviceId: b.service_id,
  date: b.date,
  occasion: b.occasion,
  amount: b.amount,
  status: b.status,
  payment: b.payment,
  paymentId: b.payment_id,
  createdAt: b.created_at,
});
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
function textField(value, max = 200, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(400, "Please check the form fields. / कृपया जानकारी जाँचें।");
  return value.trim();
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value;
}
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
async function body(req, raw = false) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100000) fail(413, "Request too large");
    chunks.push(chunk);
  }
  const value = Buffer.concat(chunks).toString("utf8");
  if (raw) return value;
  try {
    const result = JSON.parse(value);
    if (!result || typeof result !== "object" || Array.isArray(result))
      fail(400, "Invalid JSON");
    return result;
  } catch {
    fail(400, "Invalid JSON");
  }
}
function rate(req, category, max) {
  const key = category + ":" + req.socket.remoteAddress;
  const now = Date.now();
  let record = limits.get(key);
  if (!record || now > record.until) {
    record = { count: 0, until: now + 15 * 60000 };
    limits.set(key, record);
  }
  if (++record.count > max)
    fail(
      429,
      "Too many attempts. Please try again later. / थोड़ी देर बाद प्रयास करें।",
    );
}
function session(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("dharmique_admin="))
    ?.slice(16);
  const expiry = sessions.get(cookie);
  if (!expiry || expiry < Date.now()) fail(401, "Please sign in.");
}
function getBooking(input) {
  const id = textField(input.id, 60, true),
    token = textField(input.token, 100, true);
  const b = db.prepare("SELECT * FROM bookings WHERE id=?").get(id);
  if (!b || !equal(b.token_hash, hash(token)))
    fail(
      404,
      "Booking not found. Check your reference and access code. / बुकिंग विवरण जाँचें।",
    );
  return b;
}
async function gateway(path, payload) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    fail(
      502,
      "Payment provider could not complete the request. Please contact the team.",
    );
  return response.json();
}
async function confirmPayment(b, paymentId) {
  const p = await gateway("payments/" + encodeURIComponent(paymentId));
  if (
    p.order_id !== b.order_id ||
    p.amount !== b.amount * 100 ||
    p.currency !== "INR" ||
    p.status !== "captured"
  )
    fail(
      409,
      "Payment is awaiting capture or verification. Refresh your booking shortly.",
    );
  db.prepare("UPDATE bookings SET payment='paid', payment_id=? WHERE id=?").run(
    paymentId,
    b.id,
  );
}
function validateCatalog(c) {
  if (
    !c ||
    !Array.isArray(c.services) ||
    c.services.length < 1 ||
    c.services.length > 30
  )
    fail(400, "Keep 1–30 services.");
  const ids = new Set();
  const bilingual = (obj) => {
    textField(obj?.hi, 3000, true);
    textField(obj?.en, 3000, true);
  };
  bilingual(c.about);
  bilingual(c.refundPolicy);
  for (const s of c.services) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(s.id) || ids.has(s.id))
      fail(400, "Service IDs must be unique lowercase identifiers.");
    ids.add(s.id);
    for (const key of [
      "hi",
      "en",
      "descriptionHi",
      "descriptionEn",
      "locationHi",
      "locationEn",
      "durationHi",
      "durationEn",
      "icon",
    ])
      textField(s[key], 2000, true);
    if (
      (s.price !== null &&
        (!Number.isSafeInteger(s.price) || s.price < 1 || s.price > 1000000)) ||
      typeof s.available !== "boolean"
    )
      fail(400, "Check service price and availability.");
  }
  for (const key of ["team", "reviews", "festivals"])
    if (!Array.isArray(c[key]) || c[key].length > 50)
      fail(400, "Invalid content list.");
  for (const item of c.team) {
    textField(item.name, 100, true);
    bilingual(item);
  }
  for (const r of c.reviews) {
    textField(r.name, 100, true);
    bilingual(r);
    if (r.consent !== true)
      fail(400, "Only publish reviews with customer consent.");
  }
  for (const f of c.festivals) {
    bilingual(f);
    if (
      !validDate(f.date) ||
      !validDate(f.deadline) ||
      f.deadline > f.date ||
      !ids.has(f.serviceId)
    )
      fail(400, "Check festival date, deadline and service ID.");
  }
  return c;
}
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://*.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "POST" && url.pathname !== "/api/payments/webhook") {
        if (
          !req.headers.origin ||
          new URL(req.headers.origin).host !== req.headers.host ||
          (process.env.PUBLIC_ORIGIN &&
            req.headers.origin !== process.env.PUBLIC_ORIGIN)
        )
          fail(403, "Invalid request origin");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          fail(415, "JSON required");
      }
      if (req.method === "GET" && url.pathname === "/api/health")
        return json(res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/api/catalog")
        return json(res, 200, { ...catalog(), paymentReady: paymentReady() });
      if (req.method === "POST" && url.pathname === "/api/bookings") {
        rate(req, "booking", 20);
        const input = await body(req),
          c = catalog(),
          s = c.services.find((s) => s.id === input.serviceId && s.available);
        if (!s)
          fail(400, "This service is unavailable. / सेवा उपलब्ध नहीं है।");
        const name = textField(input.name, 100, true),
          phone = textField(input.phone, 20, true),
          gotra = textField(input.gotra, 100),
          date = textField(input.date, 10, true),
          occasion = textField(input.occasion, 30),
          notes = textField(input.notes, 1500);
        if (
          !/^\+?[0-9][0-9 ()-]{6,19}$/.test(phone) ||
          !validDate(date) ||
          date < today() ||
          date > `${Number(today().slice(0, 4)) + 2}-12-31` ||
          input.consent !== true ||
          !["", "birthday", "anniversary", "memory", "other"].includes(occasion)
        )
          fail(
            400,
            "Check date, phone and consent. / तारीख, फोन और सहमति जाँचें।",
          );
        const id = "DH-" + randomBytes(8).toString("hex").toUpperCase(),
          token = randomBytes(24).toString("base64url");
        db.prepare(
          "INSERT INTO bookings (id,token_hash,name,phone,gotra,service_id,service_name,date,occasion,notes,amount,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          hash(token),
          name,
          phone,
          gotra,
          s.id,
          s.hi,
          date,
          occasion,
          notes,
          s.price,
          new Date().toISOString(),
        );
        return json(res, 201, {
          booking: publicBooking(
            db.prepare("SELECT * FROM bookings WHERE id=?").get(id),
          ),
          token,
        });
      }
      if (req.method === "POST" && url.pathname === "/api/track") {
        rate(req, "track", 100);
        return json(res, 200, {
          booking: publicBooking(getBooking(await body(req))),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/admin/login") {
        rate(req, "login", 10);
        const input = await body(req);
        if (
          typeof input.password !== "string" ||
          !equal(input.password, password)
        )
          fail(401, "Incorrect password.");
        const token = randomBytes(32).toString("hex");
        sessions.set(token, Date.now() + 8 * 3600000);
        res.setHeader(
          "Set-Cookie",
          `dharmique_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${process.env.PUBLIC_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
        );
        return json(res, 200, { ok: true });
      }
      if (url.pathname.startsWith("/api/admin/")) {
        session(req);
        if (req.method === "POST" && url.pathname === "/api/admin/logout") {
          const cookie = req.headers.cookie
            ?.split(";")
            .map((x) => x.trim())
            .find((x) => x.startsWith("dharmique_admin="))
            ?.slice(16);
          sessions.delete(cookie);
          res.setHeader(
            "Set-Cookie",
            "dharmique_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0",
          );
          return json(res, 200, { ok: true });
        }
        if (req.method === "GET" && url.pathname === "/api/admin/bookings")
          return json(res, 200, {
            bookings: db
              .prepare(
                "SELECT id,name,phone,gotra,service_name,date,occasion,notes,amount,status,payment,created_at FROM bookings ORDER BY created_at DESC LIMIT 1000",
              )
              .all(),
          });
        if (req.method === "POST" && url.pathname === "/api/admin/booking") {
          const input = await body(req);
          if (!states.includes(input.status)) fail(400, "Invalid status");
          const b = db
            .prepare("SELECT * FROM bookings WHERE id=?")
            .get(textField(input.id, 60, true));
          if (!b) fail(404, "Booking not found");
          if (b.status === "cancelled" && input.status !== "cancelled")
            fail(
              409,
              "Cancelled bookings cannot be reopened. Create a new booking.",
            );
          if (b.order_id && input.amount !== b.amount)
            fail(409, "Cannot change an amount after checkout has started.");
          if (
            input.amount !== null &&
            (!Number.isSafeInteger(input.amount) ||
              input.amount < 1 ||
              input.amount > 1000000)
          )
            fail(400, "Invalid amount");
          if (
            input.status === "cancelled" &&
            b.order_id &&
            b.payment !== "paid"
          )
            fail(
              409,
              "Checkout has started. Reconcile the payment before cancelling.",
            );
          db.prepare("UPDATE bookings SET status=?,amount=? WHERE id=?").run(
            input.status,
            input.amount,
            b.id,
          );
          return json(res, 200, { ok: true });
        }
        if (req.method === "POST" && url.pathname === "/api/admin/catalog") {
          const input = await body(req);
          validateCatalog(input);
          db.prepare("UPDATE settings SET value=? WHERE id=1").run(
            JSON.stringify(input),
          );
          return json(res, 200, { ok: true });
        }
      }
      if (req.method === "POST" && url.pathname === "/api/payments/order") {
        rate(req, "payment", 30);
        if (!paymentReady())
          fail(
            503,
            "Online payment is not enabled. Contact the team on WhatsApp.",
          );
        const b = getBooking(await body(req));
        if (
          !["confirmed", "completed"].includes(b.status) ||
          !b.amount ||
          b.payment === "paid"
        )
          fail(
            409,
            "The team must confirm your booking and amount before payment.",
          );
        let orderId = b.order_id;
        if (!orderId) {
          const reservation = "creating:" + b.id;
          // Reserve checkout before awaiting the provider so concurrent requests cannot create duplicate orders.
          const reserved = db
            .prepare(
              "UPDATE bookings SET order_id=? WHERE id=? AND order_id IS NULL",
            )
            .run(reservation, b.id);
          if (!reserved.changes)
            fail(409, "Checkout is being prepared. Please try again shortly.");
          try {
            const order = await gateway("orders", {
              amount: b.amount * 100,
              currency: "INR",
              receipt: b.id,
            });
            orderId = order.id;
            db.prepare("UPDATE bookings SET order_id=? WHERE id=?").run(
              orderId,
              b.id,
            );
          } catch (err) {
            db.prepare(
              "UPDATE bookings SET order_id=NULL WHERE id=? AND order_id=?",
            ).run(b.id, reservation);
            throw err;
          }
        }
        if (orderId.startsWith("creating:"))
          fail(
            409,
            "Checkout is being prepared. Please contact the team if this persists.",
          );
        return json(res, 200, {
          key: process.env.RAZORPAY_KEY_ID,
          orderId,
          amount: b.amount * 100,
          name: b.name,
        });
      }
      if (req.method === "POST" && url.pathname === "/api/payments/verify") {
        rate(req, "payment", 30);
        if (!paymentReady()) fail(503, "Payment is not enabled.");
        const input = await body(req),
          b = getBooking(input);
        const paymentId = textField(input.paymentId, 100, true),
          signature = textField(input.signature, 200, true);
        if (
          !b.order_id ||
          !equal(
            createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
              .update(`${b.order_id}|${paymentId}`)
              .digest("hex"),
            signature,
          )
        )
          fail(400, "Payment verification failed.");
        await confirmPayment(b, paymentId);
        return json(res, 200, {
          booking: publicBooking(
            db.prepare("SELECT * FROM bookings WHERE id=?").get(b.id),
          ),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/payments/webhook") {
        if (!process.env.RAZORPAY_WEBHOOK_SECRET || !paymentReady())
          fail(503, "Webhook not configured");
        const raw = await body(req, true),
          sig = req.headers["x-razorpay-signature"];
        if (
          typeof sig !== "string" ||
          !equal(
            sig,
            createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
              .update(raw)
              .digest("hex"),
          )
        )
          fail(400, "Invalid signature");
        const event = JSON.parse(raw),
          p = event.payload?.payment?.entity;
        if (event.event === "payment.captured" && p) {
          const b = db
            .prepare("SELECT * FROM bookings WHERE order_id=?")
            .get(p.order_id);
          if (b) await confirmPayment(b, p.id);
        }
        return json(res, 200, { ok: true });
      }
      fail(404, "Not found");
    }
    if (!["GET", "HEAD"].includes(req.method)) fail(405, "Method not allowed");
    const pathname = decodeURIComponent(url.pathname);
    if (
      [
        "/dharmiq-darshan-updated.html",
        "/dharmique-darshan-final (1).html",
      ].includes(pathname)
    ) {
      res.writeHead(302, { Location: "/index.html" });
      return res.end();
    }
    const filename = pathname === "/" ? "index.html" : pathname.slice(1);
    const allowed =
      /^(index\.html|chadhava\.html|admin\.html|dharmiq-darshan-updated\.html|dharmique-darshan-final \(1\)\.html|assets\/(app\.js|admin\.js|chadhava\.js|styles\.css|catalog\.json)|[^/]+\.(png|jpeg|jpg|webp|mp4))$/;
    if (!allowed.test(filename)) fail(404, "Not found");
    const file = resolve(root, filename);
    if (!existsSync(file) || !statSync(file).isFile()) fail(404, "Not found");
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".png": "image/png",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
    };
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": statSync(file).size,
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch (err) {
    if (!res.headersSent)
      json(res, err.status || 500, {
        error: err.status
          ? err.message
          : "Something went wrong. Please contact the team. / कृपया टीम से संपर्क करें।",
      });
    else res.end();
  }
});
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (v < now) sessions.delete(k);
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
}, 60000);
cleanup.unref();
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Dharmique ready on port ${port}. Admin password: use ADMIN_PASSWORD or the private file in DATA_DIR.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
