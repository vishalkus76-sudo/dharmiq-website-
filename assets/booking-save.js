// Connect the redesigned forms to the same private booking store as the admin.
(() => {
  let saving = false;
  let lastDetails;
  let requestId;
  window.saveSevaRequest = async (details, url) => {
    if (saving) return;
    const form = document.getElementById('bookingForm');
    if (!form.reportValidity()) return;
    const english = document.documentElement.lang === 'en';
    const tr = (hi, en) => english ? en : hi;
    let status = document.getElementById('bookingSaveStatus');
    let fallback = document.getElementById('bookingWhatsAppFallback');
    if (!status) {
      status = document.createElement('p');
      status.id = 'bookingSaveStatus';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      fallback = document.createElement('a');
      fallback.id = 'bookingWhatsAppFallback';
      fallback.className = 'btn green';
      fallback.target = '_blank';
      fallback.rel = 'noopener noreferrer';
      form.append(status, fallback);
    }
    fallback.hidden = true;
    fallback.style.display = 'none';
    const signature = JSON.stringify(details);
    if (signature !== lastDetails) {
      requestId = crypto.randomUUID();
      lastDetails = signature;
    }
    const popup = window.open('about:blank', '_blank');
    try { if (popup) popup.opener = null; } catch {}
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
      status.textContent = tr('Request सेव हो गई। WhatsApp में Send दबाएँ।', 'Request saved. Press Send in WhatsApp.');
      if (popup && !popup.closed) popup.location.replace(url);
    } catch {
      try { popup?.close(); } catch {}
      status.textContent = tr(
        'Request सेव होने की पुष्टि नहीं मिली। दोबारा कोशिश करें या नीचे WhatsApp पर भेजें।',
        'We could not confirm your request was saved. Try again or send it on WhatsApp below.',
      );
    } finally {
      fallback.href = url;
      fallback.textContent = tr('WhatsApp खोलें', 'Open WhatsApp');
      fallback.hidden = false;
      fallback.style.display = '';
      controls.forEach((control, i) => { control.disabled = disabled[i]; });
      saving = false;
    }
  };
})();
