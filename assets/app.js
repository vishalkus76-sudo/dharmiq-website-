import { bookingMessage, whatsappUrl as whatsapp } from "./booking.js";
let language = "hi";
try {
  language = localStorage.getItem("dharmique-language") === "en" ? "en" : "hi";
} catch {}
let catalog,
  filter = "all",
  bookingDraft = null;
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
function requestUrl(draft) {
  const service = catalog.services.find((s) => s.id === draft.serviceId);
  return whatsapp(bookingMessage(draft, service, language));
}
function showBookingResult() {
  const result = $("#booking-result");
  result.hidden = false;
  result.innerHTML = `<h3>${tr("WhatsApp में Send दबाएँ", "Press Send in WhatsApp")}</h3><p class="small">${tr("संदेश भेजने के बाद हम उसी चैट में बुकिंग की पुष्टि और UPI भुगतान की जानकारी देंगे।", "After you send your message, we will confirm your booking and share UPI details in the same chat.")}</p><a class="btn" href="${esc(requestUrl(bookingDraft))}" target="_blank" rel="noopener noreferrer">${tr("WhatsApp दोबारा खोलें", "Open WhatsApp again")} ↗</a>`;
}
$("#booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const draft = Object.fromEntries(new FormData(form));
  const service = catalog?.services.find(
    (s) => s.id === draft.serviceId && s.available,
  );
  if (!service) {
    message(
      "#booking-message",
      tr("कृपया उपलब्ध सेवा चुनें।", "Please choose an available seva."),
      true,
    );
    return;
  }
  bookingDraft = draft;
  showBookingResult();
  message(
    "#booking-message",
    tr(
      "WhatsApp खुलने पर संदेश भेजने के लिए Send दबाएँ।",
      "Press Send after WhatsApp opens to send your message.",
    ),
  );
  // Synchronous user-initiated navigation; a visible link remains if a popup is blocked.
  window.open(requestUrl(draft), "_blank", "noopener,noreferrer");
});
$("#booking-form").addEventListener("input", () => {
  bookingDraft = null;
  $("#booking-result").hidden = true;
  message("#booking-message", "");
});
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
});
$("#service").addEventListener("change", estimate);
$("#date").min = today();
$("#date").max = `${Number(today().slice(0, 4)) + 2}-12-31`;
$("#year").textContent = new Date().getFullYear();
translate();
try {
  const response = await fetch("assets/catalog.json");
  if (!response.ok) throw new Error("Catalog unavailable");
  catalog = await response.json();
  render();
  $("#submit-booking").disabled = false;
  const serviceId = new URLSearchParams(location.search).get("service");
  if (catalog.services.some((s) => s.id === serviceId && s.available)) {
    $("#service").value = serviceId;
    estimate();
  }
} catch {
  const error = $("#catalog-error");
  error.hidden = false;
  error.textContent = tr(
    "सेवाएँ नहीं खुल सकीं। कृपया नीचे दिए WhatsApp बटन से संपर्क करें।",
    "Could not load services. Please use the WhatsApp contact button below.",
  );
  message(
    "#booking-message",
    tr(
      "सेवा चुनने के लिए WhatsApp पर संपर्क करें।",
      "Please contact us on WhatsApp to choose your seva.",
    ),
    true,
  );
}
