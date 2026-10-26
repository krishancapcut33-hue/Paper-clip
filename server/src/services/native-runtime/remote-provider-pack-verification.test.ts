import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { canonicalProviderPackJson, verifyRemoteProviderPack, type ProviderPackIdentity } from "./remote-provider-pack-verification.js";

const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const manifest = (revision: string): ProviderPackIdentity => {
  const payload = {
    compatibility: { opencode: 1, acpx: 1 },
    pins: { opencode: "1.18.34", nodeMinimum: "24.11.0" },
    target: { platform: "linux", architecture: "x64" },
    runnerSourceRevision: revision.repeat(40),
    artifacts: Object.fromEntries(Object.entries({
      nodeCommand: "node_modules/node/bin/node", opencodeCommand: "node_modules/.bin/opencode",
      productionLock: "pnpm-lock.yaml", opencodeExecutable: "node_modules/opencode-ai/bin/opencode.exe",
      opencodeProxy: "dist/cli/opencode-app-server-proxy.cjs", acpxSidecar: "dist/cli/acpx-runtime-sidecar.cjs",
      grokLauncher: "dist/providers/grok/launcher.cjs",
    }).map(([name, path]) => [name, { path, sha256: sha(`${revision}-${name}`) }])) as ProviderPackIdentity["payload"]["artifacts"],
  };
  return { schema: "paperclip-runner/remote-provider-pack/v1", payload, digest: sha(canonicalProviderPackJson(payload)) };
};

describe("installed provider pack compatibility", () => {
  it("reuses a protected pack across app revisions without executing verification commands", async () => {
    const installed = manifest("a"), current = manifest("b");
    const execute = vi.fn().mockResolvedValue({ exitCode: 1, timedOut: false, stdout: "", stderr: "manifest mismatch" });
    const selected = await verifyRemoteProviderPack({ runner: { execute }, cwd: "/workspace", packRoot: "/opt/paperclip-runner/provider-pack",
      manifest: current, installation: { root: "/opt/paperclip-runner/provider-pack", manifest: installed, immutable: true }, provider: { kind: "opencode" } });
    expect(selected).toEqual(installed);
    expect(execute).not.toHaveBeenCalled();
  });
  const reseal = (pack: ProviderPackIdentity) => ({ ...pack, digest: sha(canonicalProviderPackJson(pack.payload)) });
  const check = (installed: ProviderPackIdentity, options: { immutable?: boolean; requireExactIdentity?: boolean } = {}) => {
    const execute = vi.fn();
    return verifyRemoteProviderPack({ runner: { execute }, cwd: "/workspace", packRoot: "/opt/paperclip-runner/provider-pack",
      manifest: manifest("b"), installation: { root: "/opt/paperclip-runner/provider-pack", manifest: installed, immutable: options.immutable ?? true },
      provider: { kind: "opencode" }, requireExactIdentity: options.requireExactIdentity });
  };
  it.each(["interface", "platform", "schema", "artifact_path", "digest", "legacy"])("rejects an incompatible %s", async field => {
    let pack = manifest("a");
    if (field === "interface") pack.payload.compatibility!.opencode += 1;
    if (field === "legacy") delete pack.payload.compatibility;
    if (field === "platform") pack.payload.target.architecture = "arm64";
    if (field === "schema") pack.schema = "unknown";
    if (field === "artifact_path") pack.payload.artifacts.nodeCommand.path = "../node";
    pack = reseal(pack);
    if (field === "digest") pack.digest = sha("corrupt");
    await expect(check(pack)).rejects.toThrow("runner_remote_provider_artifact_incompatible");
  });
  it("keeps writable installations at the content-verification boundary", async () => {
    await expect(check(manifest("b"), { immutable: false })).rejects.toThrow("installation is incompatible");
  });
  it("does not replace an admitted pack during reattachment", async () => {
    await expect(check(manifest("a"), { requireExactIdentity: true })).rejects.toThrow("incompatible");
    await expect(check(manifest("b"), { requireExactIdentity: true })).resolves.toEqual(manifest("b"));
  });
  it("ignores unrelated provider and dependency changes for OpenCode", async () => {
    const pack = manifest("a");
    pack.payload.compatibility!.acpx += 1;
    pack.payload.pins.acpx = "different-version";
    pack.payload.acpxProfileDigests = { codex: sha("different-codex") };
    await expect(check(reseal(pack))).resolves.toEqual(reseal(pack));
  });
  it("checks only the selected ACPX profile", async () => {
    const current = manifest("b"), installed = manifest("a");
    current.payload.acpxProfileDigests = { claude: sha("claude"), codex: sha("codex") };
    installed.payload.acpxProfileDigests = { claude: sha("claude"), codex: sha("other-codex") };
    const input = { runner: { execute: vi.fn() }, cwd: "/workspace", packRoot: "/opt/paperclip-runner/provider-pack",
      manifest: reseal(current), installation: { root: "/opt/paperclip-runner/provider-pack", manifest: reseal(installed), immutable: true },
      provider: { kind: "acpx" as const, agent: "claude" } };
    await expect(verifyRemoteProviderPack(input)).resolves.toEqual(reseal(installed));
    await expect(verifyRemoteProviderPack({ ...input, provider: { kind: "acpx", agent: "codex" } })).rejects.toThrow("profile is incompatible");
  });

});
