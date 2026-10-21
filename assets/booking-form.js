import {
  services,
  priceSummary,
  bookingMessage,
  whatsappUrl,
} from "./booking-message.js";

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
    <p id="seva-save-message" role="status" aria-live="polite"></p>
    <a id="seva-retry" target="_blank" rel="noopener noreferrer" hidden></a>
  </form>`;
document.body.appendChild(dialog);
const $ = (selector) => dialog.querySelector(selector);
const form = $("#seva-form");
const nameInput = $("#seva-name");
const prasadiInput = $("#seva-prasadi");
let selectedService;
let selectedServiceId;
let requestId;
let saving = false;
let draft;
const language = () => (document.documentElement.lang === "en" ? "en" : "hi");
const tr = (hi, en) => (language() === "en" ? en : hi);

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
    "#seva-prasadi-label": [
      "प्रसादी चाहिए — अतिरिक्त ₹200",
      "Add prasadi — extra ₹200",
    ],
    "#seva-skip-gotra": [
      "गोत्र नहीं पता? छोड़ें और WhatsApp पर जाएँ",
      "Don't know your gotra? Skip and open WhatsApp",
    ],
    "#seva-submit": ["WhatsApp पर भेजें", "Send on WhatsApp"],
    "#seva-note": [
      "यह जानकारी booking request के लिए सेव होगी। WhatsApp में Send दबाएँ; पुष्टि और UPI वहीं तय होंगे।",
      "These details will be saved as a booking request. Press Send in WhatsApp; confirmation and UPI payment will be arranged there.",
    ],
    "#seva-retry": [
      "WhatsApp नहीं खुला? यहाँ दबाएँ",
      "WhatsApp did not open? Tap here",
    ],
  };
  for (const [selector, texts] of Object.entries(labels))
    $(selector).textContent = tr(...texts);
  if (saving) $("#seva-submit").textContent = tr("सेव हो रहा है…", "Saving…");
  if (!selectedService) return;
  $("#seva-selected").textContent = selectedService[language()];
  $("#seva-cost").textContent = priceSummary(
    selectedService,
    prasadiInput.checked,
    language(),
  );
  if (draft)
    $("#seva-retry").href = whatsappUrl(
      bookingMessage(draft, selectedService, language()),
    );
}

function openBooking(key) {
  const service = Object.hasOwn(services, key) ? services[key] : null;
  if (!service) return;
  if (saving) return;
  selectedService = service;
  selectedServiceId = key;
  requestId = crypto.randomUUID();
  $("#seva-save-message").textContent = "";
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
  requestId = crypto.randomUUID();
  $("#seva-save-message").textContent = "";
  translate();
});
$("#seva-skip-gotra").addEventListener("click", () => {
  if (saving) return;
  if ($("#seva-gotra").value) requestId = crypto.randomUUID();
  $("#seva-gotra").value = "";
  clearResult();
  form.requestSubmit();
});
function setSaving(value) {
  saving = value;
  for (const control of form.querySelectorAll("input, button"))
    control.disabled = value;
  $("#seva-close").disabled = value;
  translate();
}
dialog.addEventListener("cancel", (event) => {
  if (saving) event.preventDefault();
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving) return;
  nameInput.setCustomValidity(
    nameInput.value.trim()
      ? ""
      : tr("कृपया नाम भरें।", "Please enter your name."),
  );
  if (!form.reportValidity() || !selectedService) return;
  draft = Object.fromEntries(new FormData(form));
  const currentDraft = draft;
  const url = whatsappUrl(
    bookingMessage(currentDraft, selectedService, language()),
  );
  const payload = {
    id: requestId,
    serviceId: selectedServiceId,
    ...currentDraft,
    prasadi: currentDraft.prasadi === "yes",
  };
  const message = $("#seva-save-message");
  message.textContent = "";
  // Open synchronously while user activation is available; navigate after saving.
  const popup = window.open("about:blank", "_blank");
  try {
    if (popup) popup.opener = null;
  } catch {}
  setSaving(true);
  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Booking save failed");
    message.textContent = tr(
      "Request सेव हो गई। WhatsApp में Send दबाएँ; पुष्टि वहीं होगी।",
      "Request saved. Press Send in WhatsApp; confirmation will follow in the chat.",
    );
    $("#seva-retry").href = url;
    $("#seva-retry").hidden = false;
    if (popup && !popup.closed) popup.location.replace(url);
  } catch {
    try {
      popup?.close();
    } catch {}
    // Keep WhatsApp available during an outage; do not claim this request was saved.
    message.textContent = tr(
      "Request सेव होने की पुष्टि नहीं मिली। दोबारा कोशिश करें या नीचे WhatsApp पर भेजें।",
      "We could not confirm your request was saved. Try again or send it on WhatsApp below.",
    );
    $("#seva-retry").href = url;
    $("#seva-retry").hidden = false;
  } finally {
    setSaving(false);
  }
});
new MutationObserver(translate).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"],
});
translate();
