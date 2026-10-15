import SiteFooter from "../components/SiteFooter.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import Navbar from "../components/Navbar.jsx";
import CartItem from "../components/CartItem.jsx";

const Cart = () => {
  const { cartItems, loading, mutating, error, subtotal, totalCount, fetchCart } = useCart();
  const navigate = useNavigate();

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <Navbar />

      <main className="flex-1 px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-7xl">
          {/* Page Heading */}
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Shopping Bag</p>
              <h1 className="mt-2 font-[var(--display)] text-4xl font-semibold leading-tight sm:text-5xl">
                My <em>Cart</em>.
              </h1>
            </div>

            {!loading && !error && cartItems.length > 0 && (
              <p className="text-sm font-medium text-[var(--muted)]">
                {totalCount} {totalCount === 1 ? "item" : "items"} in your cart
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[var(--coral)] border-t-transparent" />
              <p className="text-lg font-medium text-[var(--muted)]">
                Loading your cart...
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
                Unable to load your cart.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-md mx-auto">
                {error}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => fetchCart()}
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--coral)] hover:border-[var(--coral)] cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && cartItems.length === 0 && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--butter)] text-4xl shadow-inner">
                🛒
              </div>
              <h2 className="font-[var(--display)] text-3xl font-semibold text-[var(--ink)]">
                Your cart is empty 🛒
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
                Looks like you haven't added anything yet. Explore our curated selection of essentials and goods.
              </p>
              <div className="mt-8">
                <Link
                  to="/products"
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-all duration-200 hover:bg-[var(--coral)] hover:border-[var(--coral)] shadow-[4px_4px_0_var(--coral)] cursor-pointer"
                >
                  Browse Products
                </Link>
              </div>
            </div>
          )}

          {/* Cart Content: Items List + Order Summary */}
          {!loading && !error && cartItems.length > 0 && (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
              {/* Left Column: Cart Items (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <CartItem key={item.product?._id || item._id} item={item} />
                  ))}
                </div>

                <div className="pt-4 flex justify-between items-center">
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--coral)] transition-colors"
                  >
                    ← Continue Shopping
                  </Link>
                </div>
              </div>

              {/* Right Column: Order Summary (4 cols) */}
              <div className="lg:col-span-4">
                <div className="sticky top-28 border border-[var(--line)] bg-[var(--paper)] p-6 shadow-sm">
                  <h2 className="font-[var(--display)] text-xl font-bold text-[var(--ink)] border-b border-[var(--line)] pb-4">
                    Order Summary
                  </h2>

                  <dl className="mt-5 space-y-3 text-sm">
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
                      <dt>Estimated Delivery</dt>
                      <dd className="font-semibold text-emerald-700">
                        FREE
                      </dd>
                    </div>

                    <div className="flex justify-between text-[var(--muted)]">
                      <dt>Taxes</dt>
                      <dd className="font-medium text-[var(--muted)]">No additional charges</dd>
                    </div>

                    <div className="border-t border-[var(--line)] pt-4 flex justify-between items-baseline">
                      <dt className="text-base font-bold text-[var(--ink)]">Order Total</dt>
                      <dd className="font-[var(--display)] text-2xl font-bold text-[var(--coral)]">
                        ₹{subtotal.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => navigate("/checkout")}
                      disabled={mutating || cartItems.some(item => item.product?.unavailable || item.quantity > (item.product?.stock || 0))}
                      className="w-full min-h-[50px] bg-[var(--ink)] text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:bg-[var(--coral)] shadow-[4px_4px_0_var(--coral)] cursor-pointer"
                    >
                      Proceed to Checkout →
                    </button>
                  </div>

                  <div className="mt-6 pt-5 border-t border-[var(--line)] space-y-2 text-[11px] text-[var(--muted)]">
                    <div className="flex items-center gap-2">
                      <span>🔒</span>
                      <span>Your shopping bag, saved to your account</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span>Availability confirmed at checkout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>✨</span>
                      <span>Good things, delivered to your door</span>
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

export default Cart;
