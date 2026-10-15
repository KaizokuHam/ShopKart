import Razorpay from "razorpay";
import "./env.js";

export const paymentConfigured = () =>
  process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") &&
  Boolean(process.env.RAZORPAY_KEY_SECRET);

const client = () => {
  if (!paymentConfigured()) throw new Error("Configure Razorpay Test Mode credentials");
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  // The SDK exposes its Axios transport; bound provider requests as well as UI waits.
  instance.api.rq.defaults.timeout = 10000;
  return instance;
};
const razorpay = {
  orders: {
    create: options => client().orders.create(options),
    fetchPayments: id => client().orders.fetchPayments(id),
  },
  payments: { fetch: id => client().payments.fetch(id) },
};

export default razorpay;
