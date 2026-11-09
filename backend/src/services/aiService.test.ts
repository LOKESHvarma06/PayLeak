import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@google/genai";
import { financialContextFilters, toFriendlyError, toGeminiHistory } from "./aiService.js";

test("financial collection filters all bind to the authenticated user ID", () => {
  const filters = financialContextFilters("authenticated-user-id");
  assert.deepEqual(filters, {
    transactions: { userId: "authenticated-user-id" },
    invoices: { userId: "authenticated-user-id" },
    currencyConversions: { userId: "authenticated-user-id" },
  });
});

test("maps conversation history to Gemini user and model roles", () => {
  assert.deepEqual(toGeminiHistory([
    { role: "user", text: "Question" },
    { role: "assistant", text: "Answer" },
  ]), [
    { role: "user", parts: [{ text: "Question" }] },
    { role: "model", parts: [{ text: "Answer" }] },
  ]);
});

test("provides safe actionable errors for invalid keys, unavailable models, and quota", () => {
  const invalidKey = toFriendlyError(new ApiError({ status: 400, message: "API key not valid. Secret redacted." }));
  assert.equal(invalidKey.code, "GEMINI_INVALID_KEY");
  assert.equal(invalidKey.message.includes("Secret redacted"), false);

  const unavailableModel = toFriendlyError(new ApiError({ status: 404, message: "Not found" }));
  assert.equal(unavailableModel.code, "GEMINI_MODEL_UNAVAILABLE");

  const quota = toFriendlyError(new ApiError({ status: 429, message: "RESOURCE_EXHAUSTED" }));
  assert.equal(quota.code, "GEMINI_QUOTA_EXCEEDED");
});
