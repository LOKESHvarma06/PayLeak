import { Router } from "express";
import { requireAuth, getUserId } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/response.js";
import { AppError } from "../utils/errors.js";
import { Invoice } from "../models/Invoice.js";
import { createInvoice, deleteInvoice, getInvoice, listInvoices, sendInvoice, updateInvoice } from "../services/invoiceService.js";
import { invoiceBody, invoiceFields } from "../validators/invoice.js";
import { idParam } from "../validators/common.js";
import { z } from "zod";

const invoicePatch = invoiceFields.partial().extend({ status: z.enum(["Draft", "Sent", "Paid", "Overdue", "Cancelled"]).optional() }).strict();
export const invoiceRoutes = Router();
invoiceRoutes.use(requireAuth);

invoiceRoutes.get("/", asyncHandler(async (req, res) => success(res, await listInvoices(getUserId(req)))));
invoiceRoutes.post("/", validateBody(invoiceBody), asyncHandler(async (req, res) => success(res, await createInvoice(getUserId(req), req.body), 201)));
invoiceRoutes.get("/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  return success(res, await getInvoice(getUserId(req), id));
}));
invoiceRoutes.put("/:id", validateBody(invoicePatch), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  return success(res, await updateInvoice(getUserId(req), id, req.body));
}));
invoiceRoutes.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const invoice = await Invoice.findOne({ _id: id, userId: getUserId(req) }).select("status");
  if (!invoice) throw new AppError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  if (invoice.status === "Paid") throw new AppError(409, "Paid invoices cannot be deleted.", "INVOICE_ALREADY_PAID");
  await deleteInvoice(getUserId(req), id);
  return res.status(204).end();
}));
invoiceRoutes.post("/:id/send", asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  return success(res, await sendInvoice(getUserId(req), id));
}));
