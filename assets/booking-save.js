// Connect both customer forms to the private booking store before opening WhatsApp.
(() => {
  let saving = false;
  let lastDetails;
  let requestId;
  let saved = false;
  let directFallback = false;

  // Native scheme on phones avoids sending customers to WhatsApp Web.
  // Keep a normal web link for desktop users.
  window.sevaWhatsAppDestination = (url) => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (!mobile) return url;
    const link = new URL(url);
    return `whatsapp://send?phone=${link.pathname.slice(1)}&text=${encodeURIComponent(link.searchParams.get('text') || '')}`;
  };
  window.openSevaWhatsApp = (url) => {
    // Stay in the current tab: no empty Chrome tab or popup to intercept the app link.
    window.location.assign(window.sevaWhatsAppDestination(url));
  };

  const form = document.getElementById('bookingForm');
  const prasadi = document.getElementById('prasadiBox');
  const prasadiCost = document.getElementById('prasadiCost');
  window.sevaPrasadiText = () => {
    if (!prasadi.checked) return '';
    const english = document.documentElement.lang === 'en';
    const fee = form.dataset.sevaFee;
    const total = fee === undefined
      ? (english ? 'Total: seva fee + ₹200' : 'कुल: सेवा शुल्क + ₹200')
      : `${english ? 'Total' : 'कुल'}: ₹${Number(fee) + 200}`;
    return `${english ? 'Prasadi box (extra)' : 'प्रसादी बॉक्स (अतिरिक्त)'}: ₹200\n${total}`;
  };
  window.updateSevaPrasadi = () => {
    document.getElementById('prasadiLabel').textContent =
      document.documentElement.lang === 'en'
        ? 'Add a prasadi box — extra ₹200'
        : 'प्रसादी बॉक्स चाहिए — अतिरिक्त ₹200';
    prasadiCost.textContent = window.sevaPrasadiText();
    prasadiCost.hidden = !prasadi.checked;
  };
  prasadi.addEventListener('change', window.updateSevaPrasadi);
  new MutationObserver(window.updateSevaPrasadi).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang'],
  });
  window.updateSevaPrasadi();
  form.addEventListener('input', (event) => {
    event.target.setCustomValidity?.('');
    lastDetails = undefined;
    saved = directFallback = false;
    const status = document.getElementById('bookingSaveStatus');
    if (status) status.textContent = '';
  });
  window.saveSevaRequest = async (details, url) => {
    if (saving) return;
    const english = document.documentElement.lang === 'en';
    const tr = (hi, en) => english ? en : hi;
    const name = document.getElementById('fullName');
    name.setCustomValidity(name.value.trim() ? '' : tr('कृपया नाम भरें।', 'Please enter your name.'));
    if (!form.reportValidity()) return;
    let status = document.getElementById('bookingSaveStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'bookingSaveStatus';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.append(status);
    }
    const signature = JSON.stringify(details);
    if (signature !== lastDetails) {
      requestId = crypto.randomUUID();
      lastDetails = signature;
      saved = directFallback = false;
    }
    // A second tap can launch the app synchronously if a phone blocks navigation
    // after the async save. Reuse the saved request instead of creating a duplicate.
    if (saved || directFallback) {
      window.openSevaWhatsApp(url);
      return;
    }
    const controls = [...form.querySelectorAll('input, textarea, select, button')];
    const disabled = controls.map(control => control.disabled);
    saving = true;
    controls.forEach(control => { control.disabled = true; });
    status.textContent = tr('Request सेव हो रही है…', 'Saving your request…');
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, id: requestId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || (await response.json()).saved !== true) throw new Error('Save failed');
      saved = true;
      status.textContent = tr(
        'Request सेव हो गई। WhatsApp में Send दबाएँ। ऐप न खुले तो इसी हरे बटन को फिर दबाएँ।',
        'Request saved. Press Send in WhatsApp. If the app did not open, tap the same green button again.',
      );
    } catch {
      // Preserve the honest manual WhatsApp fallback using the same single button.
      directFallback = true;
      status.textContent = tr(
        'Request सेव होने की पुष्टि नहीं मिली। सीधे WhatsApp पर पूछताछ के लिए इसी हरे बटन को फिर दबाएँ।',
        'We could not confirm your request was saved. Tap the same green button again to enquire directly on WhatsApp.',
      );
    } finally {
      controls.forEach((control, i) => { control.disabled = disabled[i]; });
      saving = false;
    }
    if (saved) window.openSevaWhatsApp(url);
  };
})();
