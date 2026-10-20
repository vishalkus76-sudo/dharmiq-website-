// Synthetic Razorpay contract fixture. This never contacts a payment provider.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith("https://api.razorpay.com/v1/"))
    return originalFetch(url, options);
  if (String(url).endsWith("/orders")) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    const order = JSON.parse(options.body);
    return Response.json({
      id: "order_" + order.receipt,
      amount: order.amount,
      currency: "INR",
    });
  }
  const id = String(url).split("/").at(-1);
  if (id.startsWith("pay_")) {
    const parts = id.split("_");
    return Response.json({
      id,
      order_id: "order_" + parts[1],
      amount: id.endsWith("_wrong") ? 1 : 5100,
      currency: "INR",
      status: id.endsWith("_pending") ? "authorized" : "captured",
    });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
};
