import SiteFooter from "../components/SiteFooter.jsx";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts, getCurrentCustomer } from "../services/api.js";
import ProductCard from "../components/ProductCard.jsx";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useWishlistIds } from "../hooks/useWishlistIds.js";

const Home = () => {
  const { user, setUser } = useAuth();
  const wishlistIds = useWishlistIds();
  const [profileError, setProfileError] = useState("");
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    getCurrentCustomer(controller.signal).then(customer => { if (!controller.signal.aborted) setUser(customer); }).catch(error => {
      if (!controller.signal.aborted && error.response?.status !== 401) setProfileError("Unable to refresh your profile. Please try again shortly.");
    });
    return () => controller.abort();
  }, [setUser]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchFeatured = async () => {
      try {
        const data = await getProducts({}, controller.signal);
        if (!controller.signal.aborted) setFeaturedProducts((data.products || []).slice(0, 4));
      } catch (err) {
        if (!controller.signal.aborted) console.error("Failed to load featured products:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchFeatured();
    return () => controller.abort();
  }, []);

  const handleProduct = () => {
    navigate("/products");
  };

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)]">
      <Navbar />

      <div className="px-5 py-14 sm:px-10 lg:px-[7vw]">
        <section className="customer-welcome" aria-label="Customer profile">
          <div><p className="eyebrow">Your ShopKart account</p><h2>Welcome, {user.fullName}</h2></div>
          <dl><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Phone</dt><dd>{user.phone}</dd></div></dl>
          {profileError && <p role="alert">{profileError}</p>}
        </section>
        <section data-reveal className="shop-intro flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Curated for you</p>
            <h1 className="text-5xl leading-[.92] sm:text-7xl">
              Small upgrades.
              <br />
              <em>Big difference.</em>
            </h1>
          </div>
          <div className="flex flex-col items-start gap-4">
            <p>
              Thoughtful things for everyday living, selected with a soft spot for
              good design.
            </p>
            <button
              className="rounded-full border border-[var(--line)] px-5 py-2 transition-colors hover:bg-[var(--butter)] cursor-pointer"
              type="button"
              onClick={handleProduct}
            >
              View all products →
            </button>
          </div>
        </section>

        <div className="shop-toolbar mt-12 flex flex-col items-start justify-between gap-3 border-b border-[var(--line)] pb-4 lg:mt-[72px] lg:flex-row lg:items-center">
          <div className="filter-pills flex max-w-full gap-2 overflow-x-auto">
            <button
              className="active whitespace-nowrap rounded-full px-4 py-2 transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/products")}
            >
              All products
            </button>
            <button
              className="whitespace-nowrap rounded-full px-4 py-2 transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/products?category=Electronics")}
            >
              Electronics
            </button>
            <button
              className="whitespace-nowrap rounded-full px-4 py-2 transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/products?category=Home")}
            >
              Home
            </button>
            <button
              className="whitespace-nowrap rounded-full px-4 py-2 transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/products?category=Fashion")}
            >
              Fashion
            </button>
            <button
              className="whitespace-nowrap rounded-full px-4 py-2 transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/products?category=Books")}
            >
              Books
            </button>
          </div>
          <button
            className="sort-button cursor-pointer"
            type="button"
            onClick={() => navigate("/products")}
          >
            Explore Catalog →
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm font-medium text-[var(--muted)]">
            Loading products...
          </div>
        ) : (
          <section className="product-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} saved={wishlistIds.includes(product._id)} />
            ))}
          </section>
        )}

        <div className="shop-banner mt-16 flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-between">
          <span>Good things, fairly priced.</span>
          <Link to="/products" className="font-bold text-[var(--coral)] hover:underline">
            View full catalogue →
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Home;
