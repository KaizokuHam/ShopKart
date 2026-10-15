# Architecture

## Request and state flow

The React frontend calls the Express API through a single Axios client using credentialed requests. Authentication and cart state are shared through React contexts; catalogue and order views fetch their own resources. React Router handles client routes, including protected account pages and the 404 fallback.

The backend uses routers, controllers, and Mongoose models. `app.js` creates the app independently of database startup, allowing HTTP routing to be tested without opening a real database. `index.js` loads backend configuration, connects MongoDB, starts HTTP, and closes connections on shutdown. `/health` returns 200 only while Mongoose reports a connected database, otherwise 503.

## Data model

| Model | Responsibility |
| --- | --- |
| Customer | Hashed password, account details, product-reference wishlist, quantity-bearing cart. |
| Product | Current catalogue content, price, category, image URL, and integer stock. |
| Order | Customer reference, purchase-time product/price snapshots, delivery address, INR total, gateway identifiers, and payment/fulfilment states. |

`user.model.js` is a compatibility alias for Customer. There is one customer collection, not a separate second account system.

## Cart consistency

Wishlist UI data is deliberately kept out of Auth Context. `useWishlistIds` uses feature-local React state and fetches persistent backend references/products for each owning page/navbar. Mutation events request an API refresh; they do not form a global wishlist data store. Auth Context contains only the current safe profile/session state.

Cart mutations use atomic database operations, including a stock-bounded pipeline for additions. Quantity values must be positive integers. Deleted products remain removable through an unavailable-product placeholder. Frontend mutations are queued; request revisions and account checks discard stale results. Cart totals are derived for display and are recalculated from server product data during checkout.

## Payment lifecycle

An active checkout fingerprint includes the authenticated customer, original cart line IDs, quantities, and server prices. Its sparse unique database index prevents two concurrent requests for the same unchanged bag from opening separate gateway orders. Retrying an unpaid checkout checks provider payments first, recovers a captured result, blocks a processing charge, or resumes the same gateway order. Settlement clears the active key so a later intentional purchase can create a fresh order.

1. The server validates delivery details, current cart quantities, products, and stock.
2. It calculates the total in paise, snapshots order items, creates a pending local order, and requests a Razorpay Test Mode order.
3. Razorpay Checkout returns a payment ID, gateway order ID, and signature on success.
4. The API checks ownership, the stored gateway order, and an HMAC signature using the private secret.
5. It fetches the payment from Razorpay and checks order ID, INR currency, exact amount, and captured status. Authorisation alone does not fulfil the order.
6. A MongoDB transaction rechecks stock, deducts it, marks the order PAID/PLACED, and subtracts purchased quantities from matching original cart line IDs. Products added or removed/re-added while payment was open survive confirmation. A repeated confirmation returns the paid order without repeating stock changes.
7. The frontend clears its local cart and navigates to the paid order details.

The callback state machine prevents modal dismissal and late failure events from overwriting successful confirmation. Network errors or uncaptured payments enter pending confirmation. Signed proof is stored under the current user's key in session storage, allowing confirmation retry across refreshes in the same tab session.

| Event | Order/cart behavior |
| --- | --- |
| Captured, authenticated payment | Commit order, inventory, and cart transaction. |
| Provider-confirmed failure | Record FAILED; preserve cart/inventory. |
| Modal cancellation | Record CANCELLED attempt; preserve cart/inventory. |
| Uncertain provider response | Keep confirmation pending; discourage a second payment. |
| Late failure after paid commit | Paid order remains paid. |
| Insufficient stock during confirmation | Roll back stock/cart changes, durably record PAID/PAYMENT_REVIEW, and block another checkout until support resolves it. |

`paymentStatus` is PENDING, PAID, or FAILED. `paymentAttemptStatus` provides OPEN, VERIFYING, SUCCEEDED, FAILED, or CANCELLED detail. Fulfilment starts at PENDING_PAYMENT and advances through PLACED → CONFIRMED → SHIPPED → DELIVERED after payment. Only the next stage is allowed.

## Access boundaries

Public users can read the catalogue and register/login. Customers can access only their own cart, wishlist, and orders. Trusted `ADMIN_EMAILS` operators can open customer order references, restock inventory, retry reviewed fulfilment without charging again, and advance paid order statuses. These actions are enforced on the server. Public signup rejects already allowlisted emails. Browser writes reject unknown origins, GET cannot log out, and failed authentication attempts are rate limited. Account storage outages return 503 rather than incorrectly expiring a valid session.

## Design and motion

Global design tokens live in `src/index.css`; page and component styles live in `src/App.css`, with Tailwind utilities used for layout. Lenis is mounted once and destroyed on cleanup. It respects reduced-motion settings, leaves touch behavior native, and excludes marked internal scroll areas. Route changes reset scrolling or resolve section anchors. Shared navigation, footer, error boundary, and not-found screens keep failure states coherent.

## Offline payment recovery

`/webhooks/razorpay` authenticates the exact raw request bytes using a separate webhook secret before parsing JSON. It fetches the referenced payment from Razorpay and uses the same transactional settlement function as browser verification. Paid-state guards make duplicate and out-of-order events safe. A customer's order-level status check can independently query gateway order payments when browser proof has been lost. Operator fulfilment retry uses the existing captured charge and a transaction to prevent duplicate deductions.

See [release setup](RELEASE.md) for hosted webhook configuration and the operator procedure, and [deployment limitations](DEPLOYMENT.md) for remaining production scope.
