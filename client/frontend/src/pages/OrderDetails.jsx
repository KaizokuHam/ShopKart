import SiteFooter from "../components/SiteFooter.jsx";
import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { getOrderById, updateOrderStatus, reconcileOrder, retryFulfillment } from "../services/api.js";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

const OrderDetails = ({ isSuccessScreen = false }) => {
  const { user } = useAuth();
  const { fetchCart, confirmPurchase } = useCart();
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  const checkPayment = async () => {
    if (checkingPayment) return;
    setCheckingPayment(true);
    try {
      const result = await reconcileOrder(id);
      if (result.order) setOrder(result.order);
      setPaymentMessage(result.message || "Payment status updated.");
      if (result.order?.paymentStatus === "PAID") {
        if (result.order.status !== "PAYMENT_REVIEW") confirmPurchase(result.order);
        fetchCart();
      }
    } catch (error) {
      setPaymentMessage(error.response?.data?.message || "Unable to check payment. Please try again shortly.");
    } finally { setCheckingPayment(false); }
  };
  const retryStock = async () => {
    if (checkingPayment) return;
    setCheckingPayment(true);
    try {
      const result = await retryFulfillment(id);
      setOrder(result.order);
      setPaymentMessage(result.message);
    } catch (error) { setPaymentMessage(error.response?.data?.message || "Unable to retry fulfilment."); }
    finally { setCheckingPayment(false); }
  };

  const isNew = isSuccessScreen || Boolean(location.state?.isNewOrder);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getOrderById(id, controller.signal);
        if (isMounted) {
          setOrder(data.order || data);
        }
      } catch (err) {
        if (err.name !== "CanceledError" && isMounted) {
          setError(
            err.response?.data?.message || "Failed to load order details."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);

  const handleProgressStatus = async (nextStatus) => {
    if (!order || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(order._id, nextStatus);
      if (res.success && res.order) {
        setOrder(res.order);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PLACED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CONFIRMED":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "SHIPPED":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const stages = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"];

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <Navbar />

      <main className="flex-1 px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-4xl">
          {/* Navigation / Back */}
          <div className="mb-6 flex justify-between items-center">
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--coral)] transition-colors"
            >
              ← Back to My Orders
            </Link>
            <Link
              to="/products"
              className="text-xs font-bold uppercase tracking-wider text-[var(--coral)] hover:underline"
            >
              Continue Shopping →
            </Link>
          </div>

          {loading && (
            <div className="py-28 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[var(--coral)] border-t-transparent" />
              <p className="text-lg font-medium text-[var(--muted)]">
                Loading order details...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--coral)]/10 text-2xl text-[var(--coral)]">
                ⚠️
              </div>
              <h2 className="font-[var(--display)] text-2xl font-bold text-[var(--ink)]">
                Order not found or inaccessible.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
              <div className="mt-6">
                <Link
                  to="/orders"
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--coral)]"
                >
                  View All Orders
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && order && (
            <div className="space-y-8">
              {order.paymentStatus !== "PAID" && (
                <div className={"payment-result payment-result--" + (order.paymentStatus === "FAILED" ? "failed" : "pending")} role="status">
                  <strong>{order.paymentStatus === "FAILED" ? "Payment unsuccessful" : order.paymentAttemptStatus === "CANCELLED" ? "Checkout cancelled" : "Payment confirmation pending"}</strong>
                  <p>{order.lastPaymentError || "This order has not been confirmed. Return to checkout to check your payment result."}</p>
                  <button className="primary-button" type="button" onClick={checkPayment} disabled={checkingPayment}>{checkingPayment ? "Checking payment…" : "Check payment status"}</button>
                  <Link className="text-link" to="/checkout">Return to checkout</Link>
                </div>
              )}
              {/* Celebration Banner for New Orders */}
              {paymentMessage && <p role="status">{paymentMessage}</p>}
              {order.status === "PAYMENT_REVIEW" && <div className="payment-result payment-result--pending" role="status"><strong>Payment received · order needs assistance</strong><p>{order.lastPaymentError}</p><p>Keep your order reference below when contacting the store. Your payment is recorded; do not pay again.</p>{user?.isAdmin && <button type="button" className="primary-button" onClick={retryStock} disabled={checkingPayment}>{checkingPayment ? "Checking stock…" : "Retry fulfilment after restocking"}</button>}</div>}
              {isNew && order.paymentStatus === "PAID" && order.status !== "PAYMENT_REVIEW" && (
                <div className="border border-emerald-300 bg-emerald-50/80 p-6 sm:p-8 rounded shadow-sm text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                    ✓
                  </div>
                  <h1 className="font-[var(--display)] text-3xl font-bold text-emerald-950 sm:text-4xl">
                    Order Placed Successfully!
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-sm text-emerald-800 leading-relaxed">
                    Thank you for your purchase. Your payment was verified, your purchased quantities have been removed from the bag, and your items are being prepared.
                  </p>
                  <p className="mt-3 font-mono text-xs text-emerald-900 font-semibold">
                    Order Reference: #{order._id}
                  </p>
                </div>
              )}

              {/* Order Header Card */}
              <div className="border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--line)] pb-5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[var(--muted)]">
                      Order Details
                    </span>
                    <h2 className="font-[var(--display)] text-2xl font-bold text-[var(--ink)] mt-0.5">
                      Order #{order._id}
                    </h2>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Placed on{" "}
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusBadge(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                    <span className={"inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider " + (order.paymentStatus === "PAID" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : order.paymentStatus === "FAILED" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800")}>
                      Payment: {order.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Status Progression Tracker (Bonus Challenge) */}
                <div className="py-6 border-b border-[var(--line)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-3">
                    Order Progress Tracker
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {stages.map((st, idx) => {
                      const currentIdx = stages.indexOf(order.status);
                      const isComplete = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div key={st} className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                              isComplete
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-gray-300 bg-white text-gray-400"
                            }`}
                          >
                            {isComplete ? "✓" : idx + 1}
                          </div>
                          <span
                            className={`mt-2 font-bold text-[11px] uppercase tracking-wider ${
                              isCurrent
                                ? "text-[var(--coral)]"
                                : isComplete
                                ? "text-emerald-800"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            {st}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Operator fulfilment progression */}
                  {user?.isAdmin && <div className="mt-4 flex flex-wrap items-center justify-end gap-2 pt-2 text-xs">
                    <span className="text-[11px] text-[var(--muted)] font-medium mr-1">
                      Order status:
                    </span>
                    {order.status === "PLACED" && (
                      <button
                        type="button"
                        onClick={() => handleProgressStatus("CONFIRMED")}
                        disabled={updatingStatus}
                        className="rounded border border-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                      >
                        Advance to Confirmed →
                      </button>
                    )}
                    {order.status === "CONFIRMED" && (
                      <button
                        type="button"
                        onClick={() => handleProgressStatus("SHIPPED")}
                        disabled={updatingStatus}
                        className="rounded border border-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                      >
                        Advance to Shipped →
                      </button>
                    )}
                    {order.status === "SHIPPED" && (
                      <button
                        type="button"
                        onClick={() => handleProgressStatus("DELIVERED")}
                        disabled={updatingStatus}
                        className="rounded border border-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                      >
                        Advance to Delivered →
                      </button>
                    )}
                    {order.status === "DELIVERED" && (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Package Delivered 🎉
                      </span>
                    )}
                  </div>}
                </div>

                {/* Ordered Items List */}
                <div className="py-6 border-b border-[var(--line)]">
                  <h3 className="font-[var(--display)] text-base font-bold text-[var(--ink)] mb-4">
                    Items Purchased ({order.items?.length})
                  </h3>
                  <div className="divide-y divide-[var(--line)]">
                    {order.items?.map((item) => (
                      <div
                        key={item._id}
                        className="py-3.5 first:pt-0 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-14 w-14 shrink-0 object-cover border border-[var(--line)] bg-[var(--butter)]"
                            />
                          ) : (
                            <div className="h-14 w-14 shrink-0 bg-[var(--butter)] flex items-center justify-center text-xs font-bold text-[var(--muted)]">
                              Item
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              to={`/products/${item.product}`}
                              className="font-semibold text-sm text-[var(--ink)] hover:text-[var(--coral)] transition-colors block truncate"
                            >
                              {item.name}
                            </Link>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                              Unit price: ₹{item.price?.toLocaleString("en-IN")} × {item.quantity}
                            </p>
                          </div>
                        </div>

                        <span className="font-bold text-sm text-[var(--ink)] shrink-0">
                          ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Details Grid: Address + Financial Breakdown */}
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
                  {/* Shipping Address */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
                      Shipping Details
                    </h4>
                    <div className="rounded bg-white p-4 border border-[var(--line)] space-y-1 text-xs leading-relaxed text-[var(--ink)]">
                      <p className="font-bold text-sm">{order.shippingAddress?.fullName}</p>
                      <p className="text-[var(--muted)]">{order.shippingAddress?.phone}</p>
                      <p>{order.shippingAddress?.addressLine1}</p>
                      <p>
                        {order.shippingAddress?.city}, {order.shippingAddress?.state} -{" "}
                        {order.shippingAddress?.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
                      Payment Breakdown
                    </h4>
                    <div className="rounded bg-white p-4 border border-[var(--line)] space-y-2 text-xs text-[var(--ink)]">
                      <div className="flex justify-between text-[var(--muted)]">
                        <span>Items Subtotal:</span>
                        <span className="font-semibold text-[var(--ink)]">
                          ₹{order.totalAmount?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--muted)]">
                        <span>Delivery Fee:</span>
                        <span className="font-semibold text-emerald-700">
                          FREE
                        </span>
                      </div>
                      <div className="border-t border-[var(--line)] pt-2 flex justify-between font-bold text-sm text-[var(--ink)]">
                        <span>{order.paymentStatus === "PAID" ? "Total Paid:" : "Order Total:"}</span>
                        <span className="text-[var(--coral)] font-[var(--display)] text-base">
                          ₹{order.totalAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="pt-2 text-[10px] text-[var(--muted)] font-mono">
                        <div>Razorpay Order: {order.razorpayOrderId || "N/A"}</div>
                        <div>Payment ID: {order.razorpayPaymentId || "N/A"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
};

export default OrderDetails;
