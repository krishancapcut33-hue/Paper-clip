import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, getEmbeddedPostgresTestSupport, issueAccessGrants, issues, startEmbeddedPostgresTestDatabase } from "@paperclipai/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { authorizationService } from "../services/authorization.js";
import { getHeartbeatRunReadDecisions } from "../services/heartbeat-run-privacy.js";
import { captureSidebarQueries, cleanupSidebarFixture, observedSidebarFailures, seedSidebarFixture, type BadgeOptions, type CapturedQuery } from "./helpers/sidebar-badges-fixture.js";

const externalUrl = process.env.PAPERCLIP_SIDEBAR_TEST_DATABASE_URL;
const support = externalUrl ? { supported: true } : await getEmbeddedPostgresTestSupport();
const describePostgres = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Skipping sidebar badge SQL tests: ${support.reason}`);

describePostgres("sidebar badge failure candidates", () => {
  let db: ReturnType<typeof createDb>;
  let database: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | undefined;
  const fixtures: Awaited<ReturnType<typeof seedSidebarFixture>>[] = [];
  let fixture: Awaited<ReturnType<typeof seedSidebarFixture>>;

  beforeAll(async () => {
    if (externalUrl && !new URL(externalUrl).pathname.endsWith("_test")) throw new Error("Use a dedicated synthetic *_test database");
    if (!externalUrl) database = await startEmbeddedPostgresTestDatabase("sidebar-badges-");
    db = createDb(externalUrl ?? database!.connectionString, { maxConnections: 1 });
    fixture = await seedSidebarFixture(db);
    fixtures.push(fixture);
  }, 90_000);

  afterAll(async () => {
    const errors: unknown[] = [];
    async function cleanup(action: () => Promise<unknown> | undefined) {
      try { await action(); } catch (error) { errors.push(error); }
    }
    for (const entry of fixtures) await cleanup(() => cleanupSidebarFixture(db, entry));
    await cleanup(() => db?.$client.end({ timeout: 0 }));
    await cleanup(() => database?.cleanup());
    if (errors.length) throw new AggregateError(errors, "Sidebar test cleanup failed");
  });

  async function verify(options?: BadgeOptions) {
    const queries: CapturedQuery[] = [];
    const actual = await sidebarBadgeService(captureSidebarQueries(db, queries)).get(fixture.companyId, options);
    const expectedCandidates = await observedSidebarFailures(db, fixture.companyId, options?.currentUserId);
    const candidates = await db.$client.unsafe(queries[0]!.sql, queries[0]!.params as never[]).values();
    const normalize = (rows: unknown[][]) => rows.map(row => JSON.stringify(row)).sort();
    expect(normalize(candidates.map(row => [...row.slice(0, 3), new Date(String(row[3])).toISOString()]))).toEqual(normalize(
      expectedCandidates.map(row => [row.id, row.scopeKind, row.issueId, row.createdAt.toISOString()]),
    ));
    expect(expectedCandidates.map(row => row.id)).not.toContain(fixture.special.superseded);
    expect(expectedCandidates.map(row => row.id)).not.toContain(fixture.special["outside-window"]);
    const undismissed = expectedCandidates.filter(row => (options?.dismissals?.get(`run:${row.id}`) ?? -Infinity) < row.createdAt.getTime());
    const failedRuns = options?.actor
      ? (await getHeartbeatRunReadDecisions(db, authorizationService(db), options.actor, undismissed)).filter(Boolean).length
      : undismissed.length;
    const approvals = options?.dismissals ? 0 : 1;
    const joinRequests = options?.joinRequests?.length ?? 0;
    expect(actual).toEqual({ inbox: approvals + failedRuns + joinRequests + (options?.unreadTouchedIssues ?? 0), approvals, failedRuns, joinRequests });
    return actual;
  }

  it.each([undefined, null, "", "user-1", "user-2", "local-board", "nobody"])("keeps the bounded latest run before Mine filtering for %s", async currentUserId => {
    await verify({ ...fixture.options, currentUserId });
  });

  it("retains company-wide behavior without an actor or options", async () => {
    await verify();
    await verify({ ...fixture.options, actor: undefined });
    await verify({ ...fixture.options, actor: { type: "none" } });
  });

  it("rechecks private issue grants and deletion on every request", async () => {
    const service = sidebarBadgeService(db);
    const options = { ...fixture.options, currentUserId: "user-1" };
    const denied = await service.get(fixture.companyId, options);
    const [grant] = await db.insert(issueAccessGrants).values({ issueId: fixture.privateIssueId, subjectType: "agent", subjectId: fixture.actorId, source: "explicit" }).returning();
    const allowed = await service.get(fixture.companyId, options);
    expect(allowed.failedRuns).toBe(denied.failedRuns + 1);
    await db.update(issueAccessGrants).set({ revokedAt: new Date() }).where(eq(issueAccessGrants.id, grant!.id));
    expect(await service.get(fixture.companyId, options)).toEqual(denied);
    await db.delete(issues).where(eq(issues.id, fixture.publicIssueId));
    expect((await service.get(fixture.companyId, options)).failedRuns).toBe(denied.failedRuns - 1);
    await verify(options);
  });

  it("preserves equal-time input order with index and sort plans", async () => {
    await db.$client.unsafe("SET enable_indexscan = off");
    await db.$client.unsafe("SET enable_bitmapscan = off");
    try { await verify(fixture.options); }
    finally {
      await db.$client.unsafe("RESET enable_indexscan");
      await db.$client.unsafe("RESET enable_bitmapscan");
    }
  });

  it.each(["all-failed", "all-succeeded", "empty"] as const)("handles the %s control", async mode => {
    const control = await seedSidebarFixture(db, mode);
    fixtures.push(control);
    const response = await sidebarBadgeService(db).get(control.companyId);
    const failedRuns = mode === "all-failed" ? 200 : 0;
    expect(response).toEqual({ inbox: failedRuns + 1, approvals: 1, failedRuns, joinRequests: 0 });
  });
});
