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

test("builds a single-currency PayPal invoice payload from validated invoice fields", async () => {
  const { buildPaypalInvoicePayload } = await import("./paypalInvoiceService.js");
  const payload = buildPaypalInvoicePayload({
    client: "Jordan Lee",
    email: "jordan@example.com",
    amount: "200.00",
    currency: "USD",
    description: "Consulting services",
    date: new Date("2026-11-09T00:00:00.000Z"),
    due: new Date("2026-11-24T00:00:00.000Z"),
  });

  assert.equal(payload.detail.invoice_date, "2026-11-09");
  assert.equal(payload.detail.currency_code, "USD");
  assert.equal(payload.detail.payment_term.term_type, "DUE_ON_DATE_SPECIFIED");
  assert.equal(payload.detail.payment_term.due_date, "2026-11-24");
  assert.equal(payload.primary_recipients[0]?.billing_info.email_address, "jordan@example.com");
  assert.deepEqual(payload.primary_recipients[0]?.billing_info.name, { given_name: "Jordan", surname: "Lee" });
  assert.equal(payload.items[0]?.quantity, "1");
  assert.deepEqual(payload.items[0]?.unit_amount, { currency_code: "USD", value: "200.00" });
});

test("creates invoices through PayPal with a request ID for safe retries", async () => {
  const originalFetch = globalThis.fetch;
  const { clearPaypalTokenCache } = await import("./paypalClient.js");
  const { createPaypalInvoiceRecord } = await import("./paypalInvoiceService.js");
  let requestUrl = "";
  let requestId: string | null = null;
  let prefer: string | null = null;
  let requestBody: Record<string, unknown> = {};

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "temporary-test-token",
        expires_in: 3600,
        scope: "https://uri.paypal.com/services/invoicing/invoices/read",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    requestUrl = url;
    requestId = new Headers(init?.headers).get("PayPal-Request-Id");
    prefer = new Headers(init?.headers).get("Prefer");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "PAYPAL-INVOICE-123",
      status: "DRAFT",
      detail: { invoice_number: "INV-2001" },
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    clearPaypalTokenCache();
    const created = await createPaypalInvoiceRecord({
      client: "Jordan Lee",
      email: "jordan@example.com",
      amount: "200.00",
      currency: "USD",
      description: "Consulting services",
      date: new Date("2026-11-09T00:00:00.000Z"),
      due: new Date("2026-11-24T00:00:00.000Z"),
    }, "d2719b58-b148-460e-995f-c2357406c060");
    assert.equal(requestUrl, "https://api-m.sandbox.paypal.com/v2/invoicing/invoices");
    assert.equal(requestId, "d2719b58-b148-460e-995f-c2357406c060");
    assert.equal(prefer, "return=representation");
    assert.equal(created.id, "PAYPAL-INVOICE-123");
    assert.equal(created.status, "DRAFT");
    assert.equal((requestBody.detail as { currency_code: string }).currency_code, "USD");
  } finally {
    clearPaypalTokenCache();
    globalThis.fetch = originalFetch;
  }
});

test("sends a PayPal invoice separately and confirms its status after a 204 response", async () => {
  const originalFetch = globalThis.fetch;
  const { clearPaypalTokenCache } = await import("./paypalClient.js");
  const { sendPaypalInvoiceRecord } = await import("./paypalInvoiceService.js");
  const requests: Array<{ path: string; method: string; requestId: string | null }> = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "temporary-test-token",
        expires_in: 3600,
        scope: "https://uri.paypal.com/services/invoicing/invoices/write",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    requests.push({
      path: url.pathname,
      method: init?.method ?? "GET",
      requestId: new Headers(init?.headers).get("PayPal-Request-Id"),
    });
    if (url.pathname.endsWith("/send")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({
      id: "PAYPAL-INVOICE-123",
      status: "SENT",
      detail: {
        invoice_number: "INV-2001",
        invoice_date: "2026-11-09",
        currency_code: "USD",
        payment_term: { due_date: "2026-11-24" },
      },
      primary_recipients: [{ billing_info: { email_address: "jordan@example.com" } }],
      items: [{ description: "Consulting services" }],
      amount: { value: "200.00", currency_code: "USD" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    clearPaypalTokenCache();
    const result = await sendPaypalInvoiceRecord("PAYPAL-INVOICE-123", "ab2e1533-8526-4d7a-8e54-37d4800ec987");
    assert.equal(result.status, "SENT");
    assert.deepEqual(requests.map(({ path, method }) => ({ path, method })), [
      { path: "/v2/invoicing/invoices/PAYPAL-INVOICE-123/send", method: "POST" },
      { path: "/v2/invoicing/invoices/PAYPAL-INVOICE-123", method: "GET" },
    ]);
    assert.equal(requests[0]?.requestId, "ab2e1533-8526-4d7a-8e54-37d4800ec987");
  } finally {
    clearPaypalTokenCache();
    globalThis.fetch = originalFetch;
  }
});
