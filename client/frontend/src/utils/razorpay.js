/**
 * Razorpay Script Loader and Checkout Integration
 */

let pendingLoad;
export const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (pendingLoad) return pendingLoad;
  pendingLoad = new Promise((resolve) => {
    const script = document.createElement("script");
    const finish = (loaded) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (!loaded) script.remove();
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), 15000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => finish(Boolean(window.Razorpay));
    script.onerror = () => finish(false);

    document.body.appendChild(script);
  }).finally(() => { pendingLoad = null; });
  return pendingLoad;
};
