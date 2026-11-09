import assert from "node:assert/strict";
import test from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/payleak-test";
process.env.JWT_SECRET ??= "test-only-signing-secret-that-is-never-used";
process.env.FRONTEND_URL ??= "http://localhost:5173";
process.env.NODE_ENV = "test";

test("health and protected route responses use the documented API envelope", async (context) => {
  const { app } = await import("./app.js");
  const server = app.listen(0, "127.0.0.1");
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { success: boolean; data: { databaseName: string | null } };
  assert.equal(healthBody.success, true);
  assert.equal(healthBody.data.databaseName, null);

  const protectedResponse = await fetch(`${baseUrl}/api/transactions`);
  assert.equal(protectedResponse.status, 401);
  assert.equal((await protectedResponse.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedPaypalConfig = await fetch(`${baseUrl}/api/paypal/config`);
  assert.equal(protectedPaypalConfig.status, 401);
  assert.equal((await protectedPaypalConfig.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedPaypalDiagnostics = await fetch(`${baseUrl}/api/paypal/diagnostics`, { method: "POST" });
  assert.equal(protectedPaypalDiagnostics.status, 401);
  assert.equal((await protectedPaypalDiagnostics.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedInvoiceSync = await fetch(`${baseUrl}/api/invoices/sync-paypal`, { method: "POST" });
  assert.equal(protectedInvoiceSync.status, 401);
  assert.equal((await protectedInvoiceSync.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedInvoiceDiagnostics = await fetch(`${baseUrl}/api/invoices/paypal/diagnostics`, { method: "POST" });
  assert.equal(protectedInvoiceDiagnostics.status, 401);
  assert.equal((await protectedInvoiceDiagnostics.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedAiChat = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Summarize my transactions." }),
  });
  assert.equal(protectedAiChat.status, 401);
  assert.equal((await protectedAiChat.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedAiDiagnostics = await fetch(`${baseUrl}/api/ai/diagnostics`, { method: "POST" });
  assert.equal(protectedAiDiagnostics.status, 401);
  assert.equal((await protectedAiDiagnostics.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const protectedOrderCreation = await fetch(`${baseUrl}/api/paypal/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: "1.00", currency: "USD", description: "Test" }),
  });
  assert.equal(protectedOrderCreation.status, 401);
  assert.equal((await protectedOrderCreation.json() as { error: { code: string } }).error.code, "AUTH_REQUIRED");

  const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short" }),
  });
  assert.equal(invalidRegistration.status, 400);
});
