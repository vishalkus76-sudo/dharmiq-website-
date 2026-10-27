import { services, PRASADI_PRICE, priceSummary, whatsappUrl } from './booking-message.js';

const dialog = document.getElementById('jagannathDialog');
const form = document.getElementById('jagannathForm');
const $ = (id) => document.getElementById(id);
const offerings = [
  ['jagannath-five-deep', 'jagannath-five-deep.jpg', '5 दीप श्रृंखला', '5 Deep Offering', '5 दीपों का अर्पण', 'Offer 5 lamps'],
  ['jagannath-eleven-deep', 'jagannath-eleven-deep.jpg', '11 दीप श्रृंखला', '11 Deep Offering', '11 दीपों का अर्पण', 'Offer 11 lamps'],
  ['jagannath-deep-bhog', 'jagannath-deep-bhog.jpg', '21 दीप + भोग श्रृंखला', '21 Deep + Bhog Offering', '21 दीप एवं भोग का अर्पण', 'Offer 21 lamps and bhog'],
];
const copy = {
  hi: {
    kicker: 'कार्तिक मास विशेष', heading: 'श्री जगन्नाथ जी — दीप निवेदन', select: 'सेवा का चयन करें',
    selectHint: 'अपनी श्रद्धा अनुसार एक सेवा चुनें।', back: '← सेवा बदलें', name: 'पूरा नाम', gotra: 'गोत्र (यदि ज्ञात हो)',
    phone: 'मोबाइल नंबर', address: 'पूरा पता (शहर, राज्य और पिन कोड सहित)', prasadi: `प्रसादी बॉक्स चाहिए — अतिरिक्त ₹${PRASADI_PRICE}`,
    book: 'Book Now — WhatsApp पर बुकिंग भेजें →', privacy: 'अनुरोध सेव होने के बाद WhatsApp खुलेगा। वहाँ Send दबाएँ। सेवा और भुगतान की पुष्टि टीम करेगी।',
    saving: 'अनुरोध सेव हो रहा है…', saved: 'अनुरोध सेव हो गया। WhatsApp में Send दबाएँ। ऐप न खुले तो इसी हरे बटन को फिर दबाएँ।',
    failed: 'अनुरोध सेव होने की पुष्टि नहीं मिली। इसी हरे बटन से दोबारा कोशिश करें।', required: 'कृपया यह जानकारी भरें।', close: 'बुकिंग फॉर्म बंद करें',
  },
  en: {
    kicker: 'Kartik Month Special', heading: 'Shri Jagannath Ji — Deep Nivedan', select: 'Choose your seva',
    selectHint: 'Select one offering to continue.', back: '← Change seva', name: 'Full name', gotra: 'Gotra (if known)',
    phone: 'Mobile number', address: 'Full address (including city, state and PIN code)', prasadi: `Add a prasadi box — extra ₹${PRASADI_PRICE}`,
    book: 'Book Now — Send booking on WhatsApp →', privacy: 'Your request is saved before WhatsApp opens. Press Send there. Our team will confirm the seva and payment.',
    saving: 'Saving your request…', saved: 'Request saved. Press Send in WhatsApp. If the app did not open, tap the same green button again.',
    failed: 'We could not confirm your request was saved. Tap the same green button to try again.', required: 'Please fill in this field.', close: 'Close booking form',
  },
};
let selected = '';
let busy = false;
let attempt = {};
let statusKey = '';
let returnFocus;
const language = () => document.documentElement.lang === 'en' ? 'en' : 'hi';
function updateSummary() {
  $('jagannathSelected').textContent = selected ? services[selected][language()] : '';
  $('jagannathTotal').textContent = selected ? priceSummary(services[selected], $('jagannathPrasadi').checked, language()) : '';
}
function translate() {
  const lang = language(), t = copy[lang];
  dialog.querySelectorAll('[data-jcopy]').forEach((el) => { el.textContent = t[el.dataset.jcopy]; });
  $('jagannathClose').ariaLabel = t.close;
  // Preserve selected service and filled fields when the page language changes.
  $('jagannathOptions').replaceChildren(...offerings.map(([id, image, hi, en, hiDetail, enDetail]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jagannath-option';
    button.dataset.service = id;
    button.disabled = busy;
    const img = document.createElement('img'); img.src = image; img.alt = ''; img.width = 265; img.height = 120;
    const title = document.createElement('strong'); title.textContent = lang === 'hi' ? hi : en;
    const detail = document.createElement('span'); detail.textContent = lang === 'hi' ? hiDetail : enDetail;
    const fee = document.createElement('b'); fee.textContent = `₹${services[id].price}`;
    button.append(img, title, detail, fee);
    button.addEventListener('click', () => {
      selected = id; statusKey = ''; $('jagannathStatus').textContent = '';
      $('jagannathSelection').hidden = true; $('jagannathDetails').hidden = false;
      updateSummary(); $('jagannathName').focus();
    });
    return button;
  }));
  $('jagannathStatus').textContent = statusKey ? t[statusKey] : '';
  if (busy) $('jagannathSubmit').textContent = t.saving;
  updateSummary();
}
$('jagannathOpen').addEventListener('click', () => {
  returnFocus = document.activeElement;
  form.reset(); form.querySelectorAll('input,textarea').forEach((el) => el.setCustomValidity(''));
  selected = ''; attempt = {}; statusKey = '';
  $('jagannathSelection').hidden = false; $('jagannathDetails').hidden = true;
  translate(); dialog.showModal();
});
$('jagannathClose').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', () => returnFocus?.focus());
$('jagannathBack').addEventListener('click', () => {
  $('jagannathSelection').hidden = false; $('jagannathDetails').hidden = true;
  dialog.querySelector(`[data-service="${selected}"]`).focus();
});
form.addEventListener('input', (event) => {
  event.target.setCustomValidity?.(''); statusKey = ''; $('jagannathStatus').textContent = ''; updateSummary();
});
new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !selected) return;
  for (const id of ['jagannathName', 'jagannathAddress']) {
    const input = $(id); input.setCustomValidity(input.value.trim() ? '' : copy[language()].required);
  }
  if (!form.reportValidity()) return;
  const data = {
    serviceId: selected, name: $('jagannathName').value.trim(), gotra: $('jagannathGotra').value.trim(),
    phone: $('jagannathPhone').value.trim(), address: $('jagannathAddress').value.trim(), prasadi: $('jagannathPrasadi').checked,
  };
  const signature = JSON.stringify(data);
  if (attempt.signature !== signature) attempt = { signature, id: crypto.randomUUID(), saved: false };
  const service = services[selected], lang = language();
  const message = [
    lang === 'hi' ? 'नमस्ते Dharmique, श्री जगन्नाथ जी की सेवा बुक करनी है:' : 'Hello Dharmique, I would like to book a Shri Jagannath Ji seva:',
    `${lang === 'hi' ? 'सेवा' : 'Seva'}: ${service[lang]}`, `${lang === 'hi' ? 'नाम' : 'Name'}: ${data.name}`,
    `${lang === 'hi' ? 'गोत्र' : 'Gotra'}: ${data.gotra || '-'}`, `${lang === 'hi' ? 'मोबाइल' : 'Phone'}: ${data.phone}`,
    `${lang === 'hi' ? 'पूरा पता' : 'Full address'}: ${data.address}`,
    priceSummary(service, data.prasadi, lang),
    lang === 'hi' ? 'कृपया सेवा की उपलब्धता, तिथि और भुगतान प्रक्रिया की पुष्टि करें।' : 'Please confirm seva availability, date and payment details.',
  ].join('\n');
  const destination = whatsappUrl(message);
  if (attempt.saved) { window.openSevaWhatsApp(destination); return; }
  const controls = [...dialog.querySelectorAll('button,input,textarea')];
  const previous = controls.map((el) => el.disabled);
  busy = true; statusKey = 'saving';
  controls.forEach((el) => { el.disabled = true; });
  $('jagannathStatus').textContent = copy[language()].saving;
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id: attempt.id }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || (await response.json()).saved !== true) throw new Error('Save not confirmed');
    attempt.saved = true; statusKey = 'saved';
  } catch {
    statusKey = 'failed';
  } finally {
    busy = false; controls.forEach((el, i) => { el.disabled = previous[i]; });
    $('jagannathStatus').textContent = copy[language()][statusKey];
  }
  if (attempt.saved) window.openSevaWhatsApp(destination);
});
translate();
