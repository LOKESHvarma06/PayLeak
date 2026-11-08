import { env } from "../config/env.js";
import { Transaction } from "../models/Transaction.js";
import { AppError } from "../utils/errors.js";

export async function explainFinancialData(userId: string, question: string) {
  if (!env.OPENAI_API_KEY) throw new AppError(503, "The AI assistant is not configured.", "AI_UNAVAILABLE");
  const records = await Transaction.find({ userId })
    .select("paypalTransactionId grossAmount grossCurrency feeAmount feeCurrency feeSource conversion transactionDate financialDataStatus")
    .sort({ transactionDate: -1 })
    .limit(50)
    .lean();
  const verifiedData = records.map((record) => ({
    transactionId: record.paypalTransactionId,
    date: record.transactionDate.toISOString(),
    gross: { amount: record.grossAmount, currency: record.grossCurrency, source: "actual_paypal" },
    fee: record.feeAmount && record.feeCurrency
      ? { amount: record.feeAmount, currency: record.feeCurrency, source: record.feeSource }
      : { amount: null, currency: null, source: "unavailable" },
    conversion: record.conversion.source === "unavailable" ? { status: "unavailable" } : record.conversion,
    financialDataStatus: record.financialDataStatus,
  }));

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        store: false,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: "Explain only the supplied financial records. Do not calculate, total, convert, estimate, or infer fees, exchange rates, payouts, savings, or losses. Never invent missing values. Explicitly distinguish actual_paypal values, paypal_quote values, official_fee_reference values, and unavailable values. Amounts in different currencies must not be added. If the records do not answer the question, say so.",
            }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify({ question, verifiedData }) }],
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError(502, "The AI service could not be reached.", "AI_CONNECTION_FAILED");
  }
  if (!response.ok) throw new AppError(502, "The AI service returned an error.", "AI_REQUEST_FAILED");
  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const answer = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
  if (!answer) throw new AppError(502, "The AI service returned no explanation.", "AI_EMPTY_RESPONSE");
  return { answer, source: "verified_backend_records", recordsConsidered: records.length };
}
