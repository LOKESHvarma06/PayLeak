import assert from "node:assert/strict";
import test from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/payleak-test";
process.env.JWT_SECRET ??= "test-only-signing-secret-that-is-never-used";
process.env.FRONTEND_URL ??= "http://localhost:5173";
process.env.PAYPAL_MODE = "sandbox";
process.env.PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
process.env.PAYPAL_CLIENT_ID = "test-client-id";
process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
process.env.PAYPAL_ACCOUNT_OWNER_EMAIL = "";
process.env.PAYPAL_ACCOUNT_OWNER_USER_ID = "";

test("maps PayPal invoice statuses without inferring payment from transactions", async () => {
  const { mapPaypalInvoiceStatus } = await import("./paypalInvoiceService.js");
  const now = new Date("2026-11-09T12:00:00.000Z");
  const pastDue = new Date("2026-11-08T00:00:00.000Z");
  const dueToday = new Date("2026-11-09T00:00:00.000Z");
  const futureDue = new Date("2026-11-10T00:00:00.000Z");

  assert.equal(mapPaypalInvoiceStatus("DRAFT", futureDue, now), "Draft");
  assert.equal(mapPaypalInvoiceStatus("SENT", futureDue, now), "Sent");
  assert.equal(mapPaypalInvoiceStatus("UNPAID", pastDue, now), "Overdue");
  assert.equal(mapPaypalInvoiceStatus("SENT", dueToday, now), "Sent");
  assert.equal(mapPaypalInvoiceStatus("PARTIALLY_PAID", futureDue, now), "Partially Paid");
  assert.equal(mapPaypalInvoiceStatus("PARTIALLY_PAID", pastDue, now), "Overdue");
  assert.equal(mapPaypalInvoiceStatus("PAID", pastDue, now), "Paid");
  assert.equal(mapPaypalInvoiceStatus("CANCELLED", futureDue, now), "Cancelled");
  assert.equal(mapPaypalInvoiceStatus("REFUNDED", futureDue, now), "Refunded");
  assert.equal(mapPaypalInvoiceStatus("UNKNOWN", futureDue, now), null);
});

test("requests every PayPal Invoicing page and skips repeated invoice IDs", async () => {
  const originalFetch = globalThis.fetch;
  const { clearPaypalTokenCache } = await import("./paypalClient.js");
  const { getAllPaypalInvoicePages } = await import("./paypalInvoiceService.js");
  const requestedPages: number[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "temporary-test-token",
        expires_in: 3600,
        scope: "https://uri.paypal.com/services/invoicing/invoices/read",
        app_id: "APP-TEST-APP-ID",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const requestUrl = new URL(url);
    requestedPages.push(Number(requestUrl.searchParams.get("page")));
    assert.equal(requestUrl.pathname, "/v2/invoicing/invoices");
    assert.equal(requestUrl.searchParams.get("page_size"), "100");
    assert.equal(requestUrl.searchParams.get("total_required"), "true");
    const page = Number(requestUrl.searchParams.get("page"));
    return new Response(JSON.stringify({
      total_items: 3,
      total_pages: 2,
      page,
      items: page === 1 ? [{ id: "invoice-1" }, { id: "invoice-2" }] : [{ id: "invoice-2" }, { id: "invoice-3" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    clearPaypalTokenCache();
    const result = await getAllPaypalInvoicePages();
    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(result.paypalTotalItems, 3);
    assert.equal(result.paypalTotalPages, 2);
    assert.equal(result.invoices.length, 3);
    assert.equal(result.duplicateInvoicesSkipped, 1);
    assert.deepEqual(result.pages.map((item) => item.returnedItems), [2, 2]);
  } finally {
    clearPaypalTokenCache();
    globalThis.fetch = originalFetch;
  }
});
