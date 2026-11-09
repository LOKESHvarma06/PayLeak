import { Decimal } from "decimal.js";
import { z } from "zod";
import { currencyCode, decimalString } from "./common.js";
import { paypalInvoiceCurrencies } from "../config/paypalCurrencies.js";

const paypalCurrency = currencyCode.refine(
  (value) => Object.prototype.hasOwnProperty.call(paypalInvoiceCurrencies, value),
  "This currency is not available for PayPal invoicing.",
);

export const invoiceFields = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  client: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  amount: decimalString.refine((value) => new Decimal(value).greaterThan(0), "Invoice amount must be greater than zero."),
  currency: paypalCurrency,
  description: z.string().trim().min(1).max(2000),
  date: z.coerce.date(),
  due: z.coerce.date(),
}).strict();

export function validateInvoiceAmountPrecision(
  value: { amount?: string; currency?: string },
  context: z.RefinementCtx,
) {
  if (!value.amount || !value.currency) return;
  const fractionDigits = paypalInvoiceCurrencies[value.currency as keyof typeof paypalInvoiceCurrencies]?.fractionDigits;
  const decimalPlaces = value.amount.split(".")[1]?.length ?? 0;
  if (fractionDigits !== undefined && decimalPlaces > fractionDigits) {
    context.addIssue({
      code: "custom",
      message: `${value.currency} amounts cannot have more than ${fractionDigits} decimal places.`,
      path: ["amount"],
    });
  }
};

export const invoiceBody = invoiceFields
  .superRefine(validateInvoiceAmountPrecision)
  .refine((value) => value.due >= value.date, {
    message: "Due date must be on or after the invoice date.",
    path: ["due"],
  });
