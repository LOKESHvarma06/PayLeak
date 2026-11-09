import { Router } from "express";
import { requireAuth, getUserId } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/response.js";
import { diagnoseGemini, explainFinancialData } from "../services/aiService.js";
import { z } from "zod";

const questionBody = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().min(1).max(4000),
  }).strict()).max(12).optional(),
}).strict();
export const aiRoutes = Router();
aiRoutes.use(requireAuth);
aiRoutes.post(["/chat", "/assistant"], validateBody(questionBody), asyncHandler(async (req, res) =>
  success(res, await explainFinancialData(getUserId(req), req.body.question, req.body.history ?? []))));
aiRoutes.post("/diagnostics", asyncHandler(async (_req, res) =>
  success(res, await diagnoseGemini())));
