function book(key) {
  window.location.href =
    "index.html?service=" + encodeURIComponent(key) + "#booking";
}

(function () {
  const buttons = document.querySelectorAll(".language-switch button");
  const elements = document.querySelectorAll("[data-hi][data-en]");

  function setLanguage(lang) {
    elements.forEach((el) => {
      el.textContent = el.dataset[lang];
    });
    buttons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.lang === lang),
    );
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("dharmique-language", lang);
    } catch (e) {}
  }

  buttons.forEach((btn) =>
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang)),
  );
  let saved = "hi";
  try {
    saved = localStorage.getItem("dharmique-language") || "hi";
  } catch (e) {}
  setLanguage(saved === "en" ? "en" : "hi");
})();

document
  .querySelectorAll("[data-book]")
  .forEach((button) =>
    button.addEventListener("click", () => book(button.dataset.book)),
  );
(async () => {
  let catalog;
  try {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error();
    catalog = await response.json();
  } catch {
    try {
      const response = await fetch("assets/catalog.json");
      if (!response.ok) throw new Error();
      catalog = await response.json();
    } catch {
      return;
    }
  }
  for (const button of document.querySelectorAll("[data-book]")) {
    const service = catalog.services.find((s) => s.id === button.dataset.book);
    if (!service) {
      button.disabled = true;
      button.closest(".card").querySelector(".price").textContent = "—";
      continue;
    }
    button.disabled = !service.available;
    button.closest(".card").querySelector(".price").textContent =
      service.price === null ? "WhatsApp" : "₹" + service.price;
  }
})();
