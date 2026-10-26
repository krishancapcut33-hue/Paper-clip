import { and, eq, inArray, sql } from "drizzle-orm";
import { companySkills, pluginCompanySettings, pluginManagedResources, plugins, type Db } from "@paperclipai/db";
import { readPaperclipSkillSyncPreference, writePaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";
import { unprocessable } from "../errors.js";
import { pluginManagedSkillService } from "./plugin-managed-skills.js";

/** Environment capabilities join the normal authorized, versioned skill selection. */
export async function environmentSkillConfig(db: Db, companyId: string,
  environment: { driver: string; config: Record<string, unknown> | null } | null | undefined,
  config: Record<string, unknown>): Promise<{ config: Record<string, unknown>; skillKeys: string[] }> {
  if (environment?.driver !== "plugin") return { config, skillKeys: [] };
  const { pluginKey, driverKey } = environment.config ?? {};
  if (typeof pluginKey !== "string" || typeof driverKey !== "string") return { config, skillKeys: [] };
  const [plugin] = await db.select().from(plugins).where(eq(plugins.pluginKey, pluginKey));
  const keys = plugin?.manifestJson.environmentDrivers?.find(driver => driver.driverKey === driverKey)?.skillKeys ?? [];
  if (!plugin || !keys.length) return { config, skillKeys: [] };
  const [settings] = await db.select().from(pluginCompanySettings).where(and(
    eq(pluginCompanySettings.companyId, companyId), eq(pluginCompanySettings.pluginId, plugin.id)));
  if (plugin.status !== "ready" || settings?.enabled === false || !plugin.manifestJson.capabilities.includes("skills.managed")) {
    throw unprocessable("Environment skills require an enabled plugin with skills.managed capability");
  }
  // Existing bindings need only a bounded metadata query, not a file-by-file drift scan.
  const installed = await db.select({ resourceKey: pluginManagedResources.resourceKey, key: companySkills.key })
    .from(pluginManagedResources).innerJoin(companySkills, and(
      eq(companySkills.id, pluginManagedResources.resourceId), eq(companySkills.companyId, companyId)))
    .where(and(eq(pluginManagedResources.companyId, companyId), eq(pluginManagedResources.pluginId, plugin.id),
      eq(pluginManagedResources.resourceKind, "skill"), inArray(pluginManagedResources.resourceKey, keys)));
  const selected = new Map(installed.map(skill => [skill.resourceKey, skill.key]));
  for (const key of keys) {
    if (selected.has(key)) continue;
    const result = await db.transaction(async tx => {
      // Serialize first installation across concurrent agents in this company.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`environment-skill:${companyId}:${plugin.id}:${key}`}, 0))`);
      return pluginManagedSkillService(tx as unknown as Db, { pluginId: plugin.id, pluginKey, manifest: plugin.manifestJson }).reconcile(key, companyId);
    });
    if (!result.skill) throw unprocessable("Environment skill is unavailable");
    selected.set(key, result.skill.key);
  }
  const preference = readPaperclipSkillSyncPreference(config);
  const explicit = new Set(preference.desiredSkillEntries.map(entry => entry.key));
  const skillKeys = keys.map(key => selected.get(key)!);
  return { config: writePaperclipSkillSyncPreference(config, [...preference.desiredSkillEntries,
    ...skillKeys.filter(key => !explicit.has(key))]), skillKeys };
}
