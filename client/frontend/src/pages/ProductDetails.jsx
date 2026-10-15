import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getProductById, toggleWishlist } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import Navbar from "../components/Navbar.jsx";
import { useWishlistIds } from "../hooks/useWishlistIds.js";

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const wishlistIds = useWishlistIds();
  const { addToCart, getItemQuantity, getItemAction } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartFeedback, setCartFeedback] = useState("");
  const [cartFeedbackType, setCartFeedbackType] = useState("");
  const isWishlisted = wishlistIds.includes(product?._id);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getProductById(id, controller.signal);
        if (isMounted) {
          setProduct(data);
        }
      } catch (err) {
        if (err.name !== "CanceledError" && isMounted) {
          if (err.response && err.response.status === 404) {
            setError("Product not found.");
          } else {
            setError("Something went wrong while loading the product.");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);


  const handleWishlistToggle = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (wishlistLoading || !product) return;

    setWishlistLoading(true);
    setWishlistFeedback("");
    try {
      const res = await toggleWishlist(product._id);
      const nextSaved = res.saved !== undefined ? res.saved : !isWishlisted;
      setWishlistFeedback(
        nextSaved ? "♥ Added to Wishlist" : "Removed from Wishlist"
      );
      window.dispatchEvent(
        new CustomEvent("wishlistUpdated", {
          detail: { productId: product._id, saved: nextSaved, userId: user._id },
        })
      );
      setTimeout(() => setWishlistFeedback(""), 2500);
    } catch {
      setWishlistFeedback("Unable to save product. Please try again.");
      setTimeout(() => setWishlistFeedback(""), 3500);
    } finally {
      setWishlistLoading(false);
    }
  };

  const currentCartQty = product ? getItemQuantity(product._id) : 0;
  const isInCart = currentCartQty > 0;
  const isOutOfStock = (product?.stock || 0) <= 0;
  const isAtMaxInCart = currentCartQty >= (product?.stock || 0);
  const isAddingToCart = product ? getItemAction(product._id) === "adding" : false;

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!product || isAddingToCart || isOutOfStock || isAtMaxInCart) return;

    setCartFeedback("");
    try {
      await addToCart(product._id);
      setCartFeedback("Product added to your cart! 🛒");
      setCartFeedbackType("success");
      setTimeout(() => setCartFeedback(""), 3000);
    } catch (err) {
      setCartFeedback(err.message || "Failed to add to cart");
      setCartFeedbackType("error");
      setTimeout(() => setCartFeedback(""), 4000);
    }
  };

  return (
    <div className="commerce-page route-enter min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <Navbar />

      <main className="px-5 py-10 sm:px-10 lg:px-[7vw]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--coral)]"
            >
              ← Back to products
            </Link>
          </div>

          {loading && (
            <div className="py-32 text-center">
              <p className="text-lg font-medium text-[var(--muted)]">Loading product...</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-32 text-center">
              <p className="text-lg font-medium text-[var(--coral)]">{error}</p>
              <div className="mt-6">
                <Link
                  to="/products"
                  className="inline-block border border-[var(--ink)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors"
                >
                  Return to Products
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && !product && (
            <div className="py-32 text-center">
              <p className="text-lg font-medium text-[var(--muted)]">Product not found.</p>
            </div>
          )}

          {!loading && !error && product && (
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Product Image */}
              <div className="overflow-hidden border border-[var(--line)] bg-[var(--butter)]">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-auto w-full object-cover max-h-[580px]"
                />
              </div>

              {/* Product Details */}
              <div className="flex flex-col justify-center">
                <p className="eyebrow">{product.category}</p>

                <h1 className="mt-3 font-[var(--display)] text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl">
                  {product.name}
                </h1>

                <div className="mt-5 flex items-baseline gap-4">
                  <span className="text-3xl font-bold text-[var(--coral)]">
                    ₹{product.price?.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Inclusive of all taxes
                  </span>
                </div>

                <div className="mt-6 border-t border-b border-[var(--line)] py-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Description
                  </h2>
                  <p className="mt-2 text-base leading-7 text-[var(--muted)]">
                    {product.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      product.stock > 0 ? "bg-[var(--green)]" : "bg-[var(--coral)]"
                    }`}
                  />
                  <p className="text-sm font-medium text-[var(--muted)]">
                    {product.stock > 0
                      ? `${product.stock} units left in stock`
                      : "Currently out of stock"}
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isAddingToCart || isOutOfStock || isAtMaxInCart}
                    className={`min-h-[50px] px-8 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isOutOfStock || isAtMaxInCart
                        ? "cursor-not-allowed bg-gray-200 text-gray-500"
                        : isAddingToCart
                        ? "bg-[var(--ink)] text-white opacity-80 cursor-wait"
                        : isInCart
                        ? "bg-[var(--coral)] text-white hover:bg-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
                        : "bg-[var(--ink)] text-white hover:bg-[var(--coral)] shadow-[4px_4px_0_var(--coral)]"
                    }`}
                  >
                    {isAddingToCart ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Adding...
                      </span>
                    ) : isOutOfStock ? (
                      "Out of Stock"
                    ) : isAtMaxInCart ? (
                      `Max in Cart (${currentCartQty})`
                    ) : isInCart ? (
                      `Add Another (${currentCartQty} in cart)`
                    ) : (
                      "Add to Cart"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading}
                    className={`min-h-[50px] px-6 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border ${
                      wishlistLoading
                        ? "border-gray-300 text-gray-400 cursor-not-allowed"
                        : isWishlisted
                        ? "border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--coral)] hover:bg-[var(--coral)] hover:text-white"
                        : "border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--coral)] hover:text-[var(--coral)]"
                    }`}
                  >
                    {wishlistLoading
                      ? "⏳ Saving..."
                      : isWishlisted
                      ? "♥ Wishlisted"
                      : "♡ Add to Wishlist"}
                  </button>
                  <Link
                    to="/products"
                    className="inline-flex min-h-[50px] items-center justify-center border border-[var(--line)] px-6 text-xs font-bold uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--butter)] transition-colors"
                  >
                    Continue Browsing
                  </Link>
                </div>

                {wishlistFeedback && (
                  <p
                    className={`mt-3 text-xs font-bold ${
                      isWishlisted ? "text-emerald-600" : "text-[var(--coral)]"
                    }`}
                  >
                    {wishlistFeedback}
                  </p>
                )}

                {cartFeedback && (
                  <p
                    className={`mt-3 text-xs font-bold ${
                      cartFeedbackType === "success" ? "text-emerald-600" : "text-[var(--coral)]"
                    }`}
                  >
                    {cartFeedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;
