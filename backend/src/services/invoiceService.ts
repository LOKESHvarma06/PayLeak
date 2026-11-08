import { Types } from "mongoose";
import { Client } from "../models/Client.js";
import { Invoice } from "../models/Invoice.js";
import { AppError } from "../utils/errors.js";

export async function listInvoices(userId: string) {
  const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 }).lean();
  return invoices.map(toFrontendInvoice);
}

export async function createInvoice(userId: string, input: {
  clientId?: string; client: string; email: string; amount: string; currency: string; description: string; date: Date; due: Date;
}) {
  let clientId: Types.ObjectId | null = null;
  if (input.clientId) {
    const client = await Client.findOne({ _id: input.clientId, userId });
    if (!client) throw new AppError(404, "Client not found.", "CLIENT_NOT_FOUND");
    clientId = client._id;
  }
  const invoice = await Invoice.create({
    userId,
    clientId,
    client: input.client,
    email: input.email,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    invoiceDate: input.date,
    dueDate: input.due,
    status: "Draft",
  });
  return toFrontendInvoice(invoice.toObject());
}

export async function getInvoice(userId: string, id: string) {
  const invoice = await Invoice.findOne({ _id: id, userId }).lean();
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  return toFrontendInvoice(invoice);
}

export async function updateInvoice(userId: string, id: string, input: Partial<{
  clientId: string; client: string; email: string; amount: string; currency: string; description: string; date: Date; due: Date; status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
}>) {
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
  const invoice = await Invoice.findOne({ _id: id, userId });
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  throw new AppError(503, "Sending invoices requires a verified PayPal merchant connection and Invoicing API permission. The invoice was not sent.", "PAYPAL_INVOICING_UNAVAILABLE");
}

function toFrontendInvoice(invoice: {
  _id: unknown; client: string; email: string; amount: string; currency: string; description: string;
  invoiceDate: Date; dueDate: Date; status: string; paypalInvoiceId?: string | null;
}) {
  return {
    id: String(invoice._id),
    client: invoice.client,
    email: invoice.email,
    amount: invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
    date: invoice.invoiceDate.toISOString().slice(0, 10),
    due: invoice.dueDate.toISOString().slice(0, 10),
    status: invoice.status,
    paypalId: invoice.paypalInvoiceId,
    source: "payleak_database",
  };
}
