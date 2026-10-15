import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../services/api.js";
import Navbar from "../components/Navbar.jsx";
import ProductCard from "../components/ProductCard.jsx";
import SearchBar from "../components/SearchBar.jsx";
import { useWishlistIds } from "../hooks/useWishlistIds.js";

const Products = () => {
  const wishlistIds = useWishlistIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const category = searchParams.get("category") || "";
  const setCategory = value => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set("category", value);
    else next.delete("category");
    return next;
  });
  const [sort, setSort] = useState("");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchProductsData = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getProducts(
          { search, category, sort },
          controller.signal
        );
        if (isMounted) {
          setProducts(data.products || []);
        }
      } catch (err) {
        if (err.name !== "CanceledError" && isMounted) {
          setError("Something went wrong while loading products.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProductsData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [search, category, sort]);

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <Navbar />

      <main className="px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-7xl">
          <div data-reveal className="mb-10 flex flex-col justify-between gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">The Collection</p>
              <h1 className="mt-3 font-[var(--display)] text-4xl font-semibold leading-none tracking-tight sm:text-6xl">
                Explore our <em>catalogue</em>.
              </h1>
            </div>
            <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">
              Carefully chosen essentials, electronics, lifestyle and objects for everyday life.
            </p>
          </div>

          <SearchBar
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
          />

          {!loading && !error && (
            <div className="mb-8 flex items-center justify-between text-xs font-bold uppercase tracking-[1.5px] text-[var(--muted)]">
              <span>{products.length} {products.length === 1 ? "product" : "products"}</span>
              <span className="hidden sm:block">Shop the edit</span>
            </div>
          )}

          {loading && (
            <div className="py-24 text-center">
              <p className="text-lg font-medium text-[var(--muted)]">Loading products...</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-24 text-center">
              <p className="text-lg font-medium text-[var(--coral)]">{error}</p>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="py-24 text-center">
              <p className="text-lg font-medium text-[var(--muted)]">No products found.</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} saved={wishlistIds.includes(product._id)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Products;
