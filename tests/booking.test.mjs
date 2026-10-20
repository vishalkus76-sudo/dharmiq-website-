import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bookingMessage,
  whatsappUrl,
  WHATSAPP_NUMBER,
} from "../assets/booking.js";
const catalog = JSON.parse(
  readFileSync(new URL("../assets/catalog.json", import.meta.url)),
);
const service = catalog.services.find((s) => s.id === "small");
const draft = {
  name: " भक्त & परिवार + ",
  phone: "+91 90000 00000",
  date: "2027-01-15",
  gotra: "कश्यप",
  occasion: "birthday",
  notes: "परिवार की सुख-शांति 🙏",
};
test("Hindi form data survives WhatsApp URL encoding and requests UPI details in the chat", () => {
  const text = bookingMessage(draft, service, "hi");
  const url = new URL(whatsappUrl(text));
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/" + WHATSAPP_NUMBER);
  assert.equal(url.searchParams.get("text"), text);
  for (const expected of [
    "भक्त & परिवार +",
    "+91 90000 00000",
    "लघु प्रसादी सेवा",
    "कश्यप",
    "UPI",
  ])
    assert.ok(text.includes(expected));
});
test("Short English messages omit empty gotra and unused draft fields", () => {
  const text = bookingMessage(
    { ...draft, gotra: "", notes: "", occasion: "memory" },
    { ...service, price: null },
    "en",
  );
  assert.ok(text.includes("Small Prasadi Offering"));
  assert.ok(text.includes("Name: भक्त & परिवार +"));
  assert.ok(text.includes("Number: +91 90000 00000"));
  assert.ok(text.includes("share UPI payment details"));
  assert.ok(!text.includes("2027-01-15"));
  assert.ok(!text.includes("memory"));
  assert.ok(!text.includes("₹"));
  assert.ok(!text.includes("Gotra:"));
  assert.ok(!text.includes("Intention:"));
});
