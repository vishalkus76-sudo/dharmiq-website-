import { bookingMessage, whatsappUrl } from "./booking.js";
const $ = (selector) => document.querySelector(selector);
let language = "hi";
try {
  language = localStorage.getItem("dharmique-language") === "en" ? "en" : "hi";
} catch {}
let catalog,
  selectedService = null,
  bookingDraft = null;
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
const dialog = $("#booking");
function message(text = "") {
  $("#booking-message").textContent = text;
}
function updateSelection() {
  if (!selectedService) return;
  $("#selected-service").textContent =
    `${selectedService[language]} · ${selectedService.price === null ? tr("शुल्क WhatsApp पर पूछें", "Ask for a quote on WhatsApp") : money(selectedService.price)}`;
  if (bookingDraft)
    $("#whatsapp-retry").href = whatsappUrl(
      bookingMessage(bookingDraft, selectedService, language),
    );
}
function render() {
  $("#service-list").innerHTML = catalog.services
    .map(
      (s) =>
        `<article class="service-card"><span class="service-icon" aria-hidden="true">${esc(s.icon)}</span><h2>${esc(s[language])}</h2><div class="price">${s.price === null ? tr("शुल्क WhatsApp पर पूछें", "Ask for a quote") : money(s.price)}</div><details class="service-details"><summary>${tr("सेवा की जानकारी", "Seva details")}</summary><p>${esc(s[language === "hi" ? "descriptionHi" : "descriptionEn"])}</p><p>${esc(s[language === "hi" ? "locationHi" : "locationEn"])}</p></details><button class="btn" type="button" data-service="${esc(s.id)}" ${s.available ? "" : "disabled"}>${s.available ? tr("बुक करें", "Book seva") : tr("अभी उपलब्ध नहीं", "Unavailable")} ↗</button></article>`,
    )
    .join("");
  $("#about-copy").textContent = catalog.about[language];
  $("#refund-copy").textContent = catalog.refundPolicy[language];
  $("#team-list").innerHTML = catalog.team
    .map(
      (member) =>
        `<p><strong>${esc(member.name)}</strong> · ${esc(member[language])}</p>`,
    )
    .join("");
  $("#review-list").innerHTML = catalog.reviews
    .filter((r) => r.consent)
    .map(
      (r) => `<blockquote>“${esc(r[language])}” — ${esc(r.name)}</blockquote>`,
    )
    .join("");
  updateSelection();
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
}
function clearResult() {
  bookingDraft = null;
  $("#booking-result").hidden = true;
  message();
}
function openBooking(serviceId) {
  const service = catalog?.services.find(
    (s) => s.id === serviceId && s.available,
  );
  if (!service) return;
  selectedService = service;
  clearResult();
  updateSelection();
  if (!dialog.open) dialog.showModal();
  $("#name").focus({ preventScroll: true });
}
$("#close-booking").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", clearResult);
$("#booking-form").addEventListener("input", (event) => {
  if (event.target.setCustomValidity) event.target.setCustomValidity("");
  clearResult();
});
$("#skip-gotra").addEventListener("click", () => {
  $("#gotra").value = "";
  clearResult();
  $("#booking-form").requestSubmit();
});
$("#booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = $("#name");
  name.setCustomValidity(
    name.value.trim()
      ? ""
      : tr("कृपया अपना नाम भरें।", "Please enter your name."),
  );
  if (!form.reportValidity() || !selectedService) return;
  bookingDraft = Object.fromEntries(new FormData(form));
  const url = whatsappUrl(
    bookingMessage(bookingDraft, selectedService, language),
  );
  $("#whatsapp-retry").href = url;
  $("#booking-result").hidden = false;
  // The visible link also works if the browser blocks the new tab.
  window.open(url, "_blank", "noopener,noreferrer");
});
document.addEventListener("click", (event) => {
  const langButton = event.target.closest("[data-lang]");
  if (langButton) {
    language = langButton.dataset.lang;
    translate();
  }
  const serviceButton = event.target.closest("[data-service]");
  if (serviceButton) openBooking(serviceButton.dataset.service);
});
$("#year").textContent = new Date().getFullYear();
translate();
try {
  const response = await fetch("assets/catalog.json");
  if (!response.ok) throw new Error("Catalog unavailable");
  catalog = await response.json();
  render();
  const serviceId = new URLSearchParams(location.search).get("service");
  if (serviceId) openBooking(serviceId);
} catch {
  $("#catalog-error").hidden = false;
  $("#catalog-error").textContent = tr(
    "सेवा बुक करने के लिए नीचे दिए WhatsApp नंबर पर संपर्क करें।",
    "Please contact the WhatsApp number below to book your seva.",
  );
}
