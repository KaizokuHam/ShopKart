# HTTP API reference

Base URL in development: `http://localhost:8085`. Requests and responses use JSON. Browser requests send the HTTP-only `token` cookie with credentials enabled. Auth middleware also accepts `Authorization: Bearer <token>` for trusted clients; the browser login flow does not return tokens in response JSON.

## Routes

| Method | Path | Access | Purpose / request |
| --- | --- | --- | --- |
| GET | `/` | Public | Service name/version and readiness path. |
| GET | `/health` | Public | 200 when DB connected; 503 otherwise. |
| POST | `/customers/register` | Public | `{ fullName, email, password, phone }`. Creates an account; does not sign it in. |
| POST | `/customers/login` | Public | `{ email, password }`. Sets cookie; returns `userData`. |
| GET | `/customers/me` | Signed in | Plain profile object with `_id`, `fullName`, `email`, `phone`, `createdAt`, and `isAdmin`; excludes password/hash. |
| POST | `/customers/logout` | Signed in | Clears session cookie and returns `success: true`. GET does not mutate session state. |
| PATCH | `/customers/change-password` | Signed in | `{ oldPassword, newPassword }`; verifies current password, hashes replacement, renews this session and invalidates older sessions. |
| GET | `/products` | Public | Filters: `search`, `category`, `sort=price_asc` or `price_desc`; default newest first. Returns `{ success, count, products }`. |
| GET | `/products/:id` | Public | Returns product object. |
| POST | `/products` | Admin | `{ name, description, price, category, image, stock }`. Numbers required for price/stock; HTTP(S) image URL required. |
| PATCH | `/products/:id/stock` | Admin | `{ stock }`, a non-negative integer; updates inventory. |
| GET | `/wishlist` | Signed in | Populated product list as `{ success, count, wishlist }`. |
| POST | `/wishlist/:productId` | Signed in | Add a product. Duplicate saves return 409. |
| DELETE | `/wishlist/:productId` | Signed in | Remove a saved product. Missing entry returns 404. |
| PATCH | `/wishlist/:productId/toggle` | Signed in | Toggle saved state; returns `saved` boolean. |
| GET | `/cart` | Signed in | `{ success, cart }`, with populated products. |
| POST | `/cart/:productId` | Signed in | Add one unit or increment an existing item, bounded by stock. |
| PATCH | `/cart/:productId` | Signed in | `{ quantity }`, a positive integer within stock. |
| DELETE | `/cart/:productId` | Signed in | Remove entire cart line. |
| POST | `/orders/create-payment-order` | Signed in | `{ shippingAddress }`; creates local and gateway orders. |
| POST | `/orders/verify-payment` | Signed in | Signed payment proof; confirms captured payment and commits transaction. |
| POST | `/orders/:id/payment-result` | Owner | `{ outcome: "FAILED" or "CANCELLED", paymentId? }`. Record unsuccessful attempt; does not clear cart. |
| GET | `/orders` | Signed in | `{ success, orders }`, current user only, newest first. |
| GET | `/orders/:id` | Owner or admin | `{ success, order }`. |
| POST | `/orders/:id/reconcile` | Owner | Fetch the gateway result and recover a missing callback without browser signature storage. |
| POST | `/orders/:id/retry-fulfillment` | Admin | Retry stock allocation for a PAID/PAYMENT_REVIEW order after restocking; never starts a new payment. |
| PATCH | `/orders/:id/status` | Admin | `{ status }`: next fulfilment stage for a paid order, with an atomic current-status guard. |
| POST | `/webhooks/razorpay` | Signed gateway event | Raw JSON plus `X-Razorpay-Signature`; supports `payment.captured`, `order.paid`, and `payment.failed`. |

Admin access requires an authenticated account explicitly named in backend `ADMIN_EMAILS`. Operators can support a customer's order using its reference; there is no store-wide order listing API. Owner-only payment actions cannot be performed by another customer.

`/users/*` remains a backward-compatible alias; its `/users/me` response retains the older `{ authenticatedUser }` wrapper. The UI uses `/customers/*`. Registration returns `success: true` and `customer._id`, login returns `success: true` and safe `userData`, and wrong-email/wrong-password responses are deliberately identical.

## Checkout request

```json
{
  "shippingAddress": {
    "fullName": "A Test Customer",
    "phone": "9876543210",
    "addressLine1": "12 Example Street",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001"
  }
}
```

Successful creation returns `success`, `shopKartOrderId`, `razorpayOrderId`, `amount` (integer paise), `currency`, the public Razorpay `key`, and the local `order`. Prices and totals sent by clients are not used. The gateway receipt references the local order ID.

## Payment confirmation request

```json
{
  "shopKartOrderId": "<local MongoDB order ID>",
  "razorpay_order_id": "<gateway order ID>",
  "razorpay_payment_id": "<gateway payment ID>",
  "razorpay_signature": "<64-character hexadecimal signature>"
}
```

A successful response contains `success: true` and a PAID order. A 202 response with `retryVerification: true` means capture is pending; preserve the proof and retry confirmation. Provider/network errors can also require confirmation retry. `paymentFailed: true` means the gateway reports a failed/refunded payment and a new checkout may be attempted. Do not treat every non-200 response as permission to charge again.

A PAID order in PAYMENT_REVIEW has received money but could not allocate stock. The customer sees a support message, and new checkout is blocked until an operator resolves the order. The stock transaction rolls back, preserving cart and inventory. This state must not be shown as PLACED or treated as permission to pay again.

## Common responses

| Status | Meaning |
| --- | --- |
| 200 / 201 | Successful read/mutation or creation. |
| 202 | Payment outcome not final; confirmation pending. |
| 400 | Invalid input, invalid signature, stock limit, or invalid transition. |
| 401 | Missing, expired, invalid, or unavailable account session. |
| 403 | Ownership or administrative authorization failed. |
| 404 | Resource or API route does not exist. |
| 409 | Duplicate/conflicting operation. |
| 413 | JSON request exceeds the 100 KB body limit. |
| 429 | Failed authentication attempt limit reached (30 per IP in 15 minutes). |
| 500 / 502 / 503 | Application, provider, configuration, or readiness failure. |

Error response details vary by existing controller; clients should use `message` when available and fall back to a helpful generic message. Success envelopes are not identical across all resources, as documented above.
