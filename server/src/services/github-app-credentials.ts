import { and, eq } from "drizzle-orm";
import { connectionGrants, toolConnections, toolConnectionInstalls, type Db } from "@paperclipai/db";
import { resolveConnectionGrantSecret } from "./connection-credentials.js";
import { unprocessable } from "../errors.js";
import { createGitHubAppClient, GITHUB_APP_KEY_PATH, isGitHubAppConnection, parseGitHubAppConfig, githubAppFailure, rethrowGitHubAppFailure } from "./github-app-client.js";

export { isGitHubAppConnection, parseGitHubAppConfig } from "./github-app-client.js";
type Connection = typeof toolConnections.$inferSelect;
type Grant = typeof connectionGrants.$inferSelect;
const client = createGitHubAppClient();

function matchesOwnership(connection: Connection, grant: Grant) {
  return connection.credentialPolicy === "per_user"
    ? grant.kind === "user" && Boolean(grant.subjectUserId)
    : connection.credentialPolicy === "per_agent"
      ? grant.kind === "agent" && Boolean(grant.subjectAgentId)
      : grant.kind === "organization";
}

export async function getGitHubAppGrant(db: Db, connection: Connection): Promise<Grant> {
  const grants = await db.select().from(connectionGrants).where(and(
    eq(connectionGrants.companyId, connection.companyId),
    eq(connectionGrants.connectionId, connection.id),
    eq(connectionGrants.status, "active"),
  ));
  const grant = grants[0];
  if (grants.length !== 1 || !grant || !matchesOwnership(connection, grant)) {
    throw unprocessable("Reconnect the GitHub App identity.");
  }
  return grant;
}

/** Authorization and vault ownership are rechecked even on a token-cache hit. */
export async function resolveGitHubAppCredential(db: Db, connection: Connection, grant: Grant, allowDraft = false, force = false, agentId?: string | null) {
  const valid = async () => {
    const [c] = await db.select().from(toolConnections).where(and(eq(toolConnections.companyId, connection.companyId), eq(toolConnections.id, connection.id)));
    const [g] = await db.select().from(connectionGrants).where(and(eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.id, grant.id)));
    if (!c || !g || !isGitHubAppConnection(c) || g.connectionId !== c.id || !matchesOwnership(c, g) || g.kind !== grant.kind || g.subjectUserId !== grant.subjectUserId
      || c.credentialPolicy !== connection.credentialPolicy || g.subjectAgentId !== grant.subjectAgentId || g.status !== "active" || (allowDraft ? c.status !== "draft" : (!c.enabled || c.status !== "active"))
      || JSON.stringify(c.config) !== JSON.stringify(connection.config) || JSON.stringify(g.credentialSecretRefs) !== JSON.stringify(grant.credentialSecretRefs)) githubAppFailure();
    if (!allowDraft) {
      const installs = await db.select().from(toolConnectionInstalls).where(and(eq(toolConnectionInstalls.companyId, c.companyId), eq(toolConnectionInstalls.connectionId, c.id)));
      // Health checks have no run agent. Runtime acquisition checks the exact
      // agent again after the provider request, including on cache hits.
      const targetAgentId = agentId ?? (g.kind === "agent" ? g.subjectAgentId : null);
      if (!installs.some(install =>
        (install.targetType === "company" && install.targetId === c.companyId)
        || (install.targetType === "agent" && (!targetAgentId || install.targetId === targetAgentId))
      )) githubAppFailure();
    }
    return { c, g };
  };
  const { c, g } = await valid();
  const ref = g.credentialSecretRefs.find(r => r.configPath === GITHUB_APP_KEY_PATH);
  if (!ref) githubAppFailure();
  try {
    const secret = await resolveConnectionGrantSecret(db, c, g, ref, { actorType: "system", actorId: g.subjectAgentId ?? undefined, consumerType: "tool_connection", consumerId: c.id });
    const result = await client.acquire(`${c.companyId}:${c.id}:${g.id}:${secret.latestVersion}`, parseGitHubAppConfig(c.config.methodConfig), secret.value, force);
    await valid();
    return result;
  } catch (error) {
    rethrowGitHubAppFailure(error);
  }
}

/** Refresh access evidence without changing the credential revision used by setup rollback. */
export async function refreshGitHubAppAccess(db: Db, connection: Connection, force = false) {
  const grant = await getGitHubAppGrant(db, connection);
  const result = await resolveGitHubAppCredential(db, connection, grant, connection.status === "draft", force);
  await db.update(connectionGrants).set({ providerTenant: { github: result.github } }).where(and(
    eq(connectionGrants.id, grant.id), eq(connectionGrants.companyId, connection.companyId),
    eq(connectionGrants.status, "active"), eq(connectionGrants.updatedAt, grant.updatedAt),
  ));
  return result;
}
