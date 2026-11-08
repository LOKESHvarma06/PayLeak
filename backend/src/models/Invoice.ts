import { model, Schema, type InferSchemaType } from "mongoose";

const invoiceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
  client: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  amount: { type: String, required: true },
  currency: { type: String, required: true, uppercase: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  invoiceDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"], default: "Draft" },
  paypalInvoiceId: { type: String, default: null },
  paypalStatus: { type: String, default: null },
}, { timestamps: true, versionKey: false });

invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ userId: 1, paypalInvoiceId: 1 }, { unique: true, sparse: true });

export type InvoiceRecord = InferSchemaType<typeof invoiceSchema>;
export const Invoice = model("Invoice", invoiceSchema);
