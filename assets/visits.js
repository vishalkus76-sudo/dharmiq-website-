// Count one visit per browser tab/day. No customer names, phones or IPs are sent.
try {
  let sessionId = sessionStorage.getItem("dharmique-visit-session");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("dharmique-visit-session", sessionId);
  }
  fetch("/api/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  }).catch(() => {});
} catch {}
