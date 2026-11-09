import { api, endpoints, responseData } from "./api.js";

export async function fetchInvoices() {
  return responseData(await api.get(endpoints.invoices));
}

export async function syncPaypalInvoices() {
  return responseData(await api.post(`${endpoints.invoices}/sync-paypal`, {}, { timeout: 120000 }));
}

export async function diagnosePaypalInvoices() {
  return responseData(await api.post(`${endpoints.invoices}/paypal/diagnostics`, {}, { timeout: 30000 }));
}

export async function saveInvoice(invoice, idempotencyKey) {
  return responseData(await api.post(endpoints.invoices, invoice, {
    headers: { "Idempotency-Key": idempotencyKey },
    timeout: 30000,
  }));
}

export async function sendInvoice(id) {
  return responseData(await api.post(`${endpoints.invoices}/${encodeURIComponent(id)}/send`, {}, { timeout: 30000 }));
}

export async function publishInvoiceToPaypal(id, idempotencyKey) {
  return responseData(await api.post(
    `${endpoints.invoices}/${encodeURIComponent(id)}/paypal`,
    {},
    { headers: { "Idempotency-Key": idempotencyKey }, timeout: 30000 },
  ));
}

export async function updateInvoice(id, fields) {
  return responseData(await api.put(`${endpoints.invoices}/${encodeURIComponent(id)}`, fields));
}

export function extractInvoiceDetails(prompt) {
  const amountMatch = prompt.match(/(?:\$|\u20AC|\u00A3|\u20B9)\s?([\d,]+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : "";
  const currency = prompt.includes("\u20AC") ? "EUR" : prompt.includes("\u00A3") ? "GBP" : prompt.includes("\u20B9") ? "INR" : "USD";
  const clientMatch = prompt.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  const daysMatch = prompt.match(/due in\s+(\d+)\s+days?/i);
  const promptTail = amountMatch ? prompt.slice(amountMatch.index + amountMatch[0].length) : prompt;
  const descriptionMatch = promptTail.match(/for\s+(.+?)(?:,\s*due|,\s*email|$)/i);
  const description = descriptionMatch?.[1]?.trim() || "Professional services";
  const due = new Date();
  due.setDate(due.getDate() + Number(daysMatch?.[1] || 14));
  return {
    client: clientMatch?.[1] || "",
    email: prompt.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "",
    amount,
    currency,
    description,
    date: new Date().toISOString().slice(0, 10),
    due: due.toISOString().slice(0, 10),
  };
}
