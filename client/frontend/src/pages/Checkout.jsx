import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { createPaymentOrder, verifyPayment, reportPaymentResult } from "../services/api.js";
import { loadRazorpayScript } from "../utils/razorpay.js";
import { createPaymentLifecycle, readPendingPayment, savePendingPayment } from "../utils/paymentLifecycle.js";
import Navbar from "../components/Navbar.jsx";

const Checkout = () => {
  const { user } = useAuth();
  const { cartItems, totalCount, subtotal, confirmPurchase, fetchCart, mutating, loading: cartLoading, error: cartError } = useCart();
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
  });

  // Validation & Submission State
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [blockingOrderId, setBlockingOrderId] = useState(null);
  const recoveryKey = "shopkart-payment:" + user._id;
  const storage = () => { try { return window.sessionStorage; } catch { return null; } };
  const [pendingPayment, setPendingPayment] = useState(() => readPendingPayment(storage(), recoveryKey));
  const [paymentState, setPaymentState] = useState({ phase: "IDLE", message: "" });
  const paymentLifecycle = useRef(null);
  const submittingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const makeLifecycle = orderId => createPaymentLifecycle({
    orderId, verify: verifyPayment, report: reportPaymentResult,
    persist: payload => {
      savePendingPayment(storage(), recoveryKey, payload);
      if (mounted.current) setPendingPayment(payload);
    },
    onState: state => {
      submittingRef.current = ["VERIFYING", "REPORTING"].includes(state.phase);
      if (!mounted.current) return;
      setPaymentState(state);
      setSubmitting(["VERIFYING", "REPORTING"].includes(state.phase));
    },
    onSuccess: order => {
      if (!mounted.current) return;
      if (order.status !== "PAYMENT_REVIEW") confirmPurchase(order);
      fetchCart();
      navigate(`/orders/${order._id}`, { replace: true, state: { isNewOrder: true } });
    },
  });

  const retryConfirmation = async () => {
    if (!pendingPayment || submittingRef.current) return;
    if (!paymentLifecycle.current || ["FAILED", "CANCELLED", "SUCCESS"].includes(paymentLifecycle.current.phase)) {
      paymentLifecycle.current = makeLifecycle(pendingPayment.shopKartOrderId);
    }
    await paymentLifecycle.current.retry(pendingPayment);
  };




  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (checkoutError) {
      setCheckoutError("");
    }
  };

  /**
   * Task 3: Shipping Form Validation
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full Name is required";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      const cleanPhone = formData.phone.trim().replace(/[\s-]/g, "");
      if (!/^[0-9]{10,12}$/.test(cleanPhone)) {
        newErrors.phone = "Phone number must contain 10 to 12 digits";
      }
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = "Address is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = "Pincode is required";
    } else if (!/^[0-9]{6}$/.test(formData.pincode.trim())) {
      newErrors.pincode = "Pincode must contain exactly 6 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle Checkout Submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || pendingPayment || paymentState.phase === "PENDING" || cartLoading || mutating || cartError) return;
    setCheckoutError("");

    if (!validateForm()) {
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      setCheckoutError("Your cart is empty. Please add items before checking out.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setPaymentState({ phase: "OPEN", message: "" });

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) throw new Error("Unable to load Razorpay Checkout. Please try again.");
      // 1. Call backend to create pending ShopKart order and Razorpay order
      const orderRes = await createPaymentOrder({
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        addressLine1: formData.addressLine1.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
      });

      if (!orderRes.success) {
        throw new Error(orderRes.message || "Failed to initiate payment");
      }

      // 2. Load Razorpay script
      const lifecycle = makeLifecycle(orderRes.shopKartOrderId);
      paymentLifecycle.current = lifecycle;

      if (scriptLoaded && window.Razorpay && orderRes.key) {
        // Official Razorpay Checkout Modal
        const options = {
          key: orderRes.key,
          amount: orderRes.amount,
          currency: orderRes.currency || "INR",
          name: "ShopKart",
          description: "ShopKart Order Purchase",
          order_id: orderRes.razorpayOrderId,
          retry: { enabled: false },
          handler: response => lifecycle.success(response),
          prefill: {
            name: formData.fullName,
            contact: formData.phone,
            email: user?.email,
          },
          theme: {
            color: "#173d32",
          },
          modal: {
            ondismiss: () => lifecycle.dismiss(),
          },
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", response => lifecycle.failure(response));
          rzp.open();
        } catch {
          // Report checkout failure without clearing the cart
          throw new Error("Unable to open Razorpay Checkout. Check your connection and try again.");
        }
      } else {
        // Report checkout failure without clearing the cart
        throw new Error("Unable to open Razorpay Checkout. Check your connection and try again.");
      }
    } catch (err) {
      console.error("Checkout initiation error:", err);
      submittingRef.current = false;
      setSubmitting(false);
      setPaymentState({ phase: "IDLE", message: "" });
      setCheckoutError(
        err.response?.data?.message ||
          err.message ||
          "Unable to place order. Please review your cart and try again."
      );
      setBlockingOrderId(err.response?.data?.orderId || null);
    }
  };

  const deliveryFee = 0;
  const orderTotal = subtotal + deliveryFee;

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <Navbar />

      <main className="flex-1 px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-7xl">
          {/* Page Heading */}
          <div className="mb-8 border-b border-[var(--line)] pb-6">
            <Link
              to="/cart"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--coral)] transition-colors mb-2"
            >
              ← Back to Cart
            </Link>
            <h1 className="font-[var(--display)] text-4xl font-semibold leading-tight sm:text-5xl">
              Checkout & <em>Payment</em>.
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Enter delivery address and review items before completing your purchase.
            </p>
          </div>

          {(checkoutError || cartError || (!cartLoading && cartItems.length === 0)) && (
            <div className="mb-8 rounded border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-sm text-[var(--coral)] font-medium">
              ⚠️ {checkoutError || cartError || "Your cart is empty. Add products to continue."}
              {blockingOrderId && <Link className="text-link" to={"/orders/" + blockingOrderId}>View payment that needs assistance</Link>}
            </div>
          )}

          {(paymentState.message || pendingPayment) && (
            <div role="status" className={"payment-result payment-result--" + (pendingPayment ? "pending" : paymentState.phase.toLowerCase())}>
              <strong>{pendingPayment || paymentState.phase === "PENDING" ? "Payment confirmation pending" : paymentState.phase === "CANCELLED" ? "Checkout cancelled" : "Payment unsuccessful"}</strong>
              <p>{paymentState.message || "A previous payment needs confirmation. Check its result before making another payment."}</p>
              {pendingPayment && <button type="button" className="primary-button" disabled={submitting} onClick={retryConfirmation}>{submitting ? "Checking payment…" : "Retry confirmation"}</button>}
              {pendingPayment && <Link className="text-link" to={"/orders/" + pendingPayment.shopKartOrderId}>View order</Link>}
              {!pendingPayment && paymentState.phase === "PENDING" && <Link className="text-link" to={"/orders/" + paymentState.orderId}>View order</Link>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
            {/* Left: Shipping Form (7 cols) */}
            <div className="lg:col-span-7">
              <section className="border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8 shadow-sm">
                <h2 className="font-[var(--display)] text-2xl font-bold text-[var(--ink)] border-b border-[var(--line)] pb-4">
                  1. Shipping Address
                </h2>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="fullName"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                      >
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="e.g. Aarav Sharma"
                        className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                          errors.fullName
                            ? "border-[var(--coral)]"
                            : "border-[var(--line)] focus:border-[var(--coral)]"
                        }`}
                      />
                      {errors.fullName && (
                        <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                      >
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="e.g. 9876543210"
                        className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                          errors.phone
                            ? "border-[var(--coral)]"
                            : "border-[var(--line)] focus:border-[var(--coral)]"
                        }`}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <label
                      htmlFor="addressLine1"
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                    >
                      Street Address *
                    </label>
                    <input
                      type="text"
                      id="addressLine1"
                      name="addressLine1"
                      value={formData.addressLine1}
                      onChange={handleChange}
                      placeholder="e.g. Flat 402, Sunshine Heights, MG Road"
                      className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                        errors.addressLine1
                          ? "border-[var(--coral)]"
                          : "border-[var(--line)] focus:border-[var(--coral)]"
                      }`}
                    />
                    {errors.addressLine1 && (
                      <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                        {errors.addressLine1}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {/* City */}
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                      >
                        City *
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="e.g. Bengaluru"
                        className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                          errors.city
                            ? "border-[var(--coral)]"
                            : "border-[var(--line)] focus:border-[var(--coral)]"
                        }`}
                      />
                      {errors.city && (
                        <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                          {errors.city}
                        </p>
                      )}
                    </div>

                    {/* State */}
                    <div>
                      <label
                        htmlFor="state"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                      >
                        State *
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="e.g. Karnataka"
                        className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                          errors.state
                            ? "border-[var(--coral)]"
                            : "border-[var(--line)] focus:border-[var(--coral)]"
                        }`}
                      />
                      {errors.state && (
                        <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                          {errors.state}
                        </p>
                      )}
                    </div>

                    {/* Pincode */}
                    <div>
                      <label
                        htmlFor="pincode"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)]"
                      >
                        Pincode *
                      </label>
                      <input
                        type="text"
                        id="pincode"
                        name="pincode"
                        maxLength={6}
                        value={formData.pincode}
                        onChange={handleChange}
                        placeholder="6 digits (e.g. 560001)"
                        className={`mt-2 block w-full border bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-colors ${
                          errors.pincode
                            ? "border-[var(--coral)]"
                            : "border-[var(--line)] focus:border-[var(--coral)]"
                        }`}
                      />
                      {errors.pincode && (
                        <p className="mt-1 text-xs text-[var(--coral)] font-medium">
                          {errors.pincode}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-[var(--muted)]">
                      * All fields are required for shipping carrier verification.
                    </p>
                  </div>
                </form>
              </section>
            </div>

            {/* Right: Order Summary & Payment Button (5 cols) */}
            <div className="lg:col-span-5">
              <div className="sticky top-28 border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-7 shadow-sm">
                <h2 className="font-[var(--display)] text-xl font-bold text-[var(--ink)] border-b border-[var(--line)] pb-4">
                  2. Order Summary
                </h2>

                {/* Items Review */}
                <div data-lenis-prevent className="mt-4 max-h-64 overflow-y-auto space-y-3 pr-1 divide-y divide-[var(--line)]">
                  {cartItems.map((item) => (
                    <div
                      key={item.product?._id || item._id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.product?.image}
                          alt={item.product?.name}
                          className="h-12 w-12 shrink-0 object-cover border border-[var(--line)] bg-[var(--butter)]"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--ink)]">
                            {item.product?.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            Qty: {item.quantity} × ₹{item.product?.price?.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-[var(--ink)] shrink-0">
                        ₹{((item.product?.price || 0) * item.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <dl className="mt-6 border-t border-[var(--line)] pt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-[var(--muted)]">
                    <dt>Total Units</dt>
                    <dd className="font-semibold text-[var(--ink)]">{totalCount}</dd>
                  </div>

                  <div className="flex justify-between text-[var(--muted)]">
                    <dt>Subtotal</dt>
                    <dd className="font-semibold text-[var(--ink)]">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </dd>
                  </div>

                  <div className="flex justify-between text-[var(--muted)]">
                    <dt>Shipping</dt>
                    <dd className="font-semibold text-emerald-700">
                      {deliveryFee === 0 ? "FREE" : "₹99"}
                    </dd>
                  </div>

                  <div className="border-t border-[var(--line)] pt-4 flex justify-between items-baseline">
                    <dt className="text-base font-bold text-[var(--ink)]">Order Total</dt>
                    <dd className="font-[var(--display)] text-2xl font-bold text-[var(--coral)]">
                      ₹{orderTotal.toLocaleString("en-IN")}
                    </dd>
                  </div>
                </dl>

                {/* Submit / Pay Button */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || Boolean(pendingPayment) || paymentState.phase === "PENDING" || cartLoading || mutating || Boolean(cartError) || cartItems.length === 0}
                    className="w-full min-h-[52px] bg-[var(--ink)] text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:bg-[var(--coral)] shadow-[4px_4px_0_var(--coral)] cursor-pointer disabled:opacity-75 disabled:cursor-wait"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {paymentState.phase === "VERIFYING" ? "Confirming payment…" : paymentState.phase === "REPORTING" ? "Checking payment result…" : "Opening secure checkout…"}
                      </span>
                    ) : (
                      `Pay ₹${orderTotal.toLocaleString("en-IN")} with Razorpay`
                    )}
                  </button>
                </div>

                <div className="mt-6 border-t border-[var(--line)] pt-4 space-y-2 text-[11px] text-[var(--muted)]">
                  <div className="flex items-center gap-2">
                    <span>💳</span>
                    <span>Razorpay Test Mode standard payment gateway</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🔒</span>
                    <span>Secure payment through Razorpay</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🛡️</span>
                    <span>Availability and prices confirmed at checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export default Checkout;
