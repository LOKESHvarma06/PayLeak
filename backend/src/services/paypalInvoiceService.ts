import { Decimal } from "decimal.js";
import { env } from "../config/env.js";
import { Invoice } from "../models/Invoice.js";
import { AppError } from "../utils/errors.js";
import { assertConfiguredOwner } from "./paypalService.js";
import { ensurePaypalInvoiceIndex } from "./invoiceIndexService.js";
import { paypalRequest, verifyPaypalInvoiceOAuth } from "./paypalClient.js";

const invoiceReadScope = "https://uri.paypal.com/services/invoicing/invoices/read";

interface PaypalMoney {
  value?: string;
  currency_code?: string;
}

interface PaypalInvoiceRecord {
  id?: string;
  status?: string;
  create_time?: string;
  detail?: {
    invoice_number?: string;
    invoice_date?: string;
    currency_code?: string;
    memo?: string;
    note?: string;
    reference?: string;
    payment_term?: { due_date?: string };
  };
  primary_recipients?: Array<{
    billing_info?: {
      email_address?: string;
      name?: { given_name?: string; surname?: string; full_name?: string };
    };
  }>;
  items?: Array<{ name?: string; description?: string }>;
  amount?: {
    value?: string;
    currency_code?: string;
    breakdown?: {
      item_total?: PaypalMoney;
      tax_total?: PaypalMoney;
    };
  };
  payment_summary?: {
    paid_amount?: PaypalMoney;
    payments?: Array<{
      paid_amount?: PaypalMoney;
      transactions?: Array<{ payment_date?: string }>;
    }>;
    refunds?: Array<{ amount?: PaypalMoney; refund_date?: string }>;
  };
  links?: Array<{ href?: string; rel?: string }>;
}

interface PaypalInvoiceList {
  total_items?: number;
  total_pages?: number;
  page?: number;
  items?: PaypalInvoiceRecord[];
}

interface InvoicePageDiagnostic {
  page: number;
  pageSize: number;
  httpStatus: number | null;
  totalItems: number;
  totalPages: number | null;
  returnedItems: number;
}

function extractError(error: unknown) {
  if (!(error instanceof AppError)) {
    return {
      httpStatus: null,
      name: null,
      message: error instanceof Error ? error.message : "PayPal request failed.",
      debugId: null,
    };
  }
  const details = error.details && typeof error.details === "object"
    ? error.details as Record<string, unknown>
    : {};
  return {
    httpStatus: typeof details.httpStatus === "number" ? details.httpStatus : null,
    name: typeof details.paypalErrorName === "string" ? details.paypalErrorName : null,
    message: typeof details.paypalMessage === "string" ? details.paypalMessage : error.message,
    debugId: typeof details.debugId === "string" ? details.debugId : null,
  };
}

function invoiceError(
  error: unknown,
  context: Record<string, unknown>,
) {
  const details = error instanceof AppError && error.details && typeof error.details === "object"
    ? error.details as Record<string, unknown>
    : {};
  const apiError = extractError(error);
  return new AppError(
    error instanceof AppError ? error.statusCode : 502,
    error instanceof AppError ? error.message : "PayPal invoice synchronization failed.",
    error instanceof AppError ? error.code : "PAYPAL_INVOICE_SYNC_FAILED",
    { ...context, ...details, paypalApiError: apiError },
  );
}

async function getInvoicePage(page: number, onStatus: (status: number) => void) {
  const query = new URLSearchParams({
    page: String(page),
    page_size: "100",
    total_required: "true",
  });
  return paypalRequest<PaypalInvoiceList>(
    `/v2/invoicing/invoices?${query.toString()}`,
    {},
    onStatus,
  );
}

async function getInvoiceDetails(invoiceId: string, onStatus: (status: number) => void) {
  return paypalRequest<PaypalInvoiceRecord>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
    {},
    onStatus,
  );
}

export async function getAllPaypalInvoicePages() {
  const pages: InvoicePageDiagnostic[] = [];
  const seenIds = new Set<string>();
  const invoices: PaypalInvoiceRecord[] = [];
  let duplicateInvoicesSkipped = 0;
  let paypalTotalItems: number | null = null;
  let paypalTotalPages: number | null = null;
  let totalPages = 1;
  let page = 1;
  do {
    let httpStatus: number | null = null;
    let response: PaypalInvoiceList;
    try {
      response = await getInvoicePage(page, (status) => { httpStatus = status; });
    } catch (error) {
      throw invoiceError(error, {
        paypalHttpStatus: httpStatus,
        paypalTotalItems,
        paypalTotalPages,
        invoicesRetrieved: invoices.length,
        duplicateInvoicesSkipped,
        pages: [...pages, {
          page,
          pageSize: 100,
          httpStatus,
          totalItems: paypalTotalItems ?? 0,
          totalPages: paypalTotalPages,
          returnedItems: 0,
        }],
      });
    }
    const records = response.items ?? [];
    totalPages = response.total_pages ?? 1;
    paypalTotalPages = totalPages;
    if (page === 1) paypalTotalItems = response.total_items ?? records.length;
    pages.push({
      page: response.page ?? page,
      pageSize: 100,
      httpStatus,
      totalItems: paypalTotalItems ?? records.length,
      totalPages: paypalTotalPages,
      returnedItems: records.length,
    });
    for (const invoice of records) {
      if (invoice.id && seenIds.has(invoice.id)) {
        duplicateInvoicesSkipped += 1;
        continue;
      }
      if (invoice.id) seenIds.add(invoice.id);
      invoices.push(invoice);
    }
    if (totalPages > 1000) {
      throw new AppError(413, "PayPal returned more invoice pages than the API supports.", "PAYPAL_INVOICE_RESULT_LIMIT", {
        paypalTotalItems,
        paypalTotalPages,
        pages,
      });
    }
    page += 1;
  } while (page <= totalPages);
  return { invoices, pages, paypalTotalItems, paypalTotalPages, duplicateInvoicesSkipped };
}

async function getOwnerInvoiceCount(userId: string) {
  return Invoice.countDocuments({ userId });
}

export async function diagnosePaypalInvoiceAccess(userId: string) {
  const owner = await assertConfiguredOwner(userId);
  const result = {
    payLeakUserId: String(owner._id),
    environment: env.PAYPAL_MODE,
    applicationOAuth: "not_tested",
    paypalApplicationId: null as string | null,
    clientIdLast4: env.PAYPAL_CLIENT_ID ? env.PAYPAL_CLIENT_ID.slice(-4) : null,
    merchantAccount: "not_returned_by_client_credentials_api",
    invoiceReadPermission: "not_tested",
    paypalHttpStatus: null as number | null,
    paypalTotalItems: null as number | null,
    paypalTotalPages: null as number | null,
    invoicesRetrieved: 0,
    invoicesInserted: 0,
    invoicesUpdated: 0,
    duplicateInvoicesSkipped: 0,
    totalInvoicesStoredInMongoDB: await getOwnerInvoiceCount(String(owner._id)),
    paypalApiError: null as ReturnType<typeof extractError> | null,
    guidance: "",
  };
  try {
    const oauth = await verifyPaypalInvoiceOAuth();
    result.applicationOAuth = "verified";
    result.paypalApplicationId = oauth.appId;
    result.invoiceReadPermission = oauth.invoiceReadScope;
  } catch (error) {
    result.applicationOAuth = error instanceof AppError && error.code === "PAYPAL_AUTH_FAILED" ? "rejected" : "unavailable";
    result.paypalApiError = extractError(error);
    result.guidance = "PayPal application OAuth could not be verified.";
    return result;
  }

  try {
    const firstPage = await getInvoicePage(1, (status) => { result.paypalHttpStatus = status; });
    result.paypalTotalItems = firstPage.total_items ?? null;
    result.paypalTotalPages = firstPage.total_pages ?? null;
    result.invoicesRetrieved = firstPage.items?.length ?? 0;
    if (result.invoiceReadPermission !== "present") {
      result.guidance = "The Invoice API responded, but OAuth did not include the required invoice read permission. No invoices were imported.";
    } else {
      result.guidance = "PayPal Invoice API access is authorized.";
    }
  } catch (error) {
    result.paypalApiError = extractError(error);
    result.paypalHttpStatus = result.paypalApiError.httpStatus;
    result.guidance = result.paypalApiError.httpStatus === 403
      ? "PayPal denied invoice access. The REST app or Sandbox Business account must be granted the Invoicing API read permission."
      : "The PayPal Invoice API request failed.";
  }
  return result;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCustomerName(invoice: PaypalInvoiceRecord) {
  const name = invoice.primary_recipients?.[0]?.billing_info?.name;
  if (!name) return "";
  return name.full_name || [name.given_name, name.surname].filter(Boolean).join(" ");
}

function amountValue(amount: PaypalMoney | undefined) {
  return amount?.value && Number.isFinite(Number(amount.value)) ? amount.value : null;
}

function getPaidAmount(invoice: PaypalInvoiceRecord) {
  const summary = invoice.payment_summary;
  const paid = amountValue(summary?.paid_amount);
  if (paid !== null) return paid;
  const payments = summary?.payments ?? [];
  const values = payments.map((payment) => amountValue(payment.paid_amount)).filter((value): value is string => value !== null);
  return values.length
    ? values.reduce((total, value) => total.plus(value), new Decimal(0)).toString()
    : null;
}

function getLatestPaymentDate(invoice: PaypalInvoiceRecord) {
  const dates = (invoice.payment_summary?.payments ?? [])
    .flatMap((payment) => payment.transactions ?? [])
    .map((transaction) => parseDate(transaction.payment_date))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => right.getTime() - left.getTime());
  return dates[0] ?? null;
}

export function mapPaypalInvoiceStatus(paypalStatusValue: string | undefined, dueDate: Date | null, now = new Date()) {
  const paypalStatus = paypalStatusValue?.toUpperCase();
  const isPastDue = () => {
    if (!dueDate) return false;
    const todayUtc = new Date(now);
    todayUtc.setUTCHours(0, 0, 0, 0);
    const dueUtc = new Date(dueDate);
    dueUtc.setUTCHours(0, 0, 0, 0);
    return dueUtc.getTime() < todayUtc.getTime();
  };
  if (paypalStatus === "PAID" || paypalStatus === "MARKED_AS_PAID") return "Paid";
  if (paypalStatus === "REFUNDED") return "Refunded";
  if (paypalStatus === "CANCELLED") return "Cancelled";
  if (paypalStatus === "DRAFT") return "Draft";
  if (paypalStatus === "PARTIALLY_PAID") return isPastDue() ? "Overdue" : "Partially Paid";
  if (paypalStatus !== "SENT" && paypalStatus !== "UNPAID" && paypalStatus !== "SCHEDULED" && paypalStatus !== "OVERDUE") return null;
  if (paypalStatus === "OVERDUE") return "Overdue";
  if (isPastDue()) return "Overdue";
  return "Sent";
}

function mapPaypalInvoice(userId: string, invoice: PaypalInvoiceRecord) {
  const paypalInvoiceId = invoice.id;
  const invoiceDate = parseDate(invoice.detail?.invoice_date) ?? parseDate(invoice.create_time);
  const dueDate = parseDate(invoice.detail?.payment_term?.due_date);
  const totalAmount = amountValue(invoice.amount);
  const currency = invoice.detail?.currency_code ?? invoice.amount?.currency_code;
  const status = mapPaypalInvoiceStatus(invoice.status, dueDate);
  if (!paypalInvoiceId || !invoiceDate || !totalAmount || !currency || !status) return null;

  const recipient = invoice.primary_recipients?.[0]?.billing_info;
  const customerName = getCustomerName(invoice);
  const description = invoice.detail?.memo
    || invoice.detail?.note
    || invoice.detail?.reference
    || (invoice.items ?? []).map((item) => item.description || item.name).filter(Boolean).join(", ");
  const invoiceUrl = invoice.links?.find((link) => link.rel === "payer-view")?.href
    ?? invoice.links?.find((link) => link.rel === "recipient-view")?.href
    ?? null;
  const total = invoice.amount?.breakdown;
  const payments = invoice.payment_summary?.payments ?? [];
  const paymentAmount = getPaidAmount(invoice);
  const paymentDate = getLatestPaymentDate(invoice);

  return {
    userId,
    paypalInvoiceId,
    invoiceNumber: invoice.detail?.invoice_number ?? null,
    client: customerName || recipient?.email_address || "",
    email: recipient?.email_address || "",
    customerEmail: recipient?.email_address || null,
    customerName: customerName || null,
    amount: totalAmount,
    totalAmount,
    currency,
    subtotal: amountValue(total?.item_total),
    tax: amountValue(total?.tax_total),
    description: description ?? "",
    invoiceDate,
    dueDate,
    status,
    paypalStatus: invoice.status ?? null,
    paymentAmount,
    paymentDate,
    invoiceUrl,
    source: "paypal" as const,
  };
}

export async function syncPaypalInvoices(userId: string) {
  const owner = await assertConfiguredOwner(userId);
  const ownerId = String(owner._id);
  let oauth: Awaited<ReturnType<typeof verifyPaypalInvoiceOAuth>>;
  try {
    oauth = await verifyPaypalInvoiceOAuth();
  } catch (error) {
    throw invoiceError(error, {
      payLeakUserId: ownerId,
      environment: env.PAYPAL_MODE,
      clientIdLast4: env.PAYPAL_CLIENT_ID.slice(-4),
      merchantAccount: "not_returned_by_client_credentials_api",
    });
  }

  let search: Awaited<ReturnType<typeof getAllPaypalInvoicePages>>;
  try {
    search = await getAllPaypalInvoicePages();
  } catch (error) {
    throw invoiceError(error, {
      payLeakUserId: ownerId,
      environment: env.PAYPAL_MODE,
      paypalApplicationId: oauth.appId,
      clientIdLast4: oauth.clientIdLast4,
      applicationOAuth: "verified",
      merchantAccount: "not_returned_by_client_credentials_api",
      invoiceReadPermission: oauth.invoiceReadScope,
      invoicesInserted: 0,
      invoicesUpdated: 0,
      totalInvoicesStoredInMongoDB: await getOwnerInvoiceCount(ownerId),
    });
  }
  const { invoices: imported, pages, paypalTotalItems, paypalTotalPages, duplicateInvoicesSkipped } = search;

  if (oauth.invoiceReadScope !== "present") {
    throw new AppError(503, "PayPal did not grant the required Invoicing API read permission. No invoices were imported.", "PAYPAL_INVOICE_PERMISSION_REQUIRED", {
      payLeakUserId: ownerId,
      environment: env.PAYPAL_MODE,
      paypalApplicationId: oauth.appId,
      clientIdLast4: oauth.clientIdLast4,
      applicationOAuth: "verified",
      merchantAccount: "not_returned_by_client_credentials_api",
      invoiceReadPermission: oauth.invoiceReadScope,
      paypalHttpStatus: pages[0]?.httpStatus ?? null,
      paypalTotalItems,
      paypalTotalPages,
      invoicesRetrieved: imported.length,
      invoiceDetailsRetrieved: 0,
      invoicesInserted: 0,
      invoicesUpdated: 0,
      duplicateInvoicesSkipped,
      totalInvoicesStoredInMongoDB: await getOwnerInvoiceCount(ownerId),
      pages,
    });
  }

  let invoiceDetailsRetrieved = 0;
  for (let index = 0; index < imported.length; index += 1) {
    const invoice = imported[index];
    if (!invoice) continue;
    const status = invoice.status?.toUpperCase();
    const needsPaymentDetails = ["PAID", "MARKED_AS_PAID", "PARTIALLY_PAID", "REFUNDED"].includes(status ?? "")
      && !invoice.payment_summary;
    if (!needsPaymentDetails || !invoice.id) continue;

    let httpStatus: number | null = null;
    try {
      const details = await getInvoiceDetails(invoice.id, (responseStatus) => { httpStatus = responseStatus; });
      imported[index] = {
        ...invoice,
        ...details,
        detail: { ...invoice.detail, ...details.detail },
        payment_summary: details.payment_summary ?? invoice.payment_summary,
        primary_recipients: details.primary_recipients ?? invoice.primary_recipients,
        amount: details.amount ?? invoice.amount,
        links: details.links ?? invoice.links,
        items: details.items ?? invoice.items,
      };
      invoiceDetailsRetrieved += 1;
    } catch (error) {
      throw invoiceError(error, {
        payLeakUserId: ownerId,
        environment: env.PAYPAL_MODE,
        paypalApplicationId: oauth.appId,
        clientIdLast4: oauth.clientIdLast4,
        applicationOAuth: "verified",
        merchantAccount: "not_returned_by_client_credentials_api",
        invoiceReadPermission: oauth.invoiceReadScope,
        paypalTotalItems,
        paypalTotalPages,
        invoicesRetrieved: imported.length,
        invoiceDetailsRetrieved,
        invoicesInserted: 0,
        invoicesUpdated: 0,
        duplicateInvoicesSkipped,
        totalInvoicesStoredInMongoDB: await getOwnerInvoiceCount(ownerId),
        invoiceId: invoice.id,
        paypalHttpStatus: httpStatus,
        pages,
      });
    }
  }

  await ensurePaypalInvoiceIndex();
  let invoicesInserted = 0;
  let invoicesUpdated = 0;
  let invalidInvoicesSkipped = 0;
  for (const paypalInvoice of imported) {
    const mapped = mapPaypalInvoice(ownerId, paypalInvoice);
    if (!mapped) {
      invalidInvoicesSkipped += 1;
      continue;
    }
    const result = await Invoice.updateOne(
      { userId: owner._id, paypalInvoiceId: mapped.paypalInvoiceId },
      { $set: mapped },
      { upsert: true, runValidators: true },
    );
    invoicesInserted += result.upsertedCount;
    invoicesUpdated += result.matchedCount;
  }
  const [totalInvoicesStoredInMongoDB, paypalInvoicesStored] = await Promise.all([
    getOwnerInvoiceCount(ownerId),
    Invoice.countDocuments({ userId: owner._id, source: "paypal" }),
  ]);
  return {
    payLeakUserId: ownerId,
    environment: env.PAYPAL_MODE,
    paypalApplicationId: oauth.appId,
    clientIdLast4: oauth.clientIdLast4,
    applicationOAuth: "verified",
    merchantAccount: "not_returned_by_client_credentials_api",
    invoiceReadPermission: oauth.invoiceReadScope,
    paypalHttpStatus: pages[0]?.httpStatus ?? null,
    paypalTotalItems,
    paypalTotalPages,
    invoicesRetrieved: imported.length,
    invoiceDetailsRetrieved,
    invoicesInserted,
    invoicesUpdated,
    duplicateInvoicesSkipped,
    invalidInvoicesSkipped,
    totalInvoicesStoredInMongoDB,
    paypalInvoicesStored,
    pages,
  };
}
