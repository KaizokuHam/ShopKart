import { test } from "node:test";
import assert from "node:assert/strict";
import { returnPath } from "../src/utils/navigation.js";

test("sign-in returns to a safe requested app page", () => {
  assert.equal(returnPath("/cart"), "/cart");
  assert.equal(returnPath("/products?category=Home"), "/products?category=Home");
  for (const unsafe of [undefined, "https://other.example", "//other.example", "/\\other.example", "/login", "/signup?redirect=/cart"]) assert.equal(returnPath(unsafe), "/home");
});
