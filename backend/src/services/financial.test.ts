import assert from "node:assert/strict";
import test from "node:test";
import { actualFee, calculateNetFromActual, convertUsingPayPalRate } from "./financial.js";
import { currencyPrecision } from "../utils/money.js";

test("preserves actual PayPal fee and its currency without adding a reference fee", () => {
  assert.deepEqual(actualFee("-44.30", "USD"), { value: "-44.30", currency: "USD", source: "actual_paypal" });
  assert.deepEqual(actualFee(null, null), { value: null, currency: null, source: "unavailable" });
});

test("calculates net only when gross and actual fee use the same currency", () => {
  assert.equal(calculateNetFromActual("1000.00", "USD", "-44.30", "USD"), "955.70");
  assert.equal(calculateNetFromActual("1000.00", "USD", "44.30", "EUR"), null);
  assert.equal(calculateNetFromActual("10.00", "USD", null, null), null);
});

test("applies an explicit PayPal rate direction and target currency precision", () => {
  assert.equal(convertUsingPayPalRate("10.00", "1.25", "base_to_quote", "USD"), "12.50");
  assert.equal(convertUsingPayPalRate("12.50", "1.25", "quote_to_base", "JPY"), "10");
  assert.equal(currencyPrecision("JPY"), 0);
  assert.equal(currencyPrecision("KWD"), 3);
});

test("rejects invalid exchange rates rather than substituting another source", () => {
  assert.throws(() => convertUsingPayPalRate("10.00", "0", "base_to_quote", "USD"));
  assert.throws(() => convertUsingPayPalRate("10.00", "not-a-rate", "base_to_quote", "USD"));
});
