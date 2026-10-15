import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart, getItemAction } = useCart();
  const product = item?.product;
  const [localError, setLocalError] = useState("");

  if (!product) return null;

  const currentAction = getItemAction(product._id);
  const isUpdating = currentAction === "updating";
  const isRemoving = currentAction === "removing";
  const isBusy = isUpdating || isRemoving;

  const quantity = item.quantity || 1;
  const stock = product.stock || 0;
  const isAtMaxStock = quantity >= stock;
  const isAtMinQuantity = quantity <= 1 || product.unavailable;
  const lineTotal = (product.price || 0) * quantity;

  const handleIncrease = async () => {
    if (isBusy || isAtMaxStock) return;
    setLocalError("");
    try {
      await updateQuantity(product._id, quantity + 1);
    } catch (err) {
      setLocalError(err.message || "Failed to increase quantity");
      setTimeout(() => setLocalError(""), 3500);
    }
  };

  const handleDecrease = async () => {
    if (isBusy || isAtMinQuantity) return;
    setLocalError("");
    try {
      await updateQuantity(product._id, quantity - 1);
    } catch (err) {
      setLocalError(err.message || "Failed to decrease quantity");
      setTimeout(() => setLocalError(""), 3500);
    }
  };

  const handleRemove = async () => {
    if (isBusy) return;
    setLocalError("");
    try {
      await removeFromCart(product._id);
    } catch (err) {
      setLocalError(err.message || "Failed to remove item");
      setTimeout(() => setLocalError(""), 3500);
    }
  };

  return (
    <article className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5 transition-all duration-200 hover:shadow-sm">
      {/* Product Image & Info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Link
          to={`/products/${product._id}`}
          className="relative aspect-square w-20 sm:w-24 shrink-0 overflow-hidden border border-[var(--line)] bg-[var(--butter)]"
        >
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-[var(--muted)]">
            {product.category}
          </span>
          <Link
            to={`/products/${product._id}`}
            className="block truncate font-[var(--display)] text-base font-semibold text-[var(--ink)] transition-colors hover:text-[var(--coral)]"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Unit Price:{" "}
            <span className="font-semibold text-[var(--ink)]">
              ₹{product.price?.toLocaleString("en-IN")}
            </span>
          </p>

          {isAtMaxStock && (
            <p className="mt-1 text-[11px] font-medium text-amber-700">
              {product.unavailable ? "This product was deleted. Remove it to continue checkout." : `Stock limit reached (${stock} available)`}
            </p>
          )}

          {localError && (
            <p className="mt-1 text-xs font-semibold text-[var(--coral)]">
              {localError}
            </p>
          )}
        </div>
      </div>

      {/* Controls & Price */}
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--line)]">
        {/* Quantity Controls: [-] quantity [+] */}
        <div className="flex flex-col items-center gap-1">
          <div className="inline-flex items-center border border-[var(--line)] bg-white">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={isBusy || isAtMinQuantity}
              aria-label="Decrease quantity"
              title={
                isAtMinQuantity
                  ? "Minimum quantity is 1. Click Remove to delete."
                  : "Decrease quantity"
              }
              className={`flex h-9 w-9 items-center justify-center font-bold text-sm transition-colors cursor-pointer ${
                isAtMinQuantity || isBusy
                  ? "text-gray-300 cursor-not-allowed bg-gray-50"
                  : "text-[var(--ink)] hover:bg-[var(--butter)] hover:text-[var(--coral)]"
              }`}
            >
              −
            </button>

            <span className="flex h-9 min-w-10 items-center justify-center px-2 text-center text-sm font-bold text-[var(--ink)]">
              {isUpdating ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--coral)] border-t-transparent" />
              ) : (
                quantity
              )}
            </span>

            <button
              type="button"
              onClick={handleIncrease}
              disabled={isBusy || isAtMaxStock}
              aria-label="Increase quantity"
              title={
                isAtMaxStock
                  ? `Cannot exceed available stock of ${stock}`
                  : "Increase quantity"
              }
              className={`flex h-9 w-9 items-center justify-center font-bold text-sm transition-colors cursor-pointer ${
                isAtMaxStock || isBusy
                  ? "text-gray-300 cursor-not-allowed bg-gray-50"
                  : "text-[var(--ink)] hover:bg-[var(--butter)] hover:text-[var(--coral)]"
              }`}
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={isBusy}
            className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--coral)] hover:underline transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>

        {/* Line Total */}
        <div className="text-right min-w-[90px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Total
          </span>
          <span className="font-[var(--display)] text-lg font-bold text-[var(--ink)]">
            ₹{lineTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </article>
  );
};

export default CartItem;
