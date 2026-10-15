import SiteFooter from "../components/SiteFooter.jsx";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../services/api.js";
import Navbar from "../components/Navbar.jsx";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyOrders(signal);
      if (!signal?.aborted) setOrders(data.orders || []);
    } catch (err) {
      if (err.name !== "CanceledError") {
        setError(
          err.response?.data?.message || "Failed to load your order history."
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Start the request and expose its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchOrders]);

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

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <Navbar />

      <main className="flex-1 px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-5xl">
          {/* Page Heading */}
          <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-[var(--line)] pb-6">
            <div>
              <p className="eyebrow">Purchase History</p>
              <h1 className="mt-2 font-[var(--display)] text-4xl font-semibold leading-tight sm:text-5xl">
                My <em>Orders</em>.
              </h1>
            </div>

            {!loading && !error && orders.length > 0 && (
              <p className="text-sm font-medium text-[var(--muted)]">
                {orders.length} {orders.length === 1 ? "order" : "orders"} placed
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[var(--coral)] border-t-transparent" />
              <p className="text-lg font-medium text-[var(--muted)]">
                Loading your orders...
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--coral)]/10 text-2xl text-[var(--coral)]">
                ⚠️
              </div>
              <h2 className="font-[var(--display)] text-2xl font-bold text-[var(--ink)]">
                Unable to load orders.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => fetchOrders()}
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--coral)] cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && orders.length === 0 && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--butter)] text-4xl">
                📦
              </div>
              <h2 className="font-[var(--display)] text-3xl font-semibold text-[var(--ink)]">
                You have not placed any orders yet.
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
                Once you complete checkout with Razorpay, your orders will appear here.
              </p>
              <div className="mt-8">
                <Link
                  to="/products"
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--coral)] hover:border-[var(--coral)] shadow-[4px_4px_0_var(--coral)] cursor-pointer"
                >
                  Start Shopping
                </Link>
              </div>
            </div>
          )}

          {/* Orders List */}
          {!loading && !error && orders.length > 0 && (
            <div className="space-y-6">
              {orders.map((order) => (
                <article
                  key={order._id}
                  className="border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-7 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[var(--line)] pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-[var(--display)] text-lg font-bold text-[var(--ink)]">
                          Order #{order._id}
                        </h2>
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Placed on{" "}
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-2 sm:text-right">
                      <span className="text-xs text-[var(--muted)]">Total:</span>
                      <strong className="font-[var(--display)] text-xl font-bold text-[var(--coral)]">
                        ₹{order.totalAmount?.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="py-4 space-y-2.5">
                    {order.items?.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-center justify-between text-xs sm:text-sm text-[var(--muted)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-10 w-10 shrink-0 object-cover border border-[var(--line)] bg-[var(--butter)]"
                            />
                          )}
                          <span className="truncate font-medium text-[var(--ink)]">
                            {item.name}
                          </span>
                          <span className="shrink-0 text-[11px]">× {item.quantity}</span>
                        </div>
                        <span className="shrink-0 font-medium text-[var(--ink)]">
                          ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions & Footer */}
                  <div className="mt-2 pt-4 border-t border-[var(--line)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <p className="text-xs text-[var(--muted)]">
                      Deliver to: <strong>{order.shippingAddress?.fullName}</strong> ({order.shippingAddress?.city})
                    </p>
                    <Link
                      to={`/orders/${order._id}`}
                      className="inline-block border border-[var(--ink)] bg-transparent px-5 py-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                    >
                      View Details →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
};

export default Orders;
