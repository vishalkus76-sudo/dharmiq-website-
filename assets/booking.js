// All requests go to the existing Dharmique WhatsApp number.
export const WHATSAPP_NUMBER = "919555669751";
export const whatsappUrl = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export function bookingMessage(draft, service, language = "hi") {
  const english = language === "en";
  const tr = (hi, en) => (english ? en : hi);
  const occasions = {
    birthday: tr("जन्मदिन", "Birthday"),
    anniversary: tr("वर्षगाँठ", "Anniversary"),
    memory: tr("स्मृति में", "In remembrance"),
    other: tr("अन्य", "Other"),
  };
  const clean = (value) => String(value || "").trim();
  return [
    tr(
      "नमस्कार Dharmique, मुझे यह सेवा बुक करनी है:",
      "Namaste Dharmique, I would like to book this seva:",
    ),
    `${tr("सेवा", "Seva")}: ${service[english ? "en" : "hi"]}`,
    `${tr("नाम", "Name")}: ${clean(draft.name)}`,
    `${tr("WhatsApp नंबर", "WhatsApp number")}: ${clean(draft.phone)}`,
    `${tr("पसंदीदा तारीख", "Preferred date")}: ${clean(draft.date)}`,
    clean(draft.gotra) ? `${tr("गोत्र", "Gotra")}: ${clean(draft.gotra)}` : "",
    occasions[draft.occasion]
      ? `${tr("अवसर", "Occasion")}: ${occasions[draft.occasion]}`
      : "",
    clean(draft.notes)
      ? `${tr("संकल्प", "Intention")}: ${clean(draft.notes)}`
      : "",
    service.price === null
      ? tr("सेवा शुल्क: कृपया बताएं।", "Seva fee: please share a quote.")
      : `${tr("वेबसाइट पर शुल्क", "Listed fee")}: ₹${service.price}`,
    tr(
      "कृपया तारीख, स्थान, सामग्री और अंतिम राशि की पुष्टि करें। पुष्टि के बाद UPI भुगतान का विवरण इसी चैट में भेजें।",
      "Please confirm the date, location, offerings and final amount. After confirmation, share UPI payment details in this chat.",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
