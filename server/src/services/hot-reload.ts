import { logger } from "../middleware/logger.js";
import path from "node:path";

type HotReloadResult = {
  success: boolean;
  reloadedModules: string[];
  errors: Array<{ module: string; error: string }>;
  duration: number;
};

let lastReloadTime: number | null = null;

export async function performHotReload(changedFilePaths: string[]): Promise<HotReloadResult> {
  const startTime = Date.now();
  const reloadedModules: string[] = [];
  const errors: Array<{ module: string; error: string }> = [];

  logger.debug({ changedFilePaths }, "Starting hot reload");

  for (const filePath of changedFilePaths) {
    try {
      const normalizedPath = path.normalize(filePath).replace(/\\/g, "/");

      if (!isReloadableModule(normalizedPath)) {
        logger.debug({ module: normalizedPath }, "Module is not reloadable, skipping");
        continue;
      }

      reloadedModules.push(normalizedPath);
      logger.debug({ module: normalizedPath }, "Marked for hot reload (will reload on next request)");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ module: filePath, error: errorMsg });
    }
  }

  lastReloadTime = Date.now();
  const duration = Date.now() - startTime;
  const result: HotReloadResult = {
    success: errors.length === 0,
    reloadedModules,
    errors,
    duration,
  };

  logger.info(
    { reloadedCount: reloadedModules.length, errorCount: errors.length, duration },
    "Hot reload completed",
  );

  return result;
}

function isReloadableModule(filePath: string): boolean {
  const notReloadable = [
    "index.ts",
    "app.ts",
    "middleware/",
    "instrumentation.ts",
    "sentry.ts",
    "services/index.ts",
  ];

  for (const notReloadablePath of notReloadable) {
    if (filePath.includes(notReloadablePath)) {
      return false;
    }
  }

  const safeToReload = [
    "routes/",
    "services/",
    "realtime/",
  ];

  for (const reloadablePath of safeToReload) {
    if (filePath.includes(reloadablePath)) {
      return true;
    }
  }

  return false;
}

export function getModuleStats(): {
  lastReloadTime: string | null;
} {
  return {
    lastReloadTime: lastReloadTime
      ? new Date(lastReloadTime).toISOString()
      : null,
  };
}
