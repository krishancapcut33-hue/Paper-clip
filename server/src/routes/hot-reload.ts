import { Router, type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { performHotReload, getModuleStats } from "../services/hot-reload.js";
import { logger } from "../middleware/logger.js";
import { timingSafeEqual, randomUUID } from "node:crypto";

function matchesSharedToken(expectedToken: string | undefined | null, providedToken: string | undefined) {
  const expectedValue = expectedToken?.trim();
  const token = providedToken?.trim();
  if (!expectedValue || !token) return false;

  const expected = Buffer.from(expectedValue);
  const provided = Buffer.from(token);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

function hasDevServerStatusToken(providedToken: string | undefined) {
  return matchesSharedToken(process.env.PAPERCLIP_DEV_SERVER_STATUS_TOKEN, providedToken);
}

export function hotReloadRoutes(
  options?: {
    enabled?: boolean;
  },
) {
  const router = Router();
  const enabled = options?.enabled ?? process.env.NODE_ENV !== "production";

  router.post("/api/dev/hot-reload", async (
    req: ExpressRequest,
    res: ExpressResponse,
  ) => {
    if (!enabled) {
      return res.status(403).json({
        error: "Hot reload is not enabled in this environment",
      });
    }

    const statusToken = req.header("x-paperclip-dev-server-status-token");
    if (!hasDevServerStatusToken(statusToken)) {
      logger.warn("Unauthorized hot reload attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { changedFiles } = req.body as { changedFiles?: string[] };
      if (!Array.isArray(changedFiles)) {
        return res.status(400).json({
          error: "changedFiles must be an array of file paths",
        });
      }

      const result = await performHotReload(changedFiles);

      if (!result.success && result.errors.length > 0) {
        logger.error(
          { errors: result.errors },
          "Hot reload had errors",
        );
        return res.status(207).json({
          status: "partial",
          reloadedModules: result.reloadedModules,
          errors: result.errors,
          duration: result.duration,
          message: `Reloaded ${result.reloadedModules.length} modules with ${result.errors.length} errors`,
        });
      }

      return res.json({
        status: "success",
        reloadedModules: result.reloadedModules,
        duration: result.duration,
        message: `Successfully reloaded ${result.reloadedModules.length} modules in ${result.duration}ms`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMsg }, "Hot reload failed");
      return res.status(500).json({
        error: "Hot reload failed",
        message: errorMsg,
      });
    }
  });

  router.get("/api/dev/hot-reload/stats", (
    req: ExpressRequest,
    res: ExpressResponse,
  ) => {
    if (!enabled) {
      return res.status(403).json({
        error: "Hot reload is not enabled in this environment",
      });
    }

    const statusToken = req.header("x-paperclip-dev-server-status-token");
    if (!hasDevServerStatusToken(statusToken)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stats = getModuleStats();
    res.json(stats);
  });

  return router;
}
