import { services } from "./booking-message.js";
const $ = (s) => document.querySelector(s);
let page = 1;
let busy = false;
function notice(text = "", error = false) {
  $("#notice").textContent = text;
  $("#notice").classList.toggle("error", error);
}
function lock() {
  $("#dashboard").hidden = true;
  $("#bookings").replaceChildren();
  $("#stats").replaceChildren();
  $("#logout").hidden = true;
  $("#login-panel").hidden = false;
}
async function request(url, body) {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) lock();
    throw new Error(data.error || "कनेक्शन में समस्या है। दोबारा कोशिश करें।");
  }
  return data;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function field(list, label, text) {
  const wrapper = element("div");
  wrapper.append(element("dt", label), element("dd", text));
  list.append(wrapper);
}
function choice(label, options, value, id) {
  const wrapper = element("div"),
    select = element("select"),
    caption = element("label", label);
  select.id = id;
  caption.htmlFor = id;
  for (const [key, text] of options) {
    const option = element("option", text);
    option.value = key;
    select.append(option);
  }
  select.value = value;
  wrapper.append(caption, select);
  return { wrapper, select };
}
function renderBooking(booking) {
  const card = element("article", undefined, "booking");
  card.dataset.id = booking.id;
  const date = new Intl.DateTimeFormat("hi-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(booking.created_at));
  card.append(
    element("h3", booking.name),
    element("p", `${date} · ${booking.id}`, "meta"),
  );
  const details = element("dl");
  field(
    details,
    "सेवा",
    services[booking.service_id]?.hi || booking.service_id,
  );
  field(details, "नंबर", booking.phone);
  if (booking.city) field(details, "शहर", booking.city);
  if (booking.note) field(details, "संकल्प / संदेश", booking.note);
  field(details, "गोत्र", booking.gotra || "नहीं बताया");
  field(
    details,
    "सेवा शुल्क",
    booking.seva_fee === null ? "WhatsApp पर तय होगा" : `₹${booking.seva_fee}`,
  );
  field(
    details,
    "प्रसादी",
    booking.prasadi ? `हाँ · ₹${booking.prasadi_fee} अतिरिक्त` : "नहीं",
  );
  field(
    details,
    "कुल",
    booking.seva_fee === null
      ? `सेवा शुल्क${booking.prasadi ? " + ₹200" : ""} · तय होना बाकी`
      : `₹${booking.seva_fee + booking.prasadi_fee}`,
  );
  card.append(details);
  let phone = booking.phone.replace(/\D/g, "");
  if (phone.length === 10) phone = "91" + phone;
  if (/^\d{7,15}$/.test(phone)) {
    const link = element("a", "ग्राहक को WhatsApp करें ↗");
    link.href = `https://wa.me/${phone}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }
  const controls = element("div", undefined, "controls");
  const status = choice(
    "Booking status",
    [
      ["requested", "नई request"],
      ["confirmed", "Confirmed"],
      ["cancelled", "Cancelled"],
    ],
    booking.status,
    `status-${booking.id}`,
  );
  const payment = choice(
    "UPI payment (खुद verify करें)",
    [
      ["pending", "Pending"],
      ["paid", "Paid"],
    ],
    booking.payment_status,
    `payment-${booking.id}`,
  );
  const save = element("button", "सेव करें");
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    notice();
    try {
      await request("/api/admin?action=update", {
        id: booking.id,
        status: status.select.value,
        paymentStatus: payment.select.value,
        version: booking.version,
      });
      await load();
      notice("Status सेव हो गया।");
    } catch (error) {
      notice(error.message, true);
    } finally {
      save.disabled = false;
    }
  });
  controls.append(status.wrapper, payment.wrapper, save);
  card.append(controls);
  return card;
}
async function load() {
  if (busy) return;
  busy = true;
  $("#refresh").disabled = true;
  try {
    const params = new URLSearchParams({
      page,
      status: $("#status-filter").value,
      search: $("#search").value.trim(),
    });
    const data = await request("/api/admin?" + params);
    $("#login-panel").hidden = true;
    $("#dashboard").hidden = false;
    $("#logout").hidden = false;
    const labels = {
      today_visits: "आज के विज़िट",
      total_visits: "कुल विज़िट",
      requests: "सभी requests",
      pending: "नई requests",
      confirmed: "Confirmed bookings",
      cancelled: "Cancelled",
      paid: "Paid (आपकी पुष्टि)",
    };
    $("#stats").replaceChildren(
      ...Object.entries(labels).map(([key, text]) => {
        const node = element("div", undefined, "stat");
        node.append(element("strong", data.stats[key]), element("span", text));
        return node;
      }),
    );
    if (data.bookings.length === 0 && page > 1) {
      page -= 1;
      busy = false;
      return await load();
    }
    $("#bookings").replaceChildren(...data.bookings.map(renderBooking));
    if (!data.bookings.length)
      $("#bookings").append(element("p", "अभी कोई booking request नहीं है।"));
    $("#result-count").textContent = `${data.total} requests`;
    $("#page-number").textContent =
      `${page} / ${Math.max(1, Math.ceil(data.total / data.pageSize))}`;
    $("#previous").disabled = page <= 1;
    $("#next").disabled = page * data.pageSize >= data.total;
    $("#updated").textContent =
      "अंतिम अपडेट: " + new Date().toLocaleTimeString("hi-IN");
  } finally {
    busy = false;
    $("#refresh").disabled = false;
  }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  notice();
  try {
    await request("/api/admin?action=login", {
      password: $("#password").value,
    });
    $("#password").value = "";
    page = 1;
    await load();
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  try {
    await request("/api/admin?action=logout", {});
    lock();
    notice("लॉग आउट हो गया।");
  } catch (error) {
    notice(error.message, true);
  }
});
$("#filters").addEventListener("submit", (event) => {
  event.preventDefault();
  page = 1;
  notice();
  load().catch((error) => notice(error.message, true));
});
$("#refresh").addEventListener("click", () => {
  notice();
  load().catch((error) => notice(error.message, true));
});
$("#previous").addEventListener("click", () => {
  if (page > 1) page -= 1;
  load().catch((error) => notice(error.message, true));
});
$("#next").addEventListener("click", () => {
  page += 1;
  load().catch((error) => notice(error.message, true));
});
try {
  await request("/api/admin?view=session");
  notice();
  await load();
} catch (error) {
  lock();
  notice(
    error.message === "Please log in." ? "" : error.message,
    error.message !== "Please log in.",
  );
}
