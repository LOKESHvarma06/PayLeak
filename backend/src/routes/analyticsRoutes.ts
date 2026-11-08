import { Router } from "express";
import { requireAuth, getUserId } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/response.js";
import { dashboardAnalytics, leakAnalytics, monthlyAnalytics, clientAnalytics, currencyAnalytics } from "../services/analyticsService.js";
import { transactionBreakdown } from "../services/transactionService.js";
import { z } from "zod";

export const analyticsRoutes = Router();
analyticsRoutes.use(requireAuth);
analyticsRoutes.get("/", asyncHandler(async (req, res) => success(res, await dashboardAnalytics(getUserId(req)))));
analyticsRoutes.get("/dashboard", asyncHandler(async (req, res) => success(res, await dashboardAnalytics(getUserId(req)))));
analyticsRoutes.get("/monthly", asyncHandler(async (req, res) => success(res, await monthlyAnalytics(getUserId(req)))));
analyticsRoutes.get("/fees", asyncHandler(async (req, res) => success(res, (await leakAnalytics(getUserId(req))).actualFeesByCurrency)));
analyticsRoutes.get("/clients", asyncHandler(async (req, res) => success(res, await clientAnalytics(getUserId(req)))));
analyticsRoutes.get("/currencies", asyncHandler(async (req, res) => success(res, await currencyAnalytics(getUserId(req)))));
analyticsRoutes.get("/leaks", asyncHandler(async (req, res) => success(res, await leakAnalytics(getUserId(req)))));
analyticsRoutes.get("/leaks/:transactionId", asyncHandler(async (req, res) =>
  success(res, await transactionBreakdown(getUserId(req), z.string().min(1).max(160).parse(req.params.transactionId)))));
