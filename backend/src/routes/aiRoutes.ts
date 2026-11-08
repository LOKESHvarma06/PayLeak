import { Router } from "express";
import { requireAuth, getUserId } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/response.js";
import { explainFinancialData } from "../services/aiService.js";
import { z } from "zod";

const questionBody = z.object({ question: z.string().trim().min(1).max(1000) }).strict();
export const aiRoutes = Router();
aiRoutes.use(requireAuth);
aiRoutes.post(["/chat", "/assistant"], validateBody(questionBody), asyncHandler(async (req, res) =>
  success(res, await explainFinancialData(getUserId(req), req.body.question))));
