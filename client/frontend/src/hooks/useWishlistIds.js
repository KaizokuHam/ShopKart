import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getWishlist } from "../services/api.js";

// Feature-local state. Each page/navbar reads the persistent wishlist API;
// wishlist data is deliberately not held in Auth Context or a global store.
export function useWishlistIds() {
  const { user } = useAuth();
  const userId = user?._id;
  const [snapshot, setSnapshot] = useState({ userId: null, ids: [] });
  useEffect(() => {
    if (!userId) return;
    let controller;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const data = await getWishlist(request.signal);
        if (!request.signal.aborted) setSnapshot({ userId, ids: data.wishlist.map(product => product._id) });
      } catch { /* Feature actions and the wishlist page expose request errors. */ }
    };
    load();
    const updated = event => {
      if (!event.detail?.userId || event.detail.userId === userId) load();
    };
    window.addEventListener("wishlistUpdated", updated);
    return () => { controller?.abort(); window.removeEventListener("wishlistUpdated", updated); };
  }, [userId]);
  return snapshot.userId === userId ? snapshot.ids : [];
}
