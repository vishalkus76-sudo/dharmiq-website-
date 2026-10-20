const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let catalog,
  bookings = [];
function message(text, error = false) {
  $("#admin-message").textContent = text;
  $("#admin-message").className = error ? "error" : "success";
}
async function api(path, data) {
  const response = await fetch(
    path,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {},
  );
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      $("#login").hidden = false;
      $("#dashboard").hidden = true;
      $("#logout").hidden = true;
      bookings = [];
      $("#admin-bookings").replaceChildren();
    }
    throw new Error(result.error || "Request failed");
  }
  return result;
}
function field(label, value, bind, type = "text", required = true) {
  const id = "field-" + bind.replace(/\./g, "-");
  return `<div><label for="${id}">${esc(label)}</label>${type === "textarea" ? `<textarea id="${id}" data-bind="${bind}" maxlength="3000" ${required ? "required" : ""}>${esc(value)}</textarea>` : `<input id="${id}" data-bind="${bind}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="1" max="1000000" step="1"' : ""}>`}</div>`;
}
function renderEditor() {
  $("#about-editor").innerHTML =
    field("हिंदी", catalog.about.hi, "about.hi", "textarea") +
    field("English", catalog.about.en, "about.en", "textarea");
  $("#refund-editor").innerHTML =
    field("हिंदी", catalog.refundPolicy.hi, "refundPolicy.hi", "textarea") +
    field("English", catalog.refundPolicy.en, "refundPolicy.en", "textarea");
  $("#services-editor").innerHTML = catalog.services
    .map(
      (s, i) =>
        `<div class="editor-entry"><h3>${esc(s.hi)} <small>(${esc(s.id)})</small></h3><div class="form-grid">${field("नाम / Hindi", s.hi, `services.${i}.hi`)}${field("Name / English", s.en, `services.${i}.en`)}${field("विवरण / Hindi", s.descriptionHi, `services.${i}.descriptionHi`, "textarea")}${field("Description / English", s.descriptionEn, `services.${i}.descriptionEn`, "textarea")}${field("स्थान / Hindi", s.locationHi, `services.${i}.locationHi`)}${field("Location / English", s.locationEn, `services.${i}.locationEn`)}${field("अवधि / Hindi", s.durationHi, `services.${i}.durationHi`)}${field("Timing / English", s.durationEn, `services.${i}.durationEn`)}${field("शुल्क ₹ (खाली = टीम से पूछें)", s.price, `services.${i}.price`, "number", false)}${field("Icon", s.icon, `services.${i}.icon`)}<label class="check"><input type="checkbox" data-bind="services.${i}.available" ${s.available ? "checked" : ""}>सेवा उपलब्ध / Available</label></div></div>`,
    )
    .join("");
  for (const key of ["festivals", "team", "reviews"])
    $("#" + key + "-editor").innerHTML =
      catalog[key]
        .map(
          (item, i) =>
            `<div class="editor-entry"><div class="section-title"><h3>${key === "festivals" ? "Festival" : key === "team" ? "Team member" : "Customer review"} ${i + 1}</h3><button type="button" class="danger" data-remove="${key}" data-index="${i}">Remove</button></div><div class="form-grid">${key !== "festivals" ? field("नाम / Name", item.name, `${key}.${i}.name`) : ""}${field(key === "festivals" ? "पर्व का नाम / Hindi" : "विवरण / Hindi", item.hi, `${key}.${i}.hi`, key === "festivals" ? "text" : "textarea")}${field(key === "festivals" ? "Festival name / English" : "Description / English", item.en, `${key}.${i}.en`, key === "festivals" ? "text" : "textarea")}${key === "festivals" ? field("पर्व तारीख / Festival date", item.date, `${key}.${i}.date`, "date") + field("अनुरोध की अंतिम तारीख / Deadline", item.deadline, `${key}.${i}.deadline`, "date") + `<div><label for="festival-service-${i}">सेवा / Service</label><select id="festival-service-${i}" data-bind="festivals.${i}.serviceId">${catalog.services.map((s) => `<option value="${esc(s.id)}" ${s.id === item.serviceId ? "selected" : ""}>${esc(s.hi)}</option>`).join("")}</select></div>` : ""}${key === "reviews" ? `<label class="check"><input type="checkbox" data-bind="reviews.${i}.consent" ${item.consent ? "checked" : ""} required>ग्राहक ने नाम और review प्रकाशित करने की अनुमति दी है। / Customer consent obtained.</label>` : ""}</div></div>`,
        )
        .join("") ||
      '<p class="small muted">अभी कोई जानकारी नहीं जोड़ी गई। / Nothing added yet.</p>';
}
function renderBookings() {
  const query = $("#booking-search").value.trim().toLowerCase();
  const visible = bookings.filter((b) =>
    [b.id, b.name].some((x) => x.toLowerCase().includes(query)),
  );
  $("#booking-count").textContent =
    `${visible.length} bookings shown (latest 1000)`;
  $("#admin-bookings").innerHTML =
    visible
      .map(
        (b) =>
          `<form class="booking-entry" data-booking="${esc(b.id)}"><h3>${esc(b.name)} · ${esc(b.id)}</h3><p class="small">${esc(b.service_name)} · ${esc(b.date)}<br>Phone: ${esc(b.phone)} · Gotra: ${esc(b.gotra || "—")} · Occasion: ${esc(b.occasion || "—")}<br>Created: ${esc(b.created_at)}<br>Payment: <strong>${esc(b.payment)}</strong></p><p class="small">${esc(b.notes)}</p><div class="form-grid"><div><label for="status-${b.id}">Status</label><select id="status-${b.id}" name="status">${["requested", "confirmed", "completed", "cancelled"].map((s) => `<option ${b.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div><label for="amount-${b.id}">Agreed amount ₹ (blank = undecided)</label><input id="amount-${b.id}" name="amount" type="number" min="1" max="1000000" step="1" value="${esc(b.amount)}"></div></div><button type="submit" class="btn secondary small-button">Save booking</button><span class="small" role="status"></span></form>`,
      )
      .join("") || "<p>No bookings found. / कोई बुकिंग नहीं मिली।</p>";
}
async function load() {
  const [b, c] = await Promise.all([
    api("/api/admin/bookings"),
    api("/api/catalog"),
  ]);
  bookings = b.bookings;
  catalog = c;
  delete catalog.paymentReady;
  $("#login").hidden = true;
  $("#dashboard").hidden = false;
  $("#logout").hidden = false;
  renderBookings();
  renderEditor();
}
$("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/admin/login", { password: $("#password").value });
    $("#password").value = "";
    await load();
    message("Signed in. / लॉगिन हो गया।");
  } catch (error) {
    message(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", {});
    location.reload();
  } catch (error) {
    message(error.message, true);
  }
});
$("#refresh").addEventListener("click", async () => {
  try {
    const result = await api("/api/admin/bookings");
    bookings = result.bookings;
    renderBookings();
    message("Bookings refreshed.");
  } catch (error) {
    message(error.message, true);
  }
});
$("#booking-search").addEventListener("input", renderBookings);
$("#content-tab").addEventListener("input", (event) => {
  const bind = event.target.dataset.bind;
  if (!bind) return;
  const keys = bind.split(".");
  let obj = catalog;
  for (const key of keys.slice(0, -1)) obj = obj[key];
  const key = keys.at(-1);
  obj[key] =
    event.target.type === "checkbox"
      ? event.target.checked
      : event.target.type === "number"
        ? event.target.value === ""
          ? null
          : Number(event.target.value)
        : event.target.value;
});
$("#content-tab").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#save-content").disabled = true;
  $("#content-message").textContent = "Saving…";
  try {
    await api("/api/admin/catalog", catalog);
    $("#content-message").className = "success";
    $("#content-message").textContent =
      "Saved. Website par refresh karke dekhein. / Refresh the website to see changes.";
  } catch (error) {
    $("#content-message").className = "error";
    $("#content-message").textContent = error.message;
  } finally {
    $("#save-content").disabled = false;
  }
});
$("#admin-bookings").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector("button"),
    status = form.querySelector("[role=status]");
  button.disabled = true;
  try {
    const value = form.elements.amount.value;
    await api("/api/admin/booking", {
      id: form.dataset.booking,
      status: form.elements.status.value,
      amount: value === "" ? null : Number(value),
    });
    status.textContent = " Saved ✓";
    status.className = "small success";
    const b = bookings.find((b) => b.id === form.dataset.booking);
    b.status = form.elements.status.value;
    b.amount = value === "" ? null : Number(value);
  } catch (error) {
    status.textContent = error.message;
    status.className = "small error";
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    $("#bookings-tab").hidden = tab.dataset.tab !== "bookings";
    $("#content-tab").hidden = tab.dataset.tab !== "content";
    document
      .querySelectorAll("[data-tab]")
      .forEach((el) => el.classList.toggle("active", el === tab));
  }
  const add = event.target.closest("[data-add]");
  if (add) {
    const key = add.dataset.add;
    catalog[key].push(
      key === "festivals"
        ? {
            hi: "",
            en: "",
            date: "",
            deadline: "",
            serviceId: catalog.services[0].id,
          }
        : key === "reviews"
          ? { name: "", hi: "", en: "", consent: false }
          : { name: "", hi: "", en: "" },
    );
    renderEditor();
    $("#" + key + "-editor").lastElementChild.scrollIntoView({
      block: "center",
    });
  }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    catalog[remove.dataset.remove].splice(Number(remove.dataset.index), 1);
    renderEditor();
  }
});
try {
  await load();
} catch (error) {
  if (error.message !== "Please sign in.")
    message(
      "Backend उपलब्ध होना चाहिए। / Start the Node server to use this dashboard. " +
        error.message,
      true,
    );
}
