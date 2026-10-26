import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { agents, companies, companySkills, createDb, environments, pluginCompanySettings, plugins, type Db } from "@paperclipai/db";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { environmentSkillConfig } from "../services/environment-skills.js";
import { pluginAgentRuntimeState } from "../services/plugin-agent-runtime-state.js";
import { companySkillService } from "../services/company-skills.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { withSkillActor } from "../services/skill-access.js";
import { buildNativeRuntimeContext } from "../services/native-runtime/runtime-context.js";

const support = await getEmbeddedPostgresTestSupport();
const describeDatabase = support.supported ? describe : describe.skip;
describeDatabase("environment managed skills", () => {
  let database: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
  let db: Db;
  let home: string;
  let companyId: string;
  let pluginId: string;
  let manifest: PaperclipPluginManifestV1;
  let environment: { driver: string; config: Record<string, unknown> };
  beforeAll(async () => {
    database = await startEmbeddedPostgresTestDatabase("paperclip-environment-skills-"); db = createDb(database.connectionString);
    home = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-environment-skills-"));
  }, 90_000);
  afterAll(async () => { await database?.cleanup(); if (home) {
    const release = async (directory: string): Promise<void> => {
      await fs.chmod(directory, 0o700);
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) await release(path.join(directory, entry.name));
    };
    await release(home); await fs.rm(home, { recursive: true, force: true });
  } });
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(async () => {
    vi.stubEnv("PAPERCLIP_HOME", home);
    companyId = randomUUID(); pluginId = randomUUID();
    manifest = { id: `fixture.${pluginId}`, apiVersion: 1, version: "1.0.0", displayName: "Desktop", description: "Fixture", author: "Tests", categories: ["automation"],
      capabilities: ["environment.drivers.register", "skills.managed", "agents.lifecycle.manage", "events.subscribe"],
      resourceLifecycle: ["agent_runtime"], entrypoints: { worker: "worker.js" },
      environmentDrivers: [{ driverKey: "desktop", displayName: "Desktop", skillKeys: ["computer-use"], configSchema: {} }],
      skills: [{ skillKey: "computer-use", displayName: "Computer use", slug: "computer-use",
        markdown: "---\nname: computer-use\ndescription: Use the installed desktop tools.\n---\n\nRead references/linux.md.",
        files: [{ path: "references/linux.md", content: "Use the installed cua-driver." }] }] };
    await db.insert(companies).values({ id: companyId, name: "Environment skills", issuePrefix: `E${companyId.slice(0, 6)}` });
    await db.insert(plugins).values({ id: pluginId, pluginKey: manifest.id, packageName: "fixture", version: "1.0.0", status: "ready", manifestJson: manifest });
    environment = { driver: "plugin", config: { pluginKey: manifest.id, driverKey: "desktop", driverConfig: {} } };
  });
  it("installs the company skill and delivers its versioned files through runtime sync and the native snapshot", async () => {
    const config = { paperclipSkillSync: { desiredSkills: [] } };
    const [selection, concurrent] = await Promise.all([environmentSkillConfig(db, companyId, environment, config), environmentSkillConfig(db, companyId, environment, config)]);
    expect(concurrent).toEqual(selection);
    const selected = selection.config;
    const [skill] = await db.select().from(companySkills).where(and(eq(companySkills.companyId, companyId), eq(companySkills.slug, "computer-use")));
    expect(selected).toMatchObject({ paperclipSkillSync: { desiredSkills: [skill.key] } });
    expect(config.paperclipSkillSync.desiredSkills).toEqual([]);
    const [env] = await db.insert(environments).values({ name: "Desktop", ...environment }).returning();
    const [agent] = await db.insert(agents).values({ companyId, name: "Worker", adapterType: "paperclip_runner", defaultEnvironmentId: env.id,
      lifecycleRequiredPluginIds: [pluginId], adapterConfig: config }).returning();
    const state = await pluginAgentRuntimeState(db, pluginId, companyId, agent.id);
    expect(state!.skills).toEqual([expect.objectContaining({ key: skill.key, runtimeName: expect.stringMatching(/^computer-use--/), versionId: expect.any(String) })]);
    await withSkillActor({ type: "agent", agentId: agent.id, companyId, source: "agent_key" }, async () => {
      await companySkillService(db).withRuntimeSkillEntries(companyId, { selectionConfig: selected, snapshotLatest: true }, async entries => {
        const context = await buildNativeRuntimeContext({ db, agent, runId: randomUUID(), runtimeConfig: selected, runtimeSkillEntries: entries });
        expect(context.skills).toEqual([expect.objectContaining({ key: skill.key, runtimeName: state!.skills[0].runtimeName, versionId: state!.skills[0].versionId })]);
        expect(await fs.readFile(path.join(context.skills[0].bundle.rootPath, "references/linux.md"), "utf8")).toContain("cua-driver");
      });
    });
    await db.update(agents).set({ defaultEnvironmentId: null }).where(eq(agents.id, agent.id));
    await instanceSettingsService(db).update({ defaultEnvironmentId: env.id });
    expect((await pluginAgentRuntimeState(db, pluginId, companyId, agent.id))!.skills).toEqual(state!.skills);
    await instanceSettingsService(db).update({ defaultEnvironmentId: null });
    expect((await pluginAgentRuntimeState(db, pluginId, companyId, agent.id))!.skills).toEqual([]);
    expect((await pluginAgentRuntimeState(db, pluginId, companyId, agent.id, env.id))!.skills).toEqual(state!.skills);
    await expect(pluginAgentRuntimeState(db, pluginId, companyId, agent.id, randomUUID())).rejects.toMatchObject({ status: 422 });
    const pinned = { paperclipSkillSync: { desiredSkills: [{ key: skill.key, versionId: state!.skills[0].versionId }] } };
    expect((await environmentSkillConfig(db, companyId, environment, pinned)).config).toEqual(pinned);
    await db.update(companySkills).set({ markdown: "Agent customization" }).where(eq(companySkills.id, skill.id));
    await environmentSkillConfig(db, companyId, environment, config);
    expect((await db.select().from(companySkills).where(eq(companySkills.id, skill.id)))[0].markdown).toBe("Agent customization");
  });
  it("keeps installations company-scoped and rejects disabled providers", async () => {
    const peerId = randomUUID();
    await db.insert(companies).values({ id: peerId, name: "Peer", issuePrefix: `P${peerId.slice(0, 6)}` });
    await environmentSkillConfig(db, companyId, environment, {});
    await environmentSkillConfig(db, peerId, environment, {});
    const peerSkills = await db.select().from(companySkills).where(and(eq(companySkills.companyId, peerId), eq(companySkills.slug, "computer-use")));
    expect(peerSkills).toHaveLength(1);
    const skills = await db.select().from(companySkills).where(and(eq(companySkills.companyId, companyId), eq(companySkills.slug, "computer-use")));
    expect(peerSkills[0].id).not.toBe(skills[0].id);
    await db.insert(pluginCompanySettings).values({ companyId, pluginId, enabled: false });
    await expect(environmentSkillConfig(db, companyId, environment, {})).rejects.toMatchObject({ status: 422 });
    expect(await environmentSkillConfig(db, companyId, { driver: "local", config: null }, {})).toEqual({ config: {}, skillKeys: [] });
    expect(await environmentSkillConfig(db, companyId, { ...environment, config: { ...environment.config, driverKey: "unrelated" } }, {})).toEqual({ config: {}, skillKeys: [] });
  });
});
