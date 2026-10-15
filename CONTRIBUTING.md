# Contributing

1. Follow the setup instructions in [README.md](README.md). Use your own development database and Razorpay Test Mode credentials.
2. Keep changes focused. Preserve the ivory/forest design tokens and support keyboard navigation, small screens, and reduced motion.
3. Keep API calls in `client/frontend/src/services`, access controls on the server, and all secrets in the backend environment.
4. For commerce changes, include meaningful regression coverage for stock, ownership, payment verification, or callback races. Never bypass signature checks to make a demo pass.
5. Run `npm run check` and the relevant [manual checks](docs/TESTING.md).
6. Describe the behavior changed, how it was verified, and any limitations in your pull request.

Do not commit `.env`, database files, `node_modules`, build outputs, or real customer/payment data. Sample catalogue seeding must remain non-destructive. Root, backend, and frontend package lockfiles are maintained separately; install dependencies in the package that actually uses them.
