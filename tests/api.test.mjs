import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import { services } from "../assets/booking-message.js";
import { server } from "../server.mjs";
import { database, initialize, closeDatabase } from "../lib/db.js";
const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl || !/^dharmique_test(?:_|$)/.test(new URL(dbUrl).pathname.slice(1)))
  throw new Error(
    "Set TEST_DATABASE_URL to a dedicated database named dharmique_test or dharmique_test_*. Never use a production database.",
  );
process.env.DATABASE_URL = dbUrl;
process.env.ADMIN_PASSWORD = randomBytes(24).toString("hex");
const password = process.env.ADMIN_PASSWORD;
let base, cookie;
async function request(path, body, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: base }),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...options.headers,
    },
    body:
      body === undefined
        ? undefined
        : options.raw
          ? body
          : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { response, data, status: response.status };
}
const booking = (overrides = {}) => ({
  id: randomUUID(),
  serviceId: "small",
  name: "Synthetic Devotee",
  phone: "9000000000",
  gotra: "",
  prasadi: true,
  ...overrides,
});
async function login() {
  const result = await request("/api/admin?action=login", { password });
  assert.equal(result.status, 200);
  cookie = result.response.headers.get("set-cookie").split(";")[0];
  return result;
}
before(async () => {
  await initialize();
  await database().query(
    "TRUNCATE dharmique.visits,dharmique.bookings,dharmique.sessions,dharmique.rate_limits",
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await database().query(
    "TRUNCATE dharmique.visits,dharmique.bookings,dharmique.sessions,dharmique.rate_limits",
  );
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});
test("admin is private; origin, method, password, cookies and configuration are enforced", async () => {
  assert.equal((await request("/api/admin")).status, 401);
  assert.equal((await request("/api/bookings")).status, 405);
  assert.equal(
    (
      await request(
        "/api/admin?action=login",
        { password },
        { headers: { Origin: "https://evil.example" } },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/admin?action=login", { password: "incorrect" }))
      .status,
    401,
  );
  const result = await login();
  const attributes = result.response.headers.get("set-cookie");
  assert.match(attributes, /HttpOnly/);
  assert.match(attributes, /SameSite=Strict/);
  assert.match(attributes, /Path=\/api/);
  assert.ok(!JSON.stringify(result.data).includes(password));
  assert.equal(
    (await request("/api/admin?view=session", undefined, { cookie })).status,
    200,
  );
  process.env.ADMIN_PASSWORD = "";
  assert.equal(
    (await request("/api/admin?view=session", undefined, { cookie })).status,
    503,
  );
  process.env.ADMIN_PASSWORD = password;
  const adminPage = await request("/admin.html");
  assert.match(
    adminPage.response.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal((await request("/lib/api.js")).status, 404);
  assert.equal((await request("/.env")).status, 404);
  assert.equal((await request("/.data/admin-password")).status, 404);
});
test("all six services persist correct server prices and idempotent requests without public PII", async () => {
  const ids = [];
  for (const [key, service] of Object.entries(services)) {
    const payload = booking({
      serviceId: key,
      sevaFee: -1,
      prasadiFee: 0,
      status: "confirmed",
      paymentStatus: "paid",
    });
    const result = await request("/api/bookings", payload);
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.data).sort(), ["id", "saved"]);
    assert.equal((await request("/api/bookings", payload)).status, 200);
    const row = (
      await database().query("SELECT * FROM dharmique.bookings WHERE id=$1", [
        payload.id,
      ])
    ).rows[0];
    assert.equal(row.seva_fee, service.price);
    assert.equal(row.prasadi_fee, 200);
    assert.equal(row.status, "requested");
    assert.equal(row.payment_status, "pending");
    const conflict = await request("/api/bookings", {
      ...payload,
      phone: "9111111111",
    });
    assert.equal(conflict.status, 409);
    assert.ok(!JSON.stringify(conflict.data).includes(payload.name));
    ids.push(payload.id);
  }
  await database().query("TRUNCATE dharmique.rate_limits");
  const payload = booking({ prasadi: false, gotra: "कश्यप" });
  assert.equal((await request("/api/bookings", payload)).status, 201);
  await closeDatabase();
  await initialize();
  const row = (
    await database().query("SELECT * FROM dharmique.bookings WHERE id=$1", [
      payload.id,
    ])
  ).rows[0];
  assert.equal(row.prasadi_fee, 0);
  assert.equal(row.gotra, "कश्यप");
  assert.equal(
    (
      await database().query(
        "SELECT count(*)::int AS n FROM dharmique.bookings",
      )
    ).rows[0].n,
    7,
  );
});
test("malformed booking data, JSON and oversized requests are rejected", async () => {
  for (const invalid of [
    { name: " " },
    { phone: "123" },
    { serviceId: "unknown" },
    { id: "abc" },
    { id: [randomUUID()] },
    { serviceId: ["small"] },
    { prasadi: "yes" },
    { gotra: 123 },
    { name: "a".repeat(101) },
  ]) {
    assert.equal(
      (await request("/api/bookings", booking(invalid))).status,
      400,
    );
  }
  assert.equal(
    (await request("/api/bookings", "bad", { raw: true })).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/bookings",
        {},
        { headers: { "Content-Type": "text/plain" } },
      )
    ).status,
    415,
  );
  assert.equal(
    (await request("/api/bookings", booking({ notes: "x".repeat(5000) })))
      .status,
    413,
  );
});
test("visits deduplicate across the two pages and admin totals/filtering remain accurate", async () => {
  const sessionId = randomUUID();
  assert.equal((await request("/api/visit", { sessionId })).status, 200);
  assert.equal((await request("/api/visit", { sessionId })).status, 200);
  await database().query(
    "INSERT INTO dharmique.visits(session_id,day) VALUES($1,((now() AT TIME ZONE 'Asia/Kolkata')::date)-1)",
    [sessionId],
  );
  const result = await request("/api/admin", undefined, { cookie });
  assert.equal(result.status, 200);
  assert.equal(result.data.stats.total_visits, 2);
  assert.equal(result.data.stats.today_visits, 1);
  assert.equal(result.data.stats.requests, 7);
  assert.equal(result.data.stats.pending, 7);
  assert.equal(result.data.stats.paid, 0);
  assert.equal(
    (await request("/api/admin?status=confirmed", undefined, { cookie })).data
      .total,
    0,
  );
  assert.equal(
    (
      await request(
        "/api/admin?search=" +
          encodeURIComponent("'; DROP TABLE dharmique.bookings; --"),
        undefined,
        { cookie },
      )
    ).data.total,
    0,
  );
  assert.equal(
    (await request("/api/admin?page=0", undefined, { cookie })).status,
    400,
  );
  assert.equal((await request("/api/visit", { sessionId: "bad" })).status, 400);
});
test("only the admin can update statuses; concurrent changes and session revocation are safe", async () => {
  const row = (
    await database().query("SELECT * FROM dharmique.bookings LIMIT 1")
  ).rows[0];
  const payload = {
    id: row.id,
    status: "confirmed",
    paymentStatus: "paid",
    version: row.version,
  };
  assert.equal(
    (await request("/api/admin?action=update", payload)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/admin?action=update", payload, {
        cookie,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin?action=update",
        { ...payload, status: "invented" },
        { cookie },
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/admin?action=update", payload, { cookie })).status,
    200,
  );
  assert.equal(
    (await request("/api/admin?action=update", payload, { cookie })).status,
    409,
  );
  const stats = (await request("/api/admin", undefined, { cookie })).data.stats;
  assert.equal(stats.confirmed, 1);
  assert.equal(stats.paid, 1);
  process.env.ADMIN_PASSWORD = randomBytes(24).toString("hex");
  assert.equal(
    (await request("/api/admin", undefined, { cookie })).status,
    401,
  );
  process.env.ADMIN_PASSWORD = password;
  assert.equal(
    (await request("/api/admin?action=logout", {}, { cookie })).status,
    200,
  );
  assert.equal(
    (await request("/api/admin", undefined, { cookie })).status,
    401,
  );
  await login();
  await database().query(
    "UPDATE dharmique.sessions SET expires_at=now()-interval '1 second'",
  );
  assert.equal(
    (await request("/api/admin", undefined, { cookie })).status,
    401,
  );
});
test("login throttling persists in PostgreSQL and production cookies are secure", async () => {
  await database().query("TRUNCATE dharmique.rate_limits");
  process.env.NODE_ENV = "production";
  const result = await login();
  assert.match(result.response.headers.get("set-cookie"), /; Secure/);
  delete process.env.NODE_ENV;
  for (let i = 0; i < 7; i++)
    assert.equal(
      (await request("/api/admin?action=login", { password: "incorrect" }))
        .status,
      401,
    );
  assert.equal(
    (await request("/api/admin?action=login", { password })).status,
    429,
  );
});

test("Vercel function entry accepts pre-parsed JSON and rejects cross-protocol origins", async () => {
  const { default: handler } = await import("../api/bookings.js");
  const payload = booking({ prasadi: false });
  const invoke = (origin) =>
    new Promise((resolve) => {
      const req = {
        method: "POST",
        url: "/api/bookings",
        headers: {
          host: "example.test",
          origin,
          "content-type": "application/json",
        },
        body: payload,
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = {
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        end(body) {
          resolve({ status: this.statusCode, data: JSON.parse(body) });
        },
      };
      handler(req, res);
    });
  process.env.VERCEL = "1";
  assert.equal((await invoke("http://example.test")).status, 403);
  assert.equal((await invoke("https://example.test")).status, 201);
  delete process.env.VERCEL;
  assert.equal(
    (
      await database().query(
        "SELECT prasadi_fee FROM dharmique.bookings WHERE id=$1",
        [payload.id],
      )
    ).rows[0].prasadi_fee,
    0,
  );
});
