import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";

const execFileAsync = promisify(execFile);

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  let binaryFound = false;
  const configuredCommand = asString(ctx.config?.command, "muse");
  const fallbackPath = path.join(os.homedir(), ".local/bin/muse");
  const command =
    configuredCommand === "muse" && (await fs.access(fallbackPath).then(() => true).catch(() => false))
      ? fallbackPath
      : configuredCommand;

  try {
    const { stdout } = await execFileAsync(command, ["--version"], { timeout: 5000 });
    checks.push({
      code: "muse_cli_installed",
      level: "info",
      message: `Muse CLI installed: ${stdout.trim()}`,
    });
    binaryFound = true;
  } catch {
    checks.push({
      code: "muse_cli_missing",
      level: "error",
      message: "Muse CLI binary was not found or failed to execute.",
      hint: "Run 'curl -fsSL https://dev.meta.ai/install.sh | bash' to install Muse.",
    });
  }

  if (binaryFound) {
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...(ctx.config?.env as Record<string, string> | undefined),
      MUSE_NO_AUTO_UPDATE: "1",
    };

    const xdgConfig = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
    const targetAuth = path.join(xdgConfig, "muse", "auth.json");
    const sourceCandidates = [
      env.MUSE_AUTH_PATH,
      path.join(env.HOME || os.homedir(), ".config/muse/auth.json"),
    ].filter(Boolean) as string[];

    let hasAuth = false;
    if (await fs.access(targetAuth).then(() => true).catch(() => false)) {
      hasAuth = true;
    } else {
      for (const src of sourceCandidates) {
        if (src && src !== targetAuth && (await fs.access(src).then(() => true).catch(() => false))) {
          try {
            const data = await fs.readFile(src, "utf8");
            await fs.mkdir(path.join(xdgConfig, "muse"), { recursive: true, mode: 0o700 });
            await fs.writeFile(targetAuth, data, { mode: 0o600 });
            hasAuth = true;
            break;
          } catch {}
        }
      }
    }
    if (!hasAuth && env.META_API_KEY) {
      hasAuth = true;
    }

    if (hasAuth) {
      checks.push({
        code: "muse_auth_configured",
        level: "info",
        message: "Muse credentials configured.",
      });

      try {
        const model = asString(ctx.config?.model, "muse-wonder-1.0");
        const probeArgs = ["exec", "--model", model, "--yolo", "Respond with hello"];
        const probe = await execFileAsync(command, probeArgs, {
          timeout: 25000,
          env,
          cwd: asString(ctx.config?.cwd, os.homedir()),
        });

        if (/\bhello\b/i.test(probe.stdout)) {
          checks.push({
            code: "muse_hello_probe_passed",
            level: "info",
            message: "Muse hello probe succeeded.",
          });
        } else {
          checks.push({
            code: "muse_hello_probe_unexpected_output",
            level: "warn",
            message: "Muse probe ran but did not return 'hello' as expected.",
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          code: "muse_hello_probe_failed",
          level: "error",
          message: `Muse hello probe failed: ${message}`,
          hint: "Verify your Muse Code subscription and API connectivity.",
        });
      }
    } else {
      checks.push({
        code: "muse_auth_missing",
        level: "warn",
        message: "Muse CLI authentication not found.",
        hint: "Run 'muse login' or connect a Muse Code subscription in Paperclip.",
      });
    }
  }

  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");

  return {
    adapterType: "muse_local",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
