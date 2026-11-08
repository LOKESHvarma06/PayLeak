import { z } from "zod";
import { currencyCode, decimalString } from "./common.js";

export const invoiceFields = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  client: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  amount: decimalString,
  currency: currencyCode,
  description: z.string().trim().min(1).max(2000),
  date: z.coerce.date(),
  due: z.coerce.date(),
}).strict();

export const invoiceBody = invoiceFields.refine((value) => value.due >= value.date, {
  message: "Due date must be on or after the invoice date.",
  path: ["due"],
});
