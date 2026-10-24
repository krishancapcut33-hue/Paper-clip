import fs from "node:fs/promises";
import path from "node:path";

export async function installSandboxToolMemoryPreference(configDir: string): Promise<void> {
  const supportDir = await fs.mkdtemp(path.join(configDir, "paperclip-tool-memory-"));
  const pluginDir = path.join(configDir, "plugins");
  const pluginPath = path.join(pluginDir, `${path.basename(supportDir)}.js`);
  const partialPath = `${pluginPath}.partial`;
  try {
    await fs.writeFile(path.join(supportDir, "bash-env.sh"),
      "{ printf '1000\\n' > /proc/self/oom_score_adj; } 2>/dev/null || true\n", { mode: 0o600 });
    await fs.mkdir(pluginDir, { recursive: true, mode: 0o700 });
    const scriptUrl = `../${path.basename(supportDir)}/bash-env.sh`;
    await fs.writeFile(partialPath, `import { fileURLToPath } from "node:url";
export const PaperclipSandboxToolMemory = async () => ({
  "shell.env": async (_input, output) => {
    if (process.platform !== "linux" || "BASH_ENV" in process.env || "BASH_ENV" in output.env) return;
    output.env.BASH_ENV = fileURLToPath(new URL(${JSON.stringify(scriptUrl)}, import.meta.url));
  },
});
`, { mode: 0o600 });
    await fs.rename(partialPath, pluginPath);
  } catch (error) {
    await fs.rm(partialPath, { force: true }).catch(() => {});
    await fs.rm(supportDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
