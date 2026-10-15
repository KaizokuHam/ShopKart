import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { removePurchasedItems } from "../utils/cartSettlement.js";
import {
  getCart,
  addToCart as apiAddToCart,
  updateCartQuantity as apiUpdateCartQuantity,
  removeFromCart as apiRemoveFromCart,
} from "../services/api.js";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?._id;
  const currentUserId = useRef(userId);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  useEffect(() => { currentUserId.current = userId; }, [userId]);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Track action loading per product: { [productId]: "adding" | "updating" | "removing" }
  const [itemActionLoading, setItemActionLoading] = useState({});
  const [pendingMutations, setPendingMutations] = useState(0);

  /**
   * Fetch current user's cart from backend
   */
  const fetchCart = useCallback(
    async (signal) => {
      if (!userId) {
        setCartItems([]);
        setLoading(false);
        setError(null);
        return;
      }

      const requestRevision = ++revision.current;
      const requestUser = userId;
      setLoading(true);
      setError(null);

      try {
        const data = await getCart(signal);
        if (!signal?.aborted && requestRevision === revision.current && requestUser === currentUserId.current) setCartItems(data.cart || []);
      } catch (err) {
        if (err.name !== "CanceledError" && requestRevision === revision.current && requestUser === currentUserId.current) {
          console.error("Failed to load cart:", err);
          setError(
            err.response?.data?.message || "Unable to load your cart. Please try again."
          );
        }
      } finally {
        if (!signal?.aborted && requestRevision === revision.current && requestUser === currentUserId.current) setLoading(false);
      }
    },
    [userId]
  );

  // Sync cart when authentication state changes
  useEffect(() => {
    const controller = new AbortController();
    // Loading state is part of this asynchronous fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCart(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchCart]);

  const runMutation = useCallback((request) => {
    const requestUser = userId;
    setPendingMutations(count => count + 1);
    const next = queue.current.catch(() => {}).then(async () => {
      if (currentUserId.current !== requestUser) throw new Error("Your session changed. Please try again.");
      revision.current++;
      setLoading(false);
      const result = await request();
      if (currentUserId.current !== requestUser) throw new Error("Your session changed. Please try again.");
      // Invalidate any fetch that started while the mutation was in flight.
      revision.current++;
      setLoading(false);
      return result;
    });
    queue.current = next;
    return next.finally(() => setPendingMutations(count => Math.max(0, count - 1)));
  }, [userId]);

  /**
   * Add a product to the cart or increment quantity if already present
   */
  const addToCart = useCallback(
    async (productId) => {
      if (!user) {
        throw new Error("Please log in to manage your cart.");
      }

      setItemActionLoading((prev) => ({ ...prev, [productId]: "adding" }));
      setError(null);

      try {
        const res = await runMutation(() => apiAddToCart(productId));
        if (res.success && Array.isArray(res.cart)) {
          setCartItems(res.cart);
        } else {
          // Fallback refresh
          await fetchCart();
        }
        return {
          success: true,
          message: res.message || "Product added to cart",
        };
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Unable to add product to cart. Please try again.";
        throw new Error(message, { cause: err });
      } finally {
        setItemActionLoading((prev) => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      }
    },
    [user, fetchCart, runMutation]
  );

  /**
   * Update quantity for a specific product in the cart
   */
  const updateQuantity = useCallback(
    async (productId, quantity) => {
      if (!user) {
        throw new Error("Please log in to manage your cart.");
      }

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Quantity cannot be less than 1");
      }

      setItemActionLoading((prev) => ({ ...prev, [productId]: "updating" }));
      setError(null);

      try {
        const res = await runMutation(() => apiUpdateCartQuantity(productId, quantity));
        if (res.success && Array.isArray(res.cart)) {
          setCartItems(res.cart);
        } else {
          await fetchCart();
        }
        return {
          success: true,
          message: res.message || "Cart updated",
        };
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Unable to update cart quantity. Please try again.";
        throw new Error(message, { cause: err });
      } finally {
        setItemActionLoading((prev) => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      }
    },
    [user, fetchCart, runMutation]
  );

  /**
   * Remove a product from the cart
   */
  const removeFromCart = useCallback(
    async (productId) => {
      if (!user) {
        throw new Error("Please log in to manage your cart.");
      }

      setItemActionLoading((prev) => ({ ...prev, [productId]: "removing" }));
      setError(null);

      try {
        const res = await runMutation(() => apiRemoveFromCart(productId));
        if (res.success && Array.isArray(res.cart)) {
          setCartItems(res.cart);
        } else {
          await fetchCart();
        }
        return {
          success: true,
          message: res.message || "Product removed from cart",
        };
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Unable to remove product from cart. Please try again.";
        throw new Error(message, { cause: err });
      } finally {
        setItemActionLoading((prev) => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      }
    },
    [user, fetchCart, runMutation]
  );

  /**
   * Derived Cart Values:
   * Do not store in MongoDB or server state — compute on the fly from current state!
   */
  // Total units across all items (e.g. Keyboard x 2 + Mouse x 1 = 3)
  const totalCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  }, [cartItems]);

  // Unique line item count
  const itemCount = useMemo(() => {
    return cartItems.length;
  }, [cartItems]);

  // Subtotal in rupees: sum(price * quantity)
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const price = Number(item.product?.price) || 0;
      const qty = Number(item.quantity) || 0;
      return acc + Math.round(price * 100) * qty;
    }, 0) / 100;
  }, [cartItems]);

  /**
   * Helper: check if a product is in cart
   */
  const isInCart = useCallback(
    (productId) => {
      if (!productId) return false;
      return cartItems.some((item) => {
        const pId = typeof item.product === "object" ? item.product?._id : item.product;
        return pId === productId;
      });
    },
    [cartItems]
  );

  /**
   * Helper: get current quantity of product in cart
   */
  const getItemQuantity = useCallback(
    (productId) => {
      if (!productId) return 0;
      const found = cartItems.find((item) => {
        const pId = typeof item.product === "object" ? item.product?._id : item.product;
        return pId === productId;
      });
      return found ? Number(found.quantity) || 0 : 0;
    },
    [cartItems]
  );

  /**
   * Helper: check if a specific item is in an action loading state
   */
  const getItemAction = useCallback(
    (productId) => {
      return itemActionLoading[productId] || null;
    },
    [itemActionLoading]
  );

  /**
   * Clear local cart state upon successful order placement
   */
  const clearCart = useCallback(() => {
    revision.current++;
    setCartItems([]);
    setLoading(false);
    setError(null);
  }, []);
  const confirmPurchase = useCallback(order => {
    if (String(order.user?._id || order.user) !== userId) return;
    revision.current++;
    setCartItems(current => removePurchasedItems(current, order.items));
    setLoading(false);
    setError(null);
  }, [userId]);

  const value = {
    cartItems,
    loading,
    mutating: pendingMutations > 0,
    error,
    totalCount, // Total units (Cart (3))
    itemCount,  // Unique items (Items: 2)
    subtotal,   // Derived subtotal
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    confirmPurchase,
    fetchCart,
    isInCart,
    getItemQuantity,
    getItemAction,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export default CartContext;
