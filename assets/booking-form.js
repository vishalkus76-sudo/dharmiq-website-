import { services, priceSummary, bookingMessage, whatsappUrl } from "./booking-message.js";

const dialog = document.createElement("dialog");
dialog.id = "seva-booking";
dialog.setAttribute("aria-labelledby", "seva-booking-title");
dialog.innerHTML = `
  <div class="seva-dialog-top">
    <h2 id="seva-booking-title"></h2>
    <button id="seva-close" type="button" aria-label="बंद करें / Close">×</button>
  </div>
  <p id="seva-selected"></p>
  <form id="seva-form">
    <label for="seva-name" id="seva-name-label"></label>
    <input id="seva-name" name="name" required maxlength="100" autocomplete="name">
    <label for="seva-phone" id="seva-phone-label"></label>
    <input id="seva-phone" name="phone" type="tel" required maxlength="20" autocomplete="tel" pattern="\\+?[0-9][0-9 \\(\\)\\-]{6,19}">
    <label for="seva-gotra" id="seva-gotra-label"></label>
    <input id="seva-gotra" name="gotra" maxlength="100">
    <label class="seva-prasadi" for="seva-prasadi">
      <input id="seva-prasadi" name="prasadi" type="checkbox" value="yes">
      <span id="seva-prasadi-label"></span>
    </label>
    <p id="seva-cost" aria-live="polite"></p>
    <button id="seva-skip-gotra" class="seva-skip" type="button"></button>
    <button id="seva-submit" type="submit"></button>
    <p id="seva-note"></p>
    <a id="seva-retry" target="_blank" rel="noopener noreferrer" hidden></a>
  </form>`;
document.body.appendChild(dialog);
const $ = (selector) => dialog.querySelector(selector);
const form = $("#seva-form");
const nameInput = $("#seva-name");
const prasadiInput = $("#seva-prasadi");
let selectedService;
let draft;
const language = () => document.documentElement.lang === "en" ? "en" : "hi";
const tr = (hi, en) => language() === "en" ? en : hi;

function clearResult() {
  draft = null;
  $("#seva-retry").hidden = true;
  $("#seva-retry").removeAttribute("href");
}
function translate() {
  const labels = {
    "#seva-booking-title": ["सेवा बुक करें", "Book your seva"],
    "#seva-name-label": ["नाम *", "Name *"],
    "#seva-phone-label": ["नंबर *", "Number *"],
    "#seva-gotra-label": ["गोत्र (यदि पता हो)", "Gotra (if known)"],
    "#seva-prasadi-label": ["प्रसादी चाहिए — अतिरिक्त ₹200", "Add prasadi — extra ₹200"],
    "#seva-skip-gotra": ["गोत्र नहीं पता? छोड़ें और WhatsApp पर जाएँ", "Don't know your gotra? Skip and open WhatsApp"],
    "#seva-submit": ["WhatsApp पर भेजें", "Send on WhatsApp"],
    "#seva-note": ["WhatsApp खुलने पर Send दबाएँ। पुष्टि और UPI की जानकारी वहीं मिलेगी।", "Press Send in WhatsApp. Booking confirmation and UPI details will be shared there."],
    "#seva-retry": ["WhatsApp नहीं खुला? यहाँ दबाएँ", "WhatsApp did not open? Tap here"],
  };
  for (const [selector, texts] of Object.entries(labels)) $(selector).textContent = tr(...texts);
  if (!selectedService) return;
  $("#seva-selected").textContent = selectedService[language()];
  $("#seva-cost").textContent = priceSummary(selectedService, prasadiInput.checked, language());
  if (draft) $("#seva-retry").href = whatsappUrl(bookingMessage(draft, selectedService, language()));
}

function openBooking(key) {
  const service = Object.hasOwn(services, key) ? services[key] : null;
  if (!service) return;
  selectedService = service;
  prasadiInput.checked = false;
  clearResult();
  translate();
  if (!dialog.open) dialog.showModal();
  nameInput.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-book]");
  if (button) openBooking(button.dataset.book);
});
$("#seva-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", clearResult);
form.addEventListener("input", (event) => {
  event.target.setCustomValidity?.("");
  clearResult();
  translate();
});
$("#seva-skip-gotra").addEventListener("click", () => {
  $("#seva-gotra").value = "";
  clearResult();
  form.requestSubmit();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  nameInput.setCustomValidity(nameInput.value.trim() ? "" : tr("कृपया नाम भरें।", "Please enter your name."));
  if (!form.reportValidity() || !selectedService) return;
  draft = Object.fromEntries(new FormData(form));
  const url = whatsappUrl(bookingMessage(draft, selectedService, language()));
  $("#seva-retry").href = url;
  $("#seva-retry").hidden = false;
  window.open(url, "_blank", "noopener,noreferrer");
});
new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
translate();
