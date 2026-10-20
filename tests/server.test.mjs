import { test } from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
const root = resolve(import.meta.dirname, "..");
const fixture = resolve(import.meta.dirname, "fixtures/payment-provider.mjs");
async function launch(t, withPayments = false) {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const dir = mkdtempSync(resolve(tmpdir(), "dharmique-test-")),
    password = randomBytes(24).toString("hex"),
    secret = randomBytes(24).toString("hex");
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dir,
    ADMIN_PASSWORD: password,
    PUBLIC_ORIGIN: base,
    RAZORPAY_KEY_ID: withPayments ? "synthetic_key" : "",
    RAZORPAY_KEY_SECRET: withPayments ? secret : "",
    RAZORPAY_WEBHOOK_SECRET: withPayments ? secret : "",
  };
  const start = async () => {
    const child = spawn(
      process.execPath,
      [...(withPayments ? ["--import", fixture] : []), "server.mjs"],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((ok, bad) => {
      const timeout = setTimeout(
        () => bad(new Error("Server startup timeout")),
        10000,
      );
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Dharmique ready")) {
          clearTimeout(timeout);
          ok();
        }
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        bad(new Error("Server exited before startup"));
      });
    });
    return child;
  };
  let child = await start();
  const stop = async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  };
  t.after(async () => {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const request = async (path, data, options = {}) => {
    const response = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: base }),
        ...options.headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    let result;
    try {
      result = await response.json();
    } catch {}
    return { response, status: response.status, body: result };
  };
  const login = await request("/api/admin/login", { password });
  assert.equal(login.status, 200);
  const cookie = login.response.headers.get("set-cookie").split(";")[0];
  const admin = (path, data) =>
    request(path, data, { headers: { Cookie: cookie } });
  return {
    request,
    admin,
    base,
    secret,
    restart: async () => {
      await stop();
      child = await start();
    },
  };
}
const draft = {
  name: "Synthetic Devotee",
  phone: "+91 90000 00000",
  gotra: "",
  serviceId: "small",
  date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  occasion: "birthday",
  notes: "Synthetic fixture only",
  consent: true,
};
test("booking validation, private tracking, admin protection, immutable amounts and persistence", async (t) => {
  const { request, admin, restart, base } = await launch(t);
  assert.equal((await request("/api/health")).status, 200);
  assert.equal((await request("/api/admin/bookings")).status, 401);
  assert.equal(
    (await request("/api/admin/login", { password: "wrong" })).status,
    401,
  );
  assert.equal(
    (
      await request("/api/bookings", draft, {
        headers: { Origin: "https://other.example" },
      })
    ).status,
    403,
  );
  for (const input of [
    { ...draft, consent: false },
    { ...draft, date: "2027-02-30" },
    { ...draft, date: "2020-01-01" },
    { ...draft, phone: "invalid" },
    { ...draft, occasion: "invalid" },
    { ...draft, serviceId: "missing" },
  ])
    assert.equal((await request("/api/bookings", input)).status, 400);
  // Split a Hindi code point across network chunks to check request decoding.
  const unicodePayload = Buffer.from(
    JSON.stringify({ ...draft, name: "भक्त परिवार" }),
  );
  const split = unicodePayload.indexOf(Buffer.from("भ")) + 1;
  const unicodeBooking = await new Promise((resolve, reject) => {
    const req = http.request(
      base + "/api/bookings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
      },
      (res) => {
        let value = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (value += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: JSON.parse(value) }),
        );
      },
    );
    req.on("error", reject);
    req.write(unicodePayload.subarray(0, split));
    setTimeout(() => req.end(unicodePayload.subarray(split)), 10);
  });
  assert.equal(unicodeBooking.status, 201);
  assert.equal(unicodeBooking.body.booking.name, "भक्त परिवार");
  const created = await request("/api/bookings", { ...draft, amount: 1 });
  assert.equal(created.status, 201);
  assert.equal(created.body.booking.amount, 51);
  const creds = { id: created.body.booking.id, token: created.body.token };
  assert.equal(
    (await request("/api/track", { ...creds, token: "wrong" })).status,
    404,
  );
  const tracked = await request("/api/track", creds);
  assert.equal(tracked.body.booking.status, "requested");
  assert.equal(tracked.body.booking.phone, undefined);
  assert.equal(tracked.body.booking.token, undefined);
  assert.equal((await request("/api/payments/order", creds)).status, 503);
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "confirmed",
        amount: 70,
      })
    ).status,
    200,
  );
  assert.equal((await request("/api/track", creds)).body.booking.amount, 70);
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "fake",
        amount: 70,
      })
    ).status,
    400,
  );
  let c = (await request("/api/catalog")).body;
  delete c.paymentReady;
  c.services[2].available = false;
  c.services[2].price = 77;
  assert.equal((await admin("/api/admin/catalog", c)).status, 200);
  assert.equal((await request("/api/bookings", draft)).status, 400);
  assert.equal((await request("/api/track", creds)).body.booking.amount, 70);
  const invalid = structuredClone(c);
  invalid.services[0].price = -1;
  assert.equal((await admin("/api/admin/catalog", invalid)).status, 400);
  invalid.services[0].price = null;
  invalid.reviews = [
    { name: "Without consent", hi: "नहीं", en: "No", consent: false },
  ];
  assert.equal((await admin("/api/admin/catalog", invalid)).status, 400);
  c.festivals = [
    {
      hi: "पर्व",
      en: "Festival",
      date: draft.date,
      deadline: draft.date,
      serviceId: "small",
    },
  ];
  c.reviews = [
    {
      name: "Synthetic fixture",
      hi: "अनुमति है",
      en: "Consent given",
      consent: true,
    },
  ];
  c.team = [{ name: "Synthetic member", hi: "भूमिका", en: "Role" }];
  assert.equal((await admin("/api/admin/catalog", c)).status, 200);
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "completed",
        amount: 70,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/track", creds)).body.booking.status,
    "completed",
  );
  assert.equal((await admin("/api/admin/logout", {})).status, 200);
  assert.equal((await admin("/api/admin/bookings")).status, 401);
  for (const path of [
    "/server.mjs",
    "/.env",
    "/.data/admin-password",
    "/tests/server.test.mjs",
    "/package.json",
  ])
    assert.equal((await fetch(base + path)).status, 404);
  for (const path of [
    "/",
    "/admin.html",
    "/chadhava.html",
    "/assets/app.js",
    "/assets/admin.js",
    "/assets/chadhava.js",
    "/assets/styles.css",
  ])
    assert.equal((await fetch(base + path)).status, 200);
  await restart();
  assert.equal(
    (await request("/api/track", creds)).body.booking.status,
    "completed",
  );
  assert.equal((await request("/api/catalog")).body.services[2].price, 77);
});
test("synthetic gateway: signatures, confirmed amounts, capture, webhooks and repeated requests", async (t) => {
  const { request, admin, secret } = await launch(t, true);
  const created = await request("/api/bookings", draft),
    creds = { id: created.body.booking.id, token: created.body.token };
  assert.equal((await request("/api/payments/order", creds)).status, 409);
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "confirmed",
        amount: 51,
      })
    ).status,
    200,
  );
  const second = await request("/api/bookings", draft);
  const secondCreds = { id: second.body.booking.id, token: second.body.token };
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: secondCreds.id,
        status: "confirmed",
        amount: 51,
      })
    ).status,
    200,
  );
  const [order, secondOrder] = await Promise.all([
    request("/api/payments/order", creds),
    request("/api/payments/order", secondCreds),
  ]);
  assert.equal(order.status, 200);
  assert.equal(secondOrder.status, 200);
  assert.notEqual(order.body.orderId, secondOrder.body.orderId);
  assert.equal(order.body.amount, 5100);
  assert.equal(
    (await request("/api/payments/order", creds)).body.orderId,
    order.body.orderId,
  );
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "confirmed",
        amount: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await admin("/api/admin/booking", {
        id: creds.id,
        status: "cancelled",
        amount: 51,
      })
    ).status,
    409,
  );
  const paymentId = "pay_" + creds.id,
    signature = (id) =>
      createHmac("sha256", secret)
        .update(order.body.orderId + "|" + id)
        .digest("hex");
  assert.equal(
    (
      await request("/api/payments/verify", {
        ...creds,
        paymentId,
        signature: "wrong",
      })
    ).status,
    400,
  );
  for (const suffix of ["_wrong", "_pending"])
    assert.equal(
      (
        await request("/api/payments/verify", {
          ...creds,
          paymentId: paymentId + suffix,
          signature: signature(paymentId + suffix),
        })
      ).status,
      409,
    );
  assert.equal(
    (
      await request("/api/payments/verify", {
        ...creds,
        paymentId,
        signature: signature(paymentId),
      })
    ).body.booking.payment,
    "paid",
  );
  assert.equal(
    (
      await request("/api/payments/verify", {
        ...creds,
        paymentId,
        signature: signature(paymentId),
      })
    ).status,
    200,
  );
  const event = {
    event: "payment.captured",
    payload: {
      payment: { entity: { id: paymentId, order_id: order.body.orderId } },
    },
  };
  assert.equal(
    (
      await request("/api/payments/webhook", event, {
        headers: { "x-razorpay-signature": "invalid" },
      })
    ).status,
    400,
  );
  const webhookSignature = createHmac("sha256", secret)
    .update(JSON.stringify(event))
    .digest("hex");
  assert.equal(
    (
      await request("/api/payments/webhook", event, {
        headers: { "x-razorpay-signature": webhookSignature },
      })
    ).status,
    200,
  );
  assert.equal((await request("/api/payments/order", creds)).status, 409);
  const receipt = (await request("/api/track", creds)).body.booking;
  assert.equal(receipt.payment, "paid");
  assert.equal(receipt.paymentId, paymentId);
  assert.equal(receipt.amount, 51);
});
