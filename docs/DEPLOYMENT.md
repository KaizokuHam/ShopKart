# Deployment guide and release boundaries

## Services

The frontend is a static Vite application; the backend is a separate Node service. No hosting account or live deployment is configured automatically.

1. Follow [README.md](../README.md) and run the [full release gate](RELEASE.md).
2. Build with the target public `VITE_API_URL` in the build environment. Deploy `client/frontend/dist` with a static host and rewrite client routes to `/index.html`.
3. Run `npm ci --omit=dev --prefix backend` and `npm run backend:start`, or `npm start` in `backend`. Development/testing dependencies are not required at runtime.
4. Configure private host variables for MongoDB, JWT, Razorpay Test Mode, webhook secret, exact frontend origin, proxy hops, and production cookies. Host variables take precedence over `.env` files.
5. Use Atlas or another replica set, HTTPS termination, a process supervisor, controlled database access, and backups. `/health` returns 200 while connected and 503 if DB connectivity is lost.
6. Configure and exercise the signed webhook on your public HTTPS API. Follow the target-environment smoke test in the release runbook.

Production startup checks secret/configuration requirements and rejects standalone MongoDB. It cannot verify Razorpay account configuration or external network reachability until those integrations are exercised.

## Cookies and origins

Set `NODE_ENV=production` behind HTTPS. Prefer same-site frontend/API hosts, such as `shop.example.com` and `api.example.com`. Set `CLIENT_ORIGIN=https://shop.example.com` exactly. For genuinely cross-site HTTPS hosting, use `COOKIE_SAME_SITE=none`; browser third-party-cookie restrictions may still apply. Browser writes from unknown origins are rejected. Set the exact trusted proxy hop count so rate limits do not accidentally share one proxy IP or trust spoofed client headers.

`npm run preview` serves a local build preview only. It does not serve the API or replace a production static host.

## Current release scope

- **Test Mode only:** real-money credentials are rejected. The app is suitable for a controlled demo/staging deployment after the target-environment smoke test.
- **Payment recovery:** signed webhooks and owner-initiated gateway reconciliation are implemented. Callback loss is no longer dependent on session storage alone. Provider webhook delivery still needs to be configured and monitored by the operator.
- **No stock reservation:** confirmation rechecks stock. Captured payments with insufficient stock become PAID/PAYMENT_REVIEW, preserve inventory/cart, and block a second checkout. Operators can restock and retry fulfilment without a new charge. Automated refunds and refund accounting remain outside this release.
- **Operations UI:** operators can open/support customer order references, restock via API, and advance fulfilment. There is no store-wide admin dashboard, upload UI, shipment integration, or email notification service.
- **Account scope:** public signup cannot claim configured admin emails, but email verification and password recovery are not implemented. Provision operators directly before allowlisting.
- **Scale:** failed authentication attempts have per-process rate limits. Multiple API replicas need a shared limiter store. Catalogue reads are unpaginated; caching/job queues are not included.
- **Commerce scope:** INR, free delivery, and Indian pincode validation. No tax engine, coupons, returns, or international shipping.
- **External assets:** sample photography/fonts require network access and an asset-rights review before commercial reuse.
- **Verification boundary:** isolated real database/browser tests pass independently of developer credentials. Your actual database/network, provider account, hosted webhook delivery, and real HTTPS cookies still need the target-environment smoke test.

These boundaries define a tested Test Mode release. Enabling a production business with real money requires a separate operational/security review and the account, refund, and support features appropriate to that business.
