import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { toggleWishlist } from "../services/api.js";
import Icon from "./Icon.jsx";

const ProductCard = ({ product, saved = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, getItemQuantity, getItemAction } = useCart();

  const isSaved = Boolean(user && saved);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(""); // "success" or "error"

  const currentCartQty = getItemQuantity(product._id);
  const isInCart = currentCartQty > 0;
  const isOutOfStock = (product.stock || 0) <= 0;
  const isAtMaxInCart = currentCartQty >= (product.stock || 0);
  const isAddingToCart = getItemAction(product._id) === "adding";



  const handleAddToCart = async (e) => {
    e.stopPropagation();

    if (!user) {
      navigate("/login");
      return;
    }

    if (isAddingToCart || isOutOfStock || isAtMaxInCart) return;

    setFeedback("");
    try {
      await addToCart(product._id);
      setFeedback("Added to cart! 🛒");
      setFeedbackType("success");
      setTimeout(() => setFeedback(""), 2500);
    } catch (err) {
      setFeedback(err.message || "Failed to add to cart");
      setFeedbackType("error");
      setTimeout(() => setFeedback(""), 3500);
    }
  };

  const handleWishlistClick = async (e) => {
    e.stopPropagation();

    if (!user) {
      navigate("/login");
      return;
    }

    if (loading) return; // Prevent duplicate requests

    setLoading(true);
    setFeedback("Saving to wishlist…");

    try {
      // Use toggle endpoint for smooth two-way interaction
      const res = await toggleWishlist(product._id);
      const nextSavedState = res.saved !== undefined ? res.saved : !isSaved;
      setFeedback(
        nextSavedState ? "♥ Added to Wishlist" : "Removed from Wishlist"
      );
      setFeedbackType("success");

      // Dispatch event so other components (Navbar, other cards) sync
      window.dispatchEvent(
        new CustomEvent("wishlistUpdated", {
          detail: { productId: product._id, saved: nextSavedState, userId: user._id },
        })
      );

      setTimeout(() => setFeedback(""), 2500);
    } catch (err) {
      if (err.response?.status === 409) {
        setFeedback("♥ Added to Wishlist");
        setFeedbackType("success");
      } else {
        setFeedback("Unable to save product. Please try again.");
        setFeedbackType("error");
      }
      setTimeout(() => setFeedback(""), 3500);
    } finally {
      setLoading(false);
    }
  };

  return <article className="product-card" data-reveal>
    <div className="product-image">
      <Link to={"/products/" + product._id} aria-label={"View " + product.name}><img src={product.image} alt={product.name} loading="lazy" /></Link>
      <span className="product-category">{product.category}</span>
      <button className={"save-button" + (isSaved ? " is-saved" : "")} type="button" onClick={handleWishlistClick} disabled={loading} aria-pressed={isSaved} aria-label={isSaved ? "Remove " + product.name + " from favourites" : "Save " + product.name}><Icon name="heart" size={18} /></button>
    </div>
    <div className="product-info"><div className="product-topline"><Link className="product-name" to={"/products/" + product._id}>{product.name}</Link><strong className="product-price">₹{product.price?.toLocaleString("en-IN")}</strong></div>
      <p className="product-stock"><span className="stock-dot" />{isOutOfStock ? "Currently unavailable" : product.stock <= 5 ? "Only " + product.stock + " left" : "Ready for your everyday"}</p>
    </div>
    <div className="product-actions"><button className="add-button" type="button" onClick={handleAddToCart} disabled={isAddingToCart || isOutOfStock || isAtMaxInCart}>{isAddingToCart ? "Adding…" : isOutOfStock ? "Out of stock" : isAtMaxInCart ? "Stock limit reached" : isInCart ? "Add another · " + currentCartQty + " in cart" : "Add to Cart"}<Icon name="arrow" size={18} /></button></div>
    <Link className="product-details-link" to={"/products/" + product._id}>View Details <span aria-hidden="true">↗</span></Link>
    {feedback && <p role="status" className={"product-feedback" + (feedbackType === "error" ? " is-error" : "")}>{feedback}</p>}
  </article>;
};

export default ProductCard;
