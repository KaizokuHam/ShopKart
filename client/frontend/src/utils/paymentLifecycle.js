// Keep provider callbacks monotonic: dismiss/failure cannot replace verification.
export function createPaymentLifecycle({ orderId, verify, report, persist, onState, onSuccess }) {
  let phase = "OPEN";
  const change = (next, message = "") => { phase = next; onState({ phase, message, orderId }); };
  const confirm = async payload => {
    change("VERIFYING", "Confirming your payment…");
    persist(payload);
    try {
      const result = await verify(payload);
      if (result.success && result.order?.paymentStatus === "PAID") {
        persist(null);
        change("SUCCESS");
        onSuccess(result.order);
      } else {
        change("PENDING", result.message || "Confirmation is pending. Check again without making another payment.");
      }
    } catch (error) {
      if (error.response?.data?.paymentFailed) {
        persist(null);
        change("FAILED", error.response.data.message);
      } else {
        change("PENDING", error.response?.data?.message || "We could not confirm the payment yet. Retry confirmation; do not pay again.");
      }
    }
  };
  return {
    get phase() { return phase; },
    success: response => {
      if (["VERIFYING", "SUCCESS"].includes(phase)) return;
      return confirm({ shopKartOrderId: orderId, ...response });
    },
    retry: payload => {
      if (!["OPEN", "PENDING"].includes(phase)) return;
      return confirm(payload);
    },
    failure: async response => {
      if (phase !== "OPEN") return;
      const message = response?.error?.description || "Payment failed. Your cart is unchanged. Please try again.";
      change("REPORTING", message);
      try {
        const result = await report(orderId, "FAILED", response?.error?.metadata?.payment_id);
        if (phase !== "REPORTING") return;
        if (result?.order?.paymentStatus === "PAID") {
          persist(null);
          change("SUCCESS");
          onSuccess(result.order);
        } else if (result?.success === false) {
          change("PENDING", result.message || "Payment status is uncertain. Check your order before paying again.");
        } else {
          change("FAILED", message);
        }
      }
      catch { if (phase === "REPORTING") change("PENDING", message + " We could not confirm the result; check your order before paying again."); }
    },
    dismiss: async () => {
      if (phase !== "OPEN") return;
      change("CANCELLED", "Payment was cancelled. Your cart is unchanged.");
      try { await report(orderId, "CANCELLED"); }
      catch { /* The local cancellation remains visible; no cart mutation occurs. */ }
    },
  };
}

export function readPendingPayment(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && ["shopKartOrderId", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"].every(field => typeof value[field] === "string" && value[field]) ? value : null;
  } catch { return null; }
}

export function savePendingPayment(storage, key, payload) {
  try {
    if (payload) storage.setItem(key, JSON.stringify(payload));
    else storage.removeItem(key);
  } catch { /* Confirmation can still be retried in memory when storage is unavailable. */ }
}
