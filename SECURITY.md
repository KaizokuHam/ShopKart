# Security notes

Do not post secrets, database connection strings, tokens, shipping addresses, or payment details in public issues. For a suspected vulnerability, contact the repository owner privately through a channel they have published; this project does not declare a dedicated reporting address.

## Current controls

- Password hashing with bcrypt; password hashes are excluded from authenticated profile responses.
- Password changes verify the current password, store a new bcrypt hash, and invalidate older JWT sessions through a server-side authentication version.
- Signed, expiring JWT sessions in HTTP-only cookies. Secure cookies are enabled in production.
- Explicit credentialed CORS origins and bounded JSON request bodies.
- Ownership checks on private shopping data; product creation and fulfilment changes require configured administrative access.
- Server-derived payment totals and Razorpay signature, captured-status, currency, and amount checks.
- Transactional order, inventory, and cart updates; repeated confirmation cannot deduct inventory twice.
- No payment gateway secrets in the frontend bundle; local environment files are ignored by Git.
- Raw-body HMAC webhook verification, authenticated gateway reconciliation, and idempotent shared settlement.
- Unknown browser origins cannot perform writes, logout requires POST, and failed login/signup requests are rate limited.
- Production startup checks for HTTPS origins, a strong JWT secret, Test Mode keys, and a configured webhook secret. MongoDB topology is checked before serving checkout.

## Operational boundaries

This is a Test Mode application. Before real-money commerce, implement verified identity provisioning and email ownership verification, password recovery, production monitoring, backups, refund accounting, and an appropriate support process. An email allowlist is appropriate only for trusted accounts created by the operator before allowlisting. Configure the exact reverse-proxy hop count for IP-based rate limiting; its in-memory counters are per process. Cross-site cookies may be affected by browser third-party cookie restrictions.

Review [deployment limitations](docs/DEPLOYMENT.md), rotate exposed credentials, keep dependencies updated, and review dependency audit results before each release. There is no assertion here that the application has undergone an independent security audit.
