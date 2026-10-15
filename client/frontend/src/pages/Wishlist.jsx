import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getWishlist } from "../services/api.js";
import Navbar from "../components/Navbar.jsx";
import WishlistCard from "../components/WishlistCard.jsx";

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const invalidateRequests = useCallback(() => { revision.current++; }, []);

  const fetchWishlistData = useCallback(async (signal) => {
    const requestRevision = ++revision.current;
    setLoading(true);
    setError("");

    try {
      const data = await getWishlist(signal);
      if (!signal?.aborted && requestRevision === revision.current) setWishlist(data.wishlist || []);
    } catch (err) {
      if (err.name !== "CanceledError" && requestRevision === revision.current) {
        setError("We couldn't load your wishlist.");
      }
    } finally {
      if (!signal?.aborted && requestRevision === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Start the request and expose its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWishlistData(controller.signal);

    // Also listen for any wishlist update events (e.g. if toggled elsewhere)
    const handleWishlistUpdated = () => {
      fetchWishlistData();
    };
    window.addEventListener("wishlistUpdated", handleWishlistUpdated);

    return () => {
      controller.abort();
      invalidateRequests();
      window.removeEventListener("wishlistUpdated", handleWishlistUpdated);
    };
  }, [fetchWishlistData, invalidateRequests]);

  const handleRemoveItem = (removedId) => {
    setWishlist((prev) => prev.filter((item) => item._id !== removedId));
  };

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <Navbar />

      <main className="px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-7xl">
          {/* Page Heading */}
          <div className="mb-10 flex flex-col justify-between gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Saved Items</p>
              <h1 className="mt-3 font-[var(--display)] text-4xl font-semibold leading-none tracking-tight sm:text-6xl">
                My <em>Wishlist</em>.
              </h1>
            </div>
            {!loading && !error && (
              <p className="text-sm font-medium text-[var(--muted)]">
                {wishlist.length} {wishlist.length === 1 ? "product" : "products"} saved
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--coral)] border-t-transparent" />
              <p className="text-lg font-medium text-[var(--muted)]">
                Loading your wishlist...
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
                Something went wrong.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {error}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => fetchWishlistData()}
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--coral)] hover:border-[var(--coral)] cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && wishlist.length === 0 && (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--butter)] text-3xl">
                ❤️
              </div>
              <h2 className="font-[var(--display)] text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
                Your wishlist is empty
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
                Save products you love and find them here later.
              </p>
              <div className="mt-8">
                <Link
                  to="/products"
                  className="inline-block border border-[var(--ink)] bg-[var(--ink)] px-8 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-200 hover:bg-[var(--coral)] hover:border-[var(--coral)] shadow-[4px_4px_0_var(--coral)] cursor-pointer"
                >
                  Browse Products
                </Link>
              </div>
            </div>
          )}

          {/* Wishlist Grid */}
          {!loading && !error && wishlist.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wishlist.map((product) => (
                <WishlistCard
                  key={product._id}
                  product={product}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Wishlist;
