export const WHATSAPP_NUMBER = "919555669751";
export const whatsappUrl = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

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
    tr(
      "कृपया बुकिंग की पुष्टि और UPI भुगतान की जानकारी भेजें।",
      "Please confirm my booking and share UPI payment details.",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
