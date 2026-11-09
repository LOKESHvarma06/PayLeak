import { Types } from "mongoose";
import { Client } from "../models/Client.js";
import { Invoice } from "../models/Invoice.js";
import { AppError } from "../utils/errors.js";
import { createPaypalInvoice, publishLocalInvoiceToPaypal, sendPaypalInvoice } from "./paypalInvoiceService.js";

export async function listInvoices(userId: string) {
  const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 }).lean();
  return invoices.map(toFrontendInvoice);
}

export async function createInvoice(userId: string, input: {
  clientId?: string; client: string; email: string; amount: string; currency: string; description: string; date: Date; due: Date;
}, requestId: string) {
  let clientId: Types.ObjectId | null = null;
  if (input.clientId) {
    const client = await Client.findOne({ _id: input.clientId, userId });
    if (!client) throw new AppError(404, "Client not found.", "CLIENT_NOT_FOUND");
    clientId = client._id;
  }
  const invoice = await createPaypalInvoice(userId, { ...input, clientId: clientId ? String(clientId) : undefined }, requestId);
  return toFrontendInvoice(invoice);
}

export async function publishInvoiceToPaypal(userId: string, id: string, requestId: string) {
  return toFrontendInvoice(await publishLocalInvoiceToPaypal(userId, id, requestId));
}

export async function getInvoice(userId: string, id: string) {
  const invoice = await Invoice.findOne({ _id: id, userId }).lean();
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  return toFrontendInvoice(invoice);
}

export async function updateInvoice(userId: string, id: string, input: Partial<{
  clientId: string; client: string; email: string; amount: string; currency: string; description: string; date: Date; due: Date;
}>) {
  const existing = await Invoice.findOne({ _id: id, userId }).select("source paypalRequestId");
  if (!existing) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  if (existing.source === "paypal" || existing.paypalRequestId) {
    throw new AppError(409, "PayPal-linked invoices are managed by PayPal. Sync the invoice to refresh its details and status.", "PAYPAL_INVOICE_MANAGED");
  }
  const fields: Record<string, unknown> = { ...input };
  if (input.date) fields.invoiceDate = input.date;
  if (input.due) fields.dueDate = input.due;
  delete fields.date;
  delete fields.due;
  if (input.clientId) {
    const client = await Client.findOne({ _id: input.clientId, userId });
    if (!client) throw new AppError(404, "Client not found.", "CLIENT_NOT_FOUND");
    fields.clientId = client._id;
  }
  const invoice = await Invoice.findOneAndUpdate({ _id: id, userId }, { $set: fields }, { new: true, runValidators: true }).lean();
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  return toFrontendInvoice(invoice);
}

export async function deleteInvoice(userId: string, id: string) {
  const invoice = await Invoice.findOneAndDelete({ _id: id, userId });
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
}

export async function sendInvoice(userId: string, id: string) {
  return toFrontendInvoice(await sendPaypalInvoice(userId, id));
}

function toFrontendInvoice(invoice: {
  _id: unknown; client: string; email: string; amount: string; currency: string; description: string;
  invoiceDate: Date; dueDate?: Date | null; status: string; paypalInvoiceId?: string | null;
  invoiceNumber?: string | null; customerEmail?: string | null; customerName?: string | null;
  subtotal?: string | null; tax?: string | null; totalAmount?: string | null; paymentAmount?: string | null;
  paymentDate?: Date | null; invoiceUrl?: string | null; source?: string;
  paypalStatus?: string | null; paypalLastSyncedAt?: Date | null;
}) {
  const id = String(invoice._id);
  let status = invoice.status;
  if ((status === "Sent" || status === "Partially Paid") && invoice.dueDate) {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const dueUtc = new Date(invoice.dueDate);
    dueUtc.setUTCHours(0, 0, 0, 0);
    if (dueUtc.getTime() < todayUtc.getTime()) status = "Overdue";
  }
  return {
    id,
    invoiceNumber: invoice.invoiceNumber ?? id,
    client: invoice.customerName || invoice.client || "Unknown customer",
    email: invoice.customerEmail || invoice.email || "",
    amount: invoice.totalAmount ?? invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
    date: invoice.invoiceDate.toISOString().slice(0, 10),
    due: invoice.dueDate?.toISOString().slice(0, 10) ?? null,
    status,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    paymentAmount: invoice.paymentAmount,
    paymentDate: invoice.paymentDate?.toISOString().slice(0, 10) ?? null,
    invoiceUrl: invoice.invoiceUrl,
    paypalId: invoice.paypalInvoiceId,
    source: invoice.source ?? "payleak",
    paypalStatus: invoice.paypalStatus ?? null,
    paypalLastSyncedAt: invoice.paypalLastSyncedAt?.toISOString() ?? null,
  };
}
