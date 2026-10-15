// Apply only a server-confirmed order. Original line IDs distinguish a purchase
// from a new cart line for the same product added while payment was open.
export function removePurchasedItems(cart, purchases) {
  return cart.map(line => {
    const productId = typeof line.product === "object" ? line.product?._id : line.product;
    const purchased = purchases.find(item => String(item.product?._id || item.product) === String(productId) &&
      (!item.cartItemId || String(item.cartItemId) === String(line._id)));
    return purchased ? { ...line, quantity: Math.max(0, line.quantity - purchased.quantity) } : line;
  }).filter(line => line.quantity > 0);
}
