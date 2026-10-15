import { test, expect } from "@playwright/test";

const api = "http://127.0.0.1:8096";
const password = "browser-test-password";
const pageErrors = new WeakMap();
const mockCheckout = `window.Razorpay = function(options) {
  let failure;
  this.on = (event, handler) => { if (event === 'payment.failed') failure = handler; };
  this.open = () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Test payment gateway');
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); options.modal.ondismiss(); };
    for (const action of ['Success', 'Failure', 'Cancel', 'Pending', 'Lost callback']) {
      const button = document.createElement('button'); button.textContent = 'Test ' + action;
      dialog.appendChild(button);
      button.onclick = async () => {
        if (action === 'Cancel') return close();
        const status = action === 'Failure' ? 'failed' : action === 'Pending' ? 'authorized' : 'captured';
        const response = await fetch('${api}/__test/payment', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orderId:options.order_id,status}) });
        const proof = await response.json(); window.__testPayment = proof;
        if (action === 'Failure') failure({ error:{ description:'Test bank declined the payment', metadata:{payment_id:proof.razorpay_payment_id} } });
        else if (action !== 'Lost callback') options.handler(proof);
        close();
      };
    }
    dialog.showModal();
  };
};`;

test.beforeEach(async ({ page }) => {
  pageErrors.set(page, []);
  page.on("pageerror", error => pageErrors.get(page).push(error.message));
  await page.route("https://checkout.razorpay.com/v1/checkout.js", route => route.fulfill({ contentType: "application/javascript", body: mockCheckout }));
  await page.route(/https:\/\/(images\.unsplash\.com|example\.test)\//, route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#dedfd5"/></svg>' }));
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function signUpAndLogin(page) {
  const email = `shopper-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill("Browser Shopper");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Phone number", { exact: true }).fill("9876543210");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Log in/i }).click();
  await expect(page).toHaveURL(/\/home$/);
  return email;
}
async function startCheckout(page) {
  await page.goto("/products");
  const lamp = page.locator("article").filter({ hasText: "Test Desk Lamp" });
  await lamp.getByRole("button", { name: "Add to Cart" }).click();
  await expect(lamp.getByRole("status")).toContainText("Added to cart");
  await page.goto("/checkout");
  await page.getByLabel("Street Address *", { exact: true }).fill("12 Test Road");
  await page.getByLabel("City *", { exact: true }).fill("Pune");
  await page.getByLabel("State *", { exact: true }).fill("Maharashtra");
  await page.getByLabel("Pincode *", { exact: true }).fill("411001");
  await page.getByRole("button", { name: /Pay .* with Razorpay/ }).click();
  await expect(page.getByRole("dialog", { name: "Test payment gateway" })).toBeVisible();
}

test("signup, wishlist, bag, checkout success and order history", async ({ page }) => {
  await signUpAndLogin(page);
  await page.goto("/products");
  await page.getByRole("button", { name: "Save Test Desk Lamp", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Test Desk Lamp from favourites" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/wishlist");
  await expect(page.getByText("Test Desk Lamp", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove from wishlist" }).click();
  await expect(page.getByText("Your wishlist is empty", { exact: true })).toBeVisible();
  await page.goto("/products");
  await page.getByRole("link", { name: "Test Desk Lamp", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Desk Lamp", exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Welcome, Browser Shopper", exact: true })).toBeVisible();
  await startCheckout(page);
  await page.getByRole("button", { name: "Test Success", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order Placed Successfully!" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /Your cart is empty/ })).toBeVisible();
  await page.goto("/orders");
  await expect(page.getByRole("link", { name: /View Details/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("failure and cancellation preserve the bag and allow a safe new attempt", async ({ page }) => {
  await signUpAndLogin(page);
  await startCheckout(page);
  await page.getByRole("button", { name: "Test Failure", exact: true }).click();
  await expect(page.getByText("Payment unsuccessful", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeEnabled();
  await page.getByRole("button", { name: /Pay .* with Razorpay/ }).click();
  await page.getByRole("button", { name: "Test Cancel", exact: true }).click();
  await expect(page.getByText("Checkout cancelled", { exact: true })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText("Test Desk Lamp", { exact: true })).toBeVisible();
});

test("pending capture survives refresh and retries the same payment", async ({ page, request }) => {
  await signUpAndLogin(page);
  await startCheckout(page);
  await page.getByRole("button", { name: "Test Pending", exact: true }).click();
  await expect(page.getByText("Payment confirmation pending", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeDisabled();
  const payment = await page.evaluate(() => window.__testPayment);
  await request.post(api + "/__test/capture", { data: { paymentId: payment.razorpay_payment_id } });
  await page.reload();
  await page.getByRole("button", { name: "Retry confirmation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order Placed Successfully!" })).toBeVisible();
});

test("lost callback can be recovered from order details", async ({ page }) => {
  await signUpAndLogin(page);
  await startCheckout(page);
  await page.getByRole("button", { name: "Test Lost callback", exact: true }).click();
  await page.goto("/orders");
  await page.getByRole("link", { name: /View Details/ }).click();
  await page.getByRole("button", { name: "Check payment status", exact: true }).click();
  await expect(page.getByText("Payment: PAID", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check payment status", exact: true })).toHaveCount(0);
});

test("guest redirects, expiry, 404 and mobile navigation are recoverable", async ({ page, context }, testInfo) => {
  const email = await signUpAndLogin(page);
  await context.clearCookies();
  await page.goto("/cart");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Log in/i }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.goto("/not-a-real-page");
  await expect(page.getByRole("heading", { name: "This page wandered away." })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("smooth scrolling respects reduced motion and malformed anchors stay safe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.getByRole("link", { name: "Find your edit", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  await page.goto("/#%E0%A4%A");
  await expect(page.getByRole("link", { name: "Explore the collection", exact: true }).first()).toBeVisible();
});

test("Home shows the profile and password change remains usable", async ({ page }, testInfo) => {
  const email = await signUpAndLogin(page);
  const profile = page.getByRole("region", { name: "Customer profile" });
  await expect(profile).toContainText("Welcome, Browser Shopper");
  await expect(profile).toContainText(email);
  await expect(profile).toContainText("9876543210");
  await page.goto("/profile");
  await page.getByLabel("Current password", { exact: true }).fill("wrong-password");
  await page.getByLabel("New password", { exact: true }).fill("updated-browser-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("updated-browser-password");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Current password is incorrect");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Password changed successfully");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Profile information", exact: true })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name: "Log out", exact: true }).click();
  } else await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Log in/i }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid Credentials");
  await page.getByLabel("Password", { exact: true }).fill("updated-browser-password");
  await page.getByRole("button", { name: /Log in/i }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("search/category/sort, visible details, quantity totals and persistence", async ({ page }) => {
  await signUpAndLogin(page);
  await page.goto("/products");
  await page.getByRole("searchbox", { name: "Search products" }).fill("Field Notes");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("Test Field Notes");
  await page.getByRole("combobox", { name: "Filter by category" }).selectOption("Home");
  await expect(page.getByText("No products found.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("combobox", { name: "Filter by category" }).selectOption("");
  await page.getByRole("combobox", { name: "Sort products" }).selectOption("price_asc");
  await expect(page.locator("article").first()).toContainText("Test Field Notes");
  const lamp = page.locator("article").filter({ hasText: "Test Desk Lamp" });
  await expect(lamp.getByRole("link", { name: /View Details/ })).toBeVisible();
  await lamp.getByRole("button", { name: "Add to Cart" }).click();
  await expect(lamp.getByRole("status")).toContainText("Added to cart");
  await page.goto("/cart");
  await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
  await expect(page.getByRole("link", { name: "Shopping bag, 2 items", exact: true })).toBeVisible();
  await expect(page.locator("article")).toContainText("₹200.5");
  await page.reload();
  await expect(page.getByRole("link", { name: "Shopping bag, 2 items", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Decrease quantity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Decrease quantity", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Your cart is empty/ })).toBeVisible();
});

test("loading, error, retry, empty and shipping-validation states", async ({ page }) => {
  await signUpAndLogin(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(api + "/wishlist", async route => { await gate; await route.continue(); });
  await page.goto("/wishlist");
  await expect(page.getByText("Loading your wishlist...", { exact: true })).toBeVisible();
  release();
  await expect(page.getByText("Your wishlist is empty", { exact: true })).toBeVisible();
  await page.unroute(api + "/wishlist");
  for (const resource of ["wishlist", "cart", "orders"]) {
    await page.route(api + "/" + resource, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Test service unavailable" }) }));
    await page.goto("/" + resource);
    await expect(page.getByRole("button", { name: "Try Again", exact: true })).toBeVisible();
    await page.unroute(api + "/" + resource);
    await page.getByRole("button", { name: "Try Again", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try Again", exact: true })).toHaveCount(0);
  }
  await page.goto("/products");
  const lamp = page.locator("article").filter({ hasText: "Test Desk Lamp" });
  await lamp.getByRole("button", { name: "Add to Cart" }).click();
  await expect(lamp.getByRole("status")).toContainText("Added to cart");
  await page.goto("/checkout");
  let createRequests = 0;
  page.on("request", request => { if (request.url().endsWith("/orders/create-payment-order")) createRequests++; });
  await page.getByRole("button", { name: /Pay .* with Razorpay/ }).click();
  await expect(page.getByText("Address is required", { exact: true })).toBeVisible();
  expect(createRequests).toBe(0);
});
