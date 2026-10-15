# Manual acceptance checklist

Use a dedicated development database and Razorpay Test Mode. Run `npm run check` first. Record your environment and actual observations; this checklist is not a claim that every live scenario has already been tested.

## Setup and catalogue

- [ ] Fresh clone: `npm ci`, `npm run setup`, environment copies, and `npm run dev` work.
- [ ] Missing DB/JWT configuration produces a useful startup error.
- [ ] `/health` reports DB connectivity without revealing credentials.
- [ ] Seed twice; confirm existing products, stock, and user data remain unchanged.
- [ ] Search, category links, price sorting, empty results, and missing product IDs behave correctly.
- [ ] Unknown UI URLs show the styled 404 screen; unknown API routes return JSON 404.

## Accounts and authorization

- [ ] Register, reject duplicate email, reject invalid input, log in, refresh, and log out.
- [ ] Opening `/checkout` while signed out redirects to login and returns to checkout after login.
- [ ] Password hashes are absent from login and `/customers/me` responses.
- [ ] Regular customers cannot POST products or advance order fulfilment.
- [ ] Other users cannot read or confirm an order they do not own.
- [ ] Trusted allowlisted user can create a product with numeric price/integer stock and advance only the next stage of their own paid order.

## Wishlist and cart

- [ ] Save/remove a wishlist item; navigation and product saved states update.
- [ ] Add, increment, decrement, and remove cart items; refresh preserves the bag.
- [ ] Prevent zero, fractional, negative, and over-stock quantities.
- [ ] Rapid cart actions produce consistent quantities and totals.
- [ ] Unavailable products remain removable and block checkout.

## Payments: real Test Mode integration

- [ ] Correct delivery information opens Razorpay Checkout; invalid information remains on the form.
- [ ] Successful captured payment creates PAID/PLACED order, decrements stock once, clears cart, and shows confirmation.
- [ ] Repeating the identical signed confirmation does not decrement stock again.
- [ ] Two concurrent checkout requests for an unchanged bag reuse the same gateway order.
- [ ] Failure records the failed attempt and preserves inventory/cart.
- [ ] Closing the modal records cancellation without pretending that payment succeeded.
- [ ] Dismiss/failure callbacks arriving after success cannot replace the success result.
- [ ] Pending capture or an interrupted verification response shows pending confirmation and blocks a second payment.
- [ ] Retry confirmation uses the same payment ID; same-tab refresh preserves retry proof.
- [ ] An invalid signature, wrong amount/currency, or another user's order never confirms payment.
- [ ] Transaction failure preserves atomicity; stock conflicts record PAID/PAYMENT_REVIEW and block another checkout.
- [ ] A trusted operator can restock through the API and retry reviewed fulfilment without a new charge or duplicate stock deduction.
- [ ] Configure the signed webhook, verify duplicate delivery is harmless, and recover a closed-tab callback from order details.

## Presentation and deployment

- [ ] Check desktop and narrow mobile layouts, menu, product cards, bag, checkout, and order details.
- [ ] Navigate using keyboard and confirm focus visibility and meaningful feedback.
- [ ] Enable reduced motion and confirm smooth scrolling/reveals do not force animation.
- [ ] Check slow/offline API states, failed image requests, and unexpected-render fallback.
- [ ] Build/preview works with preview origin allowed in CORS.
- [ ] Deployed deep links and page refreshes resolve through the SPA fallback.
