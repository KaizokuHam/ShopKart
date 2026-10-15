import { test } from "node:test";
import assert from "node:assert/strict";
import { removePurchasedItems } from "../src/utils/cartSettlement.js";

const purchase = { product: "keyboard", cartItemId: "original", quantity: 2 };
test("verified ordinary purchase immediately empties the frontend cart", () => {
  assert.deepEqual(removePurchasedItems([{ _id: "original", product: { _id: "keyboard" }, quantity: 2 }], [purchase]), []);
});
test("confirmed purchase preserves additional quantities and new products", () => {
  const cart = [{ _id: "original", product: { _id: "keyboard" }, quantity: 3 }, { _id: "new-book", product: { _id: "book" }, quantity: 1 }];
  const result = removePurchasedItems(cart, [purchase]);
  assert.equal(result[0].quantity, 1); assert.equal(result[1].quantity, 1); assert.equal(cart[0].quantity, 3);
});
test("removing and re-adding a product gives a new line that survives confirmation", () => {
  const cart = [{ _id: "re-added", product: { _id: "keyboard" }, quantity: 1 }];
  assert.deepEqual(removePurchasedItems(cart, [purchase]), cart);
});
