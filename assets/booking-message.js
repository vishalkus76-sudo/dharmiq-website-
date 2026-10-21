export const WHATSAPP_NUMBER = "919555669751";
export const PRASADI_PRICE = 200;
export const services = {
  deepdaan: { hi: "कार्तिक दीपदान सेवा", en: "Kartik Deepdaan Service", price: null },
  ganga: { hi: "देव दीपावली गंगा पूजन एवं दीपदान", en: "Dev Deepawali Ganga Pujan & Deepdaan", price: null },
  marjan: { hi: "पवित्र गंगा/यमुना घाटों का मार्जन", en: "Cleaning of Sacred Ganga/Yamuna Ghats", price: null },
  small: { hi: "लघु प्रसादी सेवा", en: "Small Prasadi Service", price: 51 },
  midday: { hi: "मध्याह्न भोग सेवा", en: "Midday Bhog Service", price: 101 },
  rajbhog: { hi: "राजभोग सेवा", en: "Rajbhog Service", price: 151 },
};

export function priceSummary(service, prasadi, language = "hi") {
  const tr = (hi, en) => language === "en" ? en : hi;
  const lines = [service.price === null
    ? tr("सेवा शुल्क WhatsApp पर तय होगा", "Seva fee will be confirmed on WhatsApp")
    : `${tr("सेवा शुल्क", "Seva fee")}: ₹${service.price}`];
  if (prasadi) lines.push(`${tr("प्रसादी (अतिरिक्त)", "Prasadi add-on")}: ₹${PRASADI_PRICE}`);
  if (service.price !== null) {
    lines.push(`${tr("कुल", "Total")}: ₹${service.price + (prasadi ? PRASADI_PRICE : 0)}`);
  } else if (prasadi) {
    lines.push(tr("कुल: सेवा शुल्क + ₹200", "Total: seva fee + ₹200"));
  }
  return lines.join("\n");
}

export function bookingMessage(draft, service, language = "hi") {
  const tr = (hi, en) => language === "en" ? en : hi;
  const clean = (value) => String(value || "").trim();
  return [
    tr("नमस्कार Dharmique, मुझे यह सेवा बुक करनी है:", "Namaste Dharmique, I would like to book this seva:"),
    `${tr("सेवा", "Seva")}: ${service[language === "en" ? "en" : "hi"]}`,
    `${tr("नाम", "Name")}: ${clean(draft.name)}`,
    `${tr("नंबर", "Number")}: ${clean(draft.phone)}`,
    clean(draft.gotra) ? `${tr("गोत्र", "Gotra")}: ${clean(draft.gotra)}` : "",
    priceSummary(service, draft.prasadi === "yes", language),
    tr("कृपया बुकिंग की पुष्टि और UPI भुगतान की जानकारी भेजें।", "Please confirm my booking and share UPI payment details."),
  ].filter(Boolean).join("\n");
}

export const whatsappUrl = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
