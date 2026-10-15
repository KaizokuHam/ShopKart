# Release and operations runbook

ShopKart ships as a **Razorpay Test Mode storefront**. This repository does not enable real-money payments or publish a deployment automatically.

## Automated release gate

From the repository root:

```sh
npm ci
npm run setup
npx --prefix client/frontend playwright install chromium
npm run check:release
```

On Linux, add `--with-deps` to the browser install command. On the first database test run, `mongodb-memory-server` downloads a MongoDB 8.2.6 binary; allow extra time and sufficient disk space. The downloaded runtime is cached for subsequent runs. A supported MongoDB binary/platform and network access to the download service are needed.

The gate runs:

1. Backend JavaScript syntax and frontend ESLint.
2. Unit, API-routing, validation, callback-race, and navigation regressions.
3. A production frontend build.
4. Real MongoDB replica-set integration tests: account sessions, concurrent wishlist/cart writes, idempotent payment settlement, preservation of new cart items, signed webhook replay, stock rollback, ownership, and support recovery.
5. Chromium desktop and mobile journeys: signup/login, catalogue and product details, profile, wishlist, cart, success/failure/cancelled payment, pending-capture refresh recovery, lost-callback recovery, session expiry, navigation, 404, and reduced motion.

Tests create disposable databases and use generated test credentials. They **never connect using your `dbUrl`**. The external payment provider is replaced with an isolated test gateway; no charge is made. Test-only controls are defined in a separate guarded server and are not mounted by production `backend/index.js` or `createApp()`.

CI runs the same release gate and uploads browser failure screenshots/traces. Results under `client/frontend/test-results` and `playwright-report` are ignored by Git. A remote CI execution is separate from a local passing run.

## Hosted Test Mode configuration

Before setting `NODE_ENV=production`:

- Use a reachable MongoDB replica set or Atlas deployment. Startup rejects a standalone topology.
- Set a random `jwt_secret` of at least 32 characters.
- Set exact HTTPS `CLIENT_ORIGIN` values, with no paths or trailing slash, and a matching public frontend `VITE_API_URL` at build time.
- Set matching non-placeholder `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` Test Mode credentials and enable automatic capture in the provider dashboard.
- Create a separate private webhook secret and set `RAZORPAY_WEBHOOK_SECRET` to the same value configured in Razorpay.
- Set `TRUST_PROXY` to the exact number of trusted proxy hops for your host; leave it at `0` for direct/local access.
- Provision the operator's account before adding its email to `ADMIN_EMAILS`. Restart and sign in again after changing the allowlist.

Production startup intentionally fails on incomplete secrets, invalid cookie/proxy settings, or non-HTTPS frontend origins. Environment checks validate shape; they cannot prove that a provider key is active or that your hosted network permits a connection.

## Configure the payment webhook

In Razorpay **Test Mode**, register the public HTTPS API URL:

```text
https://your-api.example/webhooks/razorpay
```

Subscribe to `payment.captured`, `order.paid`, and `payment.failed`. Set the same separate webhook secret on the provider and API. Do not paste the secret into the frontend or a public issue. Keep the endpoint enabled so captured payments can settle even if the browser closes. Direct localhost URLs cannot receive hosted provider webhooks; use a staging deployment for the provider smoke test.

ShopKart authenticates the exact raw body, fetches the payment from the provider, and uses the same settlement transaction as normal verification. Invalid signatures are rejected; successful replay is harmless. Duplicate or late failure events cannot downgrade paid orders. See [Razorpay's webhook validation and testing guidance](https://razorpay.com/docs/webhooks/validate-test/).

## Target-environment smoke test

The automated suite proves application behavior with a real disposable database and a mocked gateway. Before calling a hosted environment ready:

1. Confirm `/health` returns 200 and direct client-route refreshes work.
2. Use your actual Razorpay Test Mode account to complete one captured payment. Confirm its gateway IDs, PAID/PLACED status, exact amount, stock change, and cart update.
3. Test failure and cancellation; confirm cart preservation.
4. Test webhook delivery and duplicate replay from the provider dashboard. Confirm a customer who closes the tab still receives a settled order.
5. Check a pending capture with **Retry confirmation** and a lost callback with **Check payment status** on the order page.
6. Verify HTTPS cookies, configured CORS origin, operator permissions, and rate-limit behavior through the actual reverse proxy.

No real Razorpay account transaction or hosted deployment has been exercised by the isolated automated suite.

## Resolve a paid order awaiting stock review

If stock disappears during payment, ShopKart records **PAID / PAYMENT_REVIEW**. Inventory/cart changes roll back; the customer is shown that payment was received and should not pay again. New checkout for that customer is blocked until the review is resolved.

A trusted operator should:

1. Obtain the customer's order reference, sign in to the allowlisted account, and open `/orders/<order-id>`.
2. Check the received payment and stock discrepancy.
3. Replenish inventory using the authenticated admin endpoint `PATCH /products/<product-id>/stock` with `{ "stock": 5 }` (use the correct actual count).
4. Click **Retry fulfilment after restocking** on order details, or POST `/orders/<order-id>/retry-fulfillment` as that operator.
5. Confirm the order becomes PLACED, stock is deducted once, and the purchased quantities are removed from the customer's cart. The existing payment is reused; no checkout/charge is opened.
6. Advance fulfilment through CONFIRMED → SHIPPED → DELIVERED as appropriate.

If the store cannot fulfil, resolve it through the payment provider/support process. Automated refunds and refund-state accounting are outside this Test Mode release. Do not change payment status by fabricating a signature or recharging the customer.

## Ongoing operations

Use `/health` for readiness, supervise the API process, retain host error logs, monitor failed webhook delivery and PAYMENT_REVIEW orders, and configure database backups. Review dependency audits regularly. There is no built-in email notification service or store-wide order dashboard; operators currently work from order references and API tooling. For multiple API replicas, use a shared rate-limit store appropriate to the deployment.
