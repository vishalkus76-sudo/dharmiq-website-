let language = "hi";
try {
  language = localStorage.getItem("dharmique-language") === "en" ? "en" : "hi";
} catch {}
let catalog,
  filter = "all",
  currentBooking = null,
  credentials = null;
let bookingDraft = null;
const $ = (selector) => document.querySelector(selector);
const tr = (hi, en) => (language === "en" ? en : hi);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  new Intl.NumberFormat(language === "en" ? "en-IN" : "hi-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const formatDate = (date) =>
  new Date(date + "T12:00:00").toLocaleDateString(
    language === "en" ? "en-IN" : "hi-IN",
    { day: "numeric", month: "long", year: "numeric" },
  );
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
function message(selector, text, error = false) {
  const el = $(selector);
  el.textContent = text;
  el.className = error ? "error" : "success";
}
async function api(path, data) {
  const response = await fetch(path, {
    ...(data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
const whatsapp = (message) =>
  "https://wa.me/919555669751?text=" + encodeURIComponent(message);
const statusNames = (status) =>
  ({
    requested: tr("अनुरोध मिला", "Requested"),
    confirmed: tr("पुष्टि हुई", "Confirmed"),
    completed: tr("सेवा पूरी हुई", "Completed"),
    cancelled: tr("रद्द हुई", "Cancelled"),
  })[status] || status;
function translate() {
  document.documentElement.lang = language;
  document.title = tr(
    "Dharmique | काशी की पावन सेवाएँ",
    "Dharmique | Sacred Sevas of Kashi",
  );
  document
    .querySelectorAll("[data-hi][data-en]")
    .forEach((el) => (el.textContent = el.dataset[language]));
  document.querySelectorAll("[data-lang]").forEach((el) => {
    const active = el.dataset.lang === language;
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", String(active));
  });
  try {
    localStorage.setItem("dharmique-language", language);
  } catch {}
  if (catalog) render();
  if (bookingDraft) showBookingResult();
  if (currentBooking) renderTracking();
}
function render() {
  const selected = $("#service").value;
  $("#service").innerHTML =
    `<option value="">${tr("सेवा चुनें", "Choose a seva")}</option>` +
    catalog.services
      .filter((s) => s.available)
      .map((s) => `<option value="${esc(s.id)}">${esc(s[language])}</option>`)
      .join("");
  $("#service").value = selected;
  const offerings = ["small", "midday", "rajbhog"];
  $("#service-list").innerHTML = catalog.services
    .filter(
      (s) =>
        filter === "all" ||
        (filter === "offerings"
          ? offerings.includes(s.id)
          : !offerings.includes(s.id)),
    )
    .map(
      (s) =>
        `<article class="service-card"><div class="service-top"><div class="service-icon" aria-hidden="true">${esc(s.icon)}</div><span class="tag ${s.available ? "" : "closed"}">${s.available ? tr("अनुरोध करें", "Open for requests") : tr("अभी उपलब्ध नहीं", "Currently unavailable")}</span></div><h3>${esc(s[language])}</h3><p>${esc(s[language === "hi" ? "descriptionHi" : "descriptionEn"])}</p><div class="service-details"><span>⌖ ${esc(s[language === "hi" ? "locationHi" : "locationEn"])}</span><span>◷ ${esc(s[language === "hi" ? "durationHi" : "durationEn"])}</span></div><div class="card-bottom"><div class="price ${s.price === null ? "ask" : ""}">${s.price === null ? tr("शुल्क टीम से पूछें", "Ask for a quote") : money(s.price)}<small>${tr("अंतिम पुष्टि आवश्यक", "Subject to confirmation")}</small></div><button class="btn" type="button" data-service="${esc(s.id)}" ${s.available ? "" : "disabled"}>${tr("सेवा चुनें", "Choose seva")} ↗</button></div></article>`,
    )
    .join("");
  $("#about-copy").textContent = catalog.about[language];
  $("#refund-copy").textContent = catalog.refundPolicy[language];
  $("#team-list").innerHTML = catalog.team
    .map(
      (member) =>
        `<div class="team-member"><strong>${esc(member.name)}</strong><p>${esc(member[language])}</p></div>`,
    )
    .join("");
  $("#review-list").innerHTML = catalog.reviews.length
    ? catalog.reviews
        .filter((r) => r.consent)
        .map(
          (r) =>
            `<article class="review-card"><blockquote>“${esc(r[language])}”</blockquote><strong>${esc(r.name)}</strong></article>`,
        )
        .join("")
    : `<div class="empty-card"><p>${tr("सेवा का अनुभव साझा करना चाहते हैं? हमारी टीम को लिखें। आपकी अनुमति के बाद ही समीक्षा प्रकाशित की जाएगी।", "Have an experience to share? Write to our team. We will publish your review only with your permission.")}</p><a class="btn secondary" target="_blank" rel="noopener" href="${whatsapp(tr("नमस्कार, मैं अपना सेवा अनुभव साझा करना चाहता/चाहती हूँ।", "Namaste, I would like to share my seva experience."))}">${tr("अनुभव साझा करें", "Share your experience")} ↗</a></div>`;
  const upcoming = catalog.festivals
    .filter((f) => f.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date));
  $("#festival-list").innerHTML = upcoming.length
    ? upcoming
        .map(
          (f) =>
            `<article class="event-card"><div class="event-date">${esc(formatDate(f.date))}</div><h3>${esc(f[language])}</h3><p>${tr("अनुरोध की अंतिम तारीख", "Request deadline")}: ${esc(formatDate(f.deadline))}</p>${f.deadline >= today() ? `<button class="btn secondary" data-service="${esc(f.serviceId)}" data-date="${esc(f.date)}">${tr("सेवा का अनुरोध करें", "Request seva")} ↗</button>` : `<span class="tag closed">${tr("अनुरोध बंद", "Requests closed")}</span>`}</article>`,
        )
        .join("")
    : [
        [
          "🪔",
          tr("कार्तिक मास", "Kartik month"),
          tr(
            "दीपदान की उपलब्ध तारीखें टीम से पूछें।",
            "Ask our team about available dates for Deepdaan.",
          ),
          "deepdaan",
        ],
        [
          "🌊",
          tr("देव दीपावली", "Dev Deepawali"),
          tr(
            "गंगा पूजन की तिथि और उपलब्धता की पुष्टि करें।",
            "Confirm the date and availability for Ganga Pujan.",
          ),
          "ganga",
        ],
        [
          "🌸",
          tr("आपके खास अवसर", "Your special occasions"),
          tr(
            "जन्मदिन, वर्षगाँठ या स्मृति में सेवा का संकल्प।",
            "Seva for a birthday, anniversary or in remembrance.",
          ),
          "small",
        ],
      ]
        .map(
          ([icon, title, desc, id]) =>
            `<article class="event-card"><div class="event-date">${icon} ${tr("तारीख टीम से पूछें", "Ask the team for dates")}</div><h3>${title}</h3><p>${desc}</p><button class="btn secondary" data-service="${id}">${tr("जानकारी लें", "Enquire")} ↗</button></article>`,
        )
        .join("");
  estimate();
}
function estimate() {
  const s = catalog?.services.find((s) => s.id === $("#service").value);
  $("#estimate").textContent = !s
    ? tr(
        "सेवा चुनने पर शुल्क की जानकारी दिखेगी।",
        "Choose a seva to see fee details.",
      )
    : s.price === null
      ? tr(
          "इस सेवा का शुल्क टीम से पुष्टि पर तय होगा।",
          "The team will confirm the fee for this seva.",
        )
      : `${tr("दर्शाया गया शुल्क", "Listed fee")}: ${money(s.price)} · ${tr("अंतिम पुष्टि टीम से करें", "Confirm the final amount with the team")}`;
}
function bookingWhatsApp(draft) {
  const service = catalog.services.find((s) => s.id === draft.serviceId);
  return (
    tr(
      "नमस्कार Dharmique, सेवा का अनुरोध:",
      "Namaste Dharmique, my seva request:",
    ) +
    "\n" +
    [
      draft.id ? `${tr("रेफरेंस", "Reference")}: ${draft.id}` : "",
      `${tr("नाम", "Name")}: ${draft.name}`,
      `${tr("फोन", "Phone")}: ${draft.phone}`,
      `${tr("सेवा", "Seva")}: ${service?.[language] || draft.serviceId}`,
      `${tr("तारीख", "Date")}: ${draft.date}`,
      draft.gotra ? `${tr("गोत्र", "Gotra")}: ${draft.gotra}` : "",
      draft.occasion ? `${tr("अवसर", "Occasion")}: ${draft.occasion}` : "",
      draft.notes ? `${tr("संकल्प", "Intention")}: ${draft.notes}` : "",
      tr(
        "कृपया उपलब्धता, स्थान, सामग्री और अंतिम शुल्क की पुष्टि करें।",
        "Please confirm availability, location, offerings and the final fee.",
      ),
    ]
      .filter(Boolean)
      .join("\n")
  );
}
function showBookingResult() {
  const draft = bookingDraft,
    result = $("#booking-result");
  result.hidden = false;
  result.innerHTML = `<h3>${draft.id ? tr("आपका अनुरोध सुरक्षित हो गया", "Your request has been saved") : tr("WhatsApp पर विवरण भेजें", "Send your details on WhatsApp")}</h3>${draft.id ? `<p class="small">${tr("ये दोनों विवरण अभी सुरक्षित करें। निजी एक्सेस कोड दोबारा नहीं दिखाया जाएगा।", "Save both details now. Your private access code will not be displayed again.")}</p><strong>${tr("बुकिंग रेफरेंस", "Booking reference")}</strong><code>${esc(draft.id)}</code><strong>${tr("निजी एक्सेस कोड", "Private access code")}</strong><code>${esc(draft.token)}</code>` : `<p class="notice">${tr("ऑनलाइन अनुरोध अभी सुरक्षित नहीं हो सका। WhatsApp पर संदेश भेजकर टीम से रेफरेंस प्राप्त करें।", "Your request could not be saved online. Send the message on WhatsApp and ask the team for a reference.")}</p>`}<div class="result-actions"><a class="btn" href="${esc(whatsapp(bookingWhatsApp(draft)))}" target="_blank" rel="noopener">${tr("WhatsApp पर टीम को भेजें", "Send to our team on WhatsApp")} ↗</a>${draft.id ? `<button class="btn secondary" type="button" id="save-reference">${tr("विवरण डाउनलोड करें", "Download reference")}</button><a class="btn secondary" href="#track" id="view-new-booking">${tr("स्टेटस देखें", "View status")}</a><button class="btn secondary" type="button" id="another-booking">${tr("विवरण सेव करें और नया अनुरोध बनाएँ", "Save details & start another request")}</button>` : ""}</div>`;
}
$("#booking-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  // Keep the saved request visible until the customer explicitly starts another one.
  if (bookingDraft?.id) {
    $("#booking-result").scrollIntoView({ block: "center" });
    return;
  }
  const draft = Object.fromEntries(new FormData(form));
  draft.consent = form.elements.consent.checked;
  const button = $("#submit-booking");
  button.disabled = true;
  message(
    "#booking-message",
    tr("अनुरोध सुरक्षित हो रहा है…", "Saving your request…"),
  );
  try {
    const result = await api("/api/bookings", draft);
    bookingDraft = { ...draft, id: result.booking.id, token: result.token };
    message(
      "#booking-message",
      tr(
        "अब नीचे WhatsApp से टीम को जानकारी भेजें।",
        "Now send the details to our team using WhatsApp below.",
      ),
    );
  } catch (error) {
    bookingDraft = { ...draft };
    message("#booking-message", error.message, true);
  } finally {
    button.disabled = false;
    showBookingResult();
  }
});
// Changing the form after success explicitly prepares a new request, without losing the existing reference silently.
$("#booking-form").addEventListener("input", () => {
  if (bookingDraft?.id)
    message(
      "#booking-message",
      tr(
        "पिछला अनुरोध सुरक्षित है। नए अनुरोध के लिए नीचे “विवरण सेव करें और नया अनुरोध बनाएँ” चुनें।",
        "Your existing request is saved. To create another, use “Save details & start another request” below.",
      ),
    );
});
function renderTracking() {
  const b = currentBooking,
    result = $("#track-result");
  result.hidden = false;
  const paid = b.payment === "paid",
    name =
      catalog?.services.find((s) => s.id === b.serviceId)?.[language] ||
      b.service;
  result.innerHTML = `<h3>${esc(b.id)}</h3><ol class="status-steps">${["requested", "confirmed", "completed"].map((s, i) => `<li class="${b.status !== "cancelled" && ["requested", "confirmed", "completed"].indexOf(b.status) >= i ? "current" : ""}">${statusNames(s)}</li>`).join("")}</ol>${b.status === "cancelled" ? `<p class="error">${statusNames(b.status)}</p>` : ""}<div class="booking-summary"><div><span>${tr("नाम", "Name")}</span><strong>${esc(b.name)}</strong></div><div><span>${tr("सेवा", "Seva")}</span><strong>${esc(name)}</strong></div><div><span>${tr("तारीख", "Date")}</span><strong>${esc(formatDate(b.date))}</strong></div><div><span>${tr("राशि", "Amount")}</span><strong>${b.amount === null ? tr("टीम से तय होगी", "To be confirmed") : money(b.amount)}</strong></div><div><span>${tr("भुगतान", "Payment")}</span><strong class="${paid ? "success" : ""}">${paid ? tr("प्राप्त हुआ", "Received") : tr("प्राप्त नहीं हुआ", "Not received")}</strong></div></div><div class="result-actions">${!paid && b.amount && ["confirmed", "completed"].includes(b.status) && catalog?.paymentReady ? `<button id="pay-now" type="button" class="btn">${tr("सुरक्षित भुगतान करें", "Pay securely")} ↗</button>` : ""}<a class="btn secondary" href="${esc(whatsapp(`${tr("नमस्कार, मेरी बुकिंग के बारे में जानकारी चाहिए। रेफरेंस:", "Namaste, please help me with booking reference:")} ${b.id}`))}" target="_blank" rel="noopener">${tr("टीम से संपर्क करें", "Contact the team")} ↗</a></div>${!paid && !catalog?.paymentReady ? `<p class="small muted">${tr("भुगतान विवरण के लिए टीम से संपर्क करें।", "Contact the team for payment instructions.")}</p>` : ""}${paid ? `<div class="receipt"><h3>Dharmique · ${tr("भुगतान रसीद", "Payment receipt")}</h3><p>${esc(b.name)}<br>${esc(b.id)}<br>${esc(name)}<br>${tr("सेवा तारीख", "Seva date")}: ${esc(formatDate(b.date))}</p><p><strong>${money(b.amount)}</strong> · INR<br>${tr("भुगतान ID", "Payment ID")}: ${esc(b.paymentId)}</p><p class="small">${tr("यह रसीद भुगतान की पुष्टि है। सेवा का वर्तमान स्टेटस ऊपर देखें।", "This receipt confirms payment. See the current seva status above.")}</p></div><button type="button" id="print-receipt" class="btn secondary">${tr("रसीद प्रिंट / PDF", "Print receipt / PDF")}</button>` : ""}`;
}
async function track() {
  message("#track-message", tr("जानकारी मिल रही है…", "Loading your booking…"));
  currentBooking = null;
  $("#track-result").hidden = true;
  try {
    const result = await api("/api/track", credentials);
    currentBooking = result.booking;
    renderTracking();
    message("#track-message", "");
  } catch (error) {
    message("#track-message", error.message, true);
  }
}
$("#track-form").addEventListener("submit", (event) => {
  event.preventDefault();
  credentials = Object.fromEntries(new FormData(event.currentTarget));
  track();
});
let checkoutScript;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;
  checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      checkoutScript = null;
      script.remove();
      reject(
        new Error(
          tr(
            "भुगतान पेज नहीं खुल सका। फिर प्रयास करें।",
            "Could not load checkout. Please try again.",
          ),
        ),
      );
    };
    document.head.append(script);
  });
  return checkoutScript;
}
async function pay() {
  const button = $("#pay-now");
  if (!button) return;
  button.disabled = true;
  try {
    await loadCheckout();
    const order = await api("/api/payments/order", credentials);
    const checkout = new window.Razorpay({
      key: order.key,
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      name: "Dharmique",
      description: currentBooking.id,
      prefill: { name: order.name },
      theme: { color: "#bc4c16" },
      handler: async (response) => {
        try {
          const result = await api("/api/payments/verify", {
            ...credentials,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          currentBooking = result.booking;
          renderTracking();
          message(
            "#track-message",
            tr("भुगतान सत्यापित हो गया।", "Payment verified."),
          );
        } catch (error) {
          message("#track-message", error.message, true);
        }
      },
    });
    checkout.on("payment.failed", () =>
      message(
        "#track-message",
        tr(
          "भुगतान पूरा नहीं हुआ। दोबारा प्रयास करें या टीम से संपर्क करें।",
          "Payment did not complete. Try again or contact the team.",
        ),
        true,
      ),
    );
    checkout.open();
  } catch (error) {
    message("#track-message", error.message, true);
  } finally {
    button.disabled = false;
  }
}
function downloadReference() {
  const content = `Dharmique booking\nReference: ${bookingDraft.id}\nPrivate access code: ${bookingDraft.token}\nService date: ${bookingDraft.date}\nKeep this private. Track your booking on the website.\n`;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = bookingDraft.id + ".txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("click", (event) => {
  const langButton = event.target.closest("[data-lang]");
  if (langButton) {
    language = langButton.dataset.lang;
    translate();
  }
  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    filter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((el) => {
      el.classList.toggle("active", el === filterButton);
      el.setAttribute("aria-pressed", String(el === filterButton));
    });
    render();
  }
  const serviceButton = event.target.closest("[data-service]");
  if (serviceButton) {
    const s = catalog.services.find(
      (s) => s.id === serviceButton.dataset.service && s.available,
    );
    if (!s) {
      alert(
        tr(
          "सेवा अभी उपलब्ध नहीं है।",
          "This service is currently unavailable.",
        ),
      );
      return;
    }
    $("#service").value = s.id;
    if (serviceButton.dataset.date)
      $("#date").value = serviceButton.dataset.date;
    estimate();
    $("#booking").scrollIntoView();
    $("#name").focus({ preventScroll: true });
  }
  if (event.target.closest("#save-reference")) downloadReference();
  if (event.target.closest("#another-booking")) {
    downloadReference();
    bookingDraft = null;
    $("#booking-form").reset();
    $("#booking-result").hidden = true;
    message("#booking-message", "");
    estimate();
    $("#name").focus();
  }
  if (event.target.closest("#view-new-booking")) {
    $("#track-id").value = bookingDraft.id;
    $("#track-token").value = bookingDraft.token;
    credentials = { id: bookingDraft.id, token: bookingDraft.token };
    track();
  }
  if (event.target.closest("#pay-now")) pay();
  if (event.target.closest("#print-receipt")) window.print();
});
$("#service").addEventListener("change", estimate);
$("#date").min = today();
$("#date").max = `${Number(today().slice(0, 4)) + 2}-12-31`;
$("#year").textContent = new Date().getFullYear();
translate();
try {
  catalog = await api("/api/catalog");
} catch {
  try {
    const response = await fetch("assets/catalog.json");
    if (!response.ok) throw new Error();
    catalog = await response.json();
    catalog.paymentReady = false;
  } catch {
    const error = $("#catalog-error");
    error.hidden = false;
    error.textContent = tr(
      "सेवाएँ नहीं खुल सकीं। कृपया WhatsApp पर संपर्क करें।",
      "Could not load services. Please contact us on WhatsApp.",
    );
  }
}
if (catalog) {
  render();
  const serviceId = new URLSearchParams(location.search).get("service");
  if (serviceId) {
    $("#service").value = serviceId;
    estimate();
  }
}
