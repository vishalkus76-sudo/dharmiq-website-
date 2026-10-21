export const WHATSAPP_NUMBER = "919555669751";
export const whatsappUrl = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const PRASADI_PRICE = 200;

export function prasadiSummary(draft, service, language = "hi") {
  if (draft.prasadi !== "yes") return [];
  const tr = (hi, en) => (language === "en" ? en : hi);
  const lines = [`${tr("प्रसादी (अतिरिक्त)", "Prasadi add-on")}: ₹${PRASADI_PRICE}`];
  if (service.price === null) {
    lines.push(tr("कुल: सेवा शुल्क + ₹200 (अंतिम राशि WhatsApp पर तय होगी)", "Total: seva fee + ₹200 (final amount confirmed on WhatsApp)"));
  } else {
    lines.unshift(`${tr("सेवा शुल्क", "Seva fee")}: ₹${service.price}`);
    lines.push(`${tr("कुल", "Total")}: ₹${service.price + PRASADI_PRICE}`);
  }
  return lines;
}

export function bookingMessage(draft, service, language = "hi") {
  const tr = (hi, en) => (language === "en" ? en : hi);
  const clean = (value) => String(value || "").trim();
  return [
    tr(
      "नमस्कार Dharmique, मुझे यह सेवा बुक करनी है:",
      "Namaste Dharmique, I would like to book this seva:",
    ),
    `${tr("सेवा", "Seva")}: ${service[language === "en" ? "en" : "hi"]}`,
    `${tr("नाम", "Name")}: ${clean(draft.name)}`,
    `${tr("नंबर", "Number")}: ${clean(draft.phone)}`,
    clean(draft.gotra) ? `${tr("गोत्र", "Gotra")}: ${clean(draft.gotra)}` : "",
    ...prasadiSummary(draft, service, language),
    tr(
      "कृपया बुकिंग की पुष्टि और UPI भुगतान की जानकारी भेजें।",
      "Please confirm my booking and share UPI payment details.",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
