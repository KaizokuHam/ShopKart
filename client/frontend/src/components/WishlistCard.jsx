import { useState } from "react";
import { Link } from "react-router-dom";
import { removeFromWishlist } from "../services/api.js";
import { useCart } from "../context/CartContext.jsx";

const WishlistCard = ({ product, onRemove }) => {
  const { addToCart, getItemQuantity, getItemAction } = useCart();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [cartSuccess, setCartSuccess] = useState("");

  const currentCartQty = getItemQuantity(product._id);
  const isOutOfStock = (product.stock || 0) <= 0;
  const isAtMaxInCart = currentCartQty >= (product.stock || 0);
  const isAddingToCart = getItemAction(product._id) === "adding";

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (isAddingToCart || isOutOfStock || isAtMaxInCart) return;

    setError("");
    setCartSuccess("");
    try {
      await addToCart(product._id);
      setCartSuccess("Added to Cart 🛒");
      setTimeout(() => setCartSuccess(""), 2500);
    } catch (err) {
      setError(err.message || "Failed to add to cart");
      setTimeout(() => setError(""), 3500);
    }
  };


  const handleRemove = async (e) => {
    e.stopPropagation();
    if (removing) return;

    setRemoving(true);
    setError("");

    try {
      await removeFromWishlist(product._id);
      window.dispatchEvent(
        new CustomEvent("wishlistUpdated", {
          detail: { productId: product._id, saved: false },
        })
      );
      if (onRemove) {
        onRemove(product._id);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to remove item. Please try again."
      );
      setRemoving(false);
    }
  };

  return (
    <article className="group flex flex-col justify-between border border-[var(--line)] bg-[var(--paper)] p-4 transition-all duration-300 hover:shadow-md">
      <div>
        {/* Product Image */}
        <div
          className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--butter)] cursor-pointer"
        >
          <Link to={`/products/${product._id}`} aria-label={`View ${product.name}`}>
          <img
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            src={product.image}
            alt={product.name}
            loading="lazy"
          />
          </Link>
          <span className="absolute left-3 top-3 bg-[var(--paper)]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[var(--ink)] backdrop-blur-sm">
            {product.category}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            title="Remove from wishlist"
            aria-label="Remove from wishlist"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--paper)]/90 text-sm text-[var(--coral)] shadow-sm backdrop-blur-sm transition-all hover:bg-[var(--coral)] hover:text-white cursor-pointer"
          >
            {removing ? "⏳" : "♥"}
          </button>
        </div>

        {/* Product Info */}
        <div className="pt-4">
          <div className="flex items-start justify-between gap-2">
            <h2
              className="font-[var(--display)] text-base font-semibold leading-tight text-[var(--ink)] cursor-pointer hover:text-[var(--coral)] transition-colors"
            >
              <Link to={`/products/${product._id}`}>{product.name}</Link>
            </h2>
            <strong className="whitespace-nowrap text-base font-bold text-[var(--coral)]">
              ₹{product.price?.toLocaleString("en-IN")}
            </strong>
          </div>

          <p className="mt-1 text-xs text-[var(--muted)]">
            {product.category}
          </p>

          <p className="mt-2 text-xs font-medium text-[var(--muted)]">
            {product.stock > 0
              ? `${product.stock} units left`
              : "Out of stock"}
          </p>

          {error && (
            <p className="mt-2 text-xs text-[var(--coral)]">
              {error}
            </p>
          )}

          {cartSuccess && (
            <p className="mt-2 text-xs text-emerald-600 font-semibold">
              {cartSuccess}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons: Add to Cart + Details & Remove */}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAddingToCart || isOutOfStock || isAtMaxInCart}
          className={`w-full py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            isOutOfStock || isAtMaxInCart
              ? "border border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
              : isAddingToCart
              ? "border border-[var(--ink)] bg-[var(--ink)] text-white cursor-wait opacity-80"
              : "border border-[var(--ink)] bg-[var(--ink)] text-white hover:bg-[var(--coral)] hover:border-[var(--coral)] shadow-[2px_2px_0_var(--coral)]"
          }`}
        >
          {isAddingToCart ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Adding...
            </span>
          ) : isOutOfStock ? (
            "Out of Stock"
          ) : isAtMaxInCart ? (
            `Max in Cart (${currentCartQty})`
          ) : currentCartQty > 0 ? (
            `Add Another (${currentCartQty} in cart)`
          ) : (
            "Add to Cart"
          )}
        </button>

        <div className="flex gap-2">
          <Link
            to={`/products/${product._id}`}
            className="flex-1 border border-[var(--line)] bg-transparent py-2 px-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--ink)] cursor-pointer"
          >
            Details
          </Link>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className={`border py-2 px-3 text-center text-xs font-bold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
              removing
                ? "border-gray-300 text-gray-400 cursor-not-allowed"
                : "border-[var(--line)] text-[var(--coral)] hover:border-[var(--coral)] hover:bg-[var(--coral)] hover:text-white"
            }`}
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default WishlistCard;
