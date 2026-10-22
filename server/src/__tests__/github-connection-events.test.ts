import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  companies,
  connectionEventDeliveries,
  connectionGrants,
  createDb,
  externalObjects,
  issueWorkProducts,
  issues,
  toolApplications,
  toolConnections,
} from "@paperclipai/db";
import { eq, sql } from "drizzle-orm";
import { githubConnectionEventService } from "../services/github-connection-events.js";
import { subscribeCompanyLiveEvents } from "../services/live-events.js";
import type { PaperclipCloudConnector } from "../services/paperclip-cloud-connector.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function createConnector(event: {
  id: string;
  provider: "github";
  event: string;
  action: string;
  installationId: string;
  repositoryId: string | null;
  createdAt: string;
  bindingIds: string[];
  payload: Record<string, unknown>;
}) {
  let poll = 0;
  const connector = {
    getCapabilities: vi.fn(async () => ["github.code" as const]),
    startAuthorization: vi.fn(),
    claim: vi.fn(),
    refresh: vi.fn(),
    revoke: vi.fn(),
    setWebhookBinding: vi.fn(async () => undefined),
    leaseEvents: vi.fn(async () => ({ leaseId: `lease-${++poll}`, events: [event] })),
    acknowledgeEvents: vi.fn(async () => 1),
  } as unknown as PaperclipCloudConnector;
  return { connector };
}

describeEmbeddedPostgres("GitHub connection event delivery", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-github-events-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(issueWorkProducts);
    await db.delete(issues);
    await db.delete(connectionEventDeliveries);
    await db.delete(externalObjects);
    await db.delete(connectionGrants);
    await db.delete(toolConnections);
    await db.delete(toolApplications);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it.each([
    "https://leaked-user@github.com/paperclipai/paperclip/pull/123",
    "https://:leaked-password@github.com/paperclipai/paperclip/pull/123",
    "https://github.com/paperclipai/paperclip/pull/123?token=leaked-query",
    "https://github.com/paperclipai/paperclip/pull/123#leaked-fragment",
  ])("does not persist secret-bearing GitHub PR URLs (%s)", async (unsafeUrl) => {
    const companyId = randomUUID();
    const userId = `github-owner-${randomUUID()}`;
    const applicationId = randomUUID();
    const connectionId = randomUUID();
    const grantId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Paperclip", issuePrefix: "GHE" });
    await db.insert(toolApplications).values({
      id: applicationId,
      companyId,
      applicationKey: `github-${randomUUID()}`,
      name: "GitHub",
      type: "mcp_server",
      status: "active",
    });
    await db.insert(toolConnections).values({
      id: connectionId,
      companyId,
      applicationId,
      name: "GitHub",
      uid: `github-${randomUUID()}`,
      transport: "mcp_remote",
      authKind: "oauth",
      credentialPolicy: "per_user",
      status: "active",
      enabled: true,
      config: { sourceTemplateKey: "github", oauth: { connectorProfile: "github.code" } },
      transportConfig: {},
    });
    await db.insert(connectionGrants).values({
      id: grantId,
      companyId,
      connectionId,
      kind: "user",
      subjectUserId: userId,
      status: "active",
      isDefault: false,
      providerTenant: {
        oauth: { strategy: "paperclip_cloud_connector", accessTokenExpiresAt: null },
        github: {
          userId: "42",
          login: "octocat",
          installationCount: 1,
          repositoryCount: 3,
          repositorySelection: "selected",
          installationIds: ["101"],
          installationOwnerLogins: ["paperclipai"],
          repositories: [{ id: "203", fullName: "paperclipai/removed", installationId: "101" }],
          webhookHealth: "pending",
        },
      },
    });
    const externalObjectId = randomUUID();
    await db.insert(externalObjects).values({
      id: externalObjectId,
      companyId,
      providerKey: "github",
      objectType: "pull_request",
      externalId: "paperclipai/paperclip#pull/123",
      statusCategory: "open",
      statusTone: "info",
      data: { provider: "github", marker: "preserved" },
    });

    const leasedEvent = {
      id: "delivery_merged_123",
      provider: "github" as const,
      event: "pull_request",
      action: "closed",
      installationId: "101",
      repositoryId: "99",
      createdAt: "2026-09-04T12:00:00.000Z",
      bindingIds: [`${grantId}_101`],
      payload: {
        repository: "paperclipai/paperclip",
        number: 123,
        state: "closed",
        merged: true,
        mergedAt: "2026-09-04T11:59:00.000Z",
        merge_commit_sha: "c".repeat(40),
        updatedAt: "2026-09-04T11:59:01.000Z",
        url: unsafeUrl,
        headRef: "feature",
        headSha: "a".repeat(40),
        baseRef: "master",
        baseSha: "b".repeat(40),
        body: "private pull request body",
        comments: [{ body: "private review comment" }],
        accessToken: "ghu_must_not_be_persisted",
        arbitraryNested: { credential: "also-must-not-be-persisted" },
      },
    };
    let poll = 0;
    const connector = {
      getCapabilities: vi.fn(async () => ["github.code" as const]),
      startAuthorization: vi.fn(),
      claim: vi.fn(),
      refresh: vi.fn(),
      revoke: vi.fn(),
      setWebhookBinding: vi.fn(async () => undefined),
      leaseEvents: vi.fn(async () => ({ leaseId: `lease-${++poll}`, events: [leasedEvent] })),
      acknowledgeEvents: vi.fn(async () => 1),
    } as unknown as PaperclipCloudConnector;
    let currentTime = new Date("2026-09-04T12:00:05.000Z");
    let failSweep = true;
    const sweepMergedPullRequestConfirmations = vi.fn(async () => {
      if (failSweep) {
        failSweep = false;
        throw new Error("injected confirmation sweep failure");
      }
    });
    const service = githubConnectionEventService(db, {
      connector,
      now: () => currentTime,
      runConfirmationSweep: sweepMergedPullRequestConfirmations,
    });

    await expect(service.pollOnce()).resolves.toMatchObject({ leased: 1, processed: 0, duplicate: 0, failed: 1 });
    const [failedSweepReceipt] = await db.select().from(connectionEventDeliveries).where(eq(
      connectionEventDeliveries.providerDeliveryId,
      leasedEvent.id,
    ));
    expect(failedSweepReceipt).toMatchObject({ status: "failed", attempts: 1 });
    expect(connector.acknowledgeEvents).not.toHaveBeenCalled();

    const retryService = githubConnectionEventService(db, {
      connector,
      now: () => currentTime,
      runConfirmationSweep: sweepMergedPullRequestConfirmations,
    });
    await expect(retryService.pollOnce()).resolves.toMatchObject({ leased: 1, processed: 1, duplicate: 0, failed: 0 });
    const [snapshot] = await db.select().from(externalObjects).where(eq(externalObjects.id, externalObjectId));
    expect(snapshot).toMatchObject({
      statusKey: "merged",
      statusLabel: "Merged",
      statusCategory: "succeeded",
      statusTone: "success",
      isTerminal: true,
      remoteVersion: "2026-09-04T11:59:01.000Z",
      data: expect.objectContaining({ marker: "preserved", merged: true, headRef: "feature", baseSha: "b".repeat(40), mergeCommitSha: "c".repeat(40) }),
    });
    const [grant] = await db.select().from(connectionGrants).where(eq(connectionGrants.id, grantId));
    expect(grant?.providerTenant?.github).toMatchObject({ webhookHealth: "healthy", lastWebhookAt: currentTime.toISOString() });
    const [receipt] = await db.select().from(connectionEventDeliveries).where(eq(
      connectionEventDeliveries.providerDeliveryId,
      leasedEvent.id,
    ));
    expect(receipt).toMatchObject({
      status: "processed",
      attempts: 2,
      provider: "github",
      normalizedPayload: {
        repository: "paperclipai/paperclip",
        number: 123,
        state: "closed",
        merged: true,
        mergedAt: "2026-09-04T11:59:00.000Z",
        mergeCommitSha: "c".repeat(40),
        updatedAt: "2026-09-04T11:59:01.000Z",
        headRef: "feature",
        headSha: "a".repeat(40),
        baseRef: "master",
        baseSha: "b".repeat(40),
      },
    });
    expect(receipt?.normalizedPayload).not.toHaveProperty("url");
    expect(snapshot?.data).not.toHaveProperty("url");
    expect(JSON.stringify(receipt)).not.toMatch(/private pull request|private review|ghu_|also-must-not|leaked-user|leaked-password|leaked-query|leaked-fragment/);
    const [activity] = await db.select().from(activityLog).where(eq(activityLog.action, "tool_connection.webhook_processed"));
    expect(activity?.details).toEqual({
      provider: "github",
      event: "pull_request",
      action: "closed",
      deliveryId: leasedEvent.id,
      installationId: "101",
      repositoryId: "99",
    });
    expect(connector.acknowledgeEvents).toHaveBeenCalledTimes(1);

    currentTime = new Date(currentTime.getTime() + 6_000);
    await expect(retryService.pollOnce()).resolves.toMatchObject({ leased: 1, processed: 0, duplicate: 1, failed: 0 });
    const [duplicateReceipt] = await db.select().from(connectionEventDeliveries).where(eq(
      connectionEventDeliveries.providerDeliveryId,
      leasedEvent.id,
    ));
    expect(duplicateReceipt?.attempts).toBe(2);
    expect(connector.acknowledgeEvents).toHaveBeenCalledTimes(2);
    expect(sweepMergedPullRequestConfirmations).toHaveBeenCalledTimes(2);
  });

  it("persists repeated merge projections and ignores delayed pre-merge events", async () => {
    const companyId = randomUUID();
    const applicationId = randomUUID();
    const connectionId = randomUUID();
    const grantId = randomUUID();
    const issueId = randomUUID();
    const workProductId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Paperclip", issuePrefix: "GHE" });
    await db.insert(toolApplications).values({
      id: applicationId,
      companyId,
      applicationKey: `github-${randomUUID()}`,
      name: "GitHub",
      type: "mcp_server",
      status: "active",
    });
    await db.insert(toolConnections).values({
      id: connectionId,
      companyId,
      applicationId,
      name: "GitHub",
      uid: `github-${randomUUID()}`,
      transport: "mcp_remote",
      authKind: "oauth",
      credentialPolicy: "per_user",
      status: "active",
      enabled: true,
      config: { sourceTemplateKey: "github", oauth: { connectorProfile: "github.code" } },
      transportConfig: {},
    });
    await db.insert(connectionGrants).values({
      id: grantId,
      companyId,
      connectionId,
      kind: "user",
      subjectUserId: `github-owner-${randomUUID()}`,
      status: "active",
      isDefault: false,
      providerTenant: {
        oauth: { strategy: "paperclip_cloud_connector", accessTokenExpiresAt: null },
        github: {
          userId: "42", login: "octocat", installationCount: 1, repositoryCount: 1,
          repositorySelection: "selected", installationIds: ["101"], webhookHealth: "pending",
        },
      },
    });
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Merge is not issue completion evidence",
      status: "in_progress",
      priority: "medium",
    });
    await db.insert(issueWorkProducts).values({
      id: workProductId,
      companyId,
      issueId,
      type: "pull_request",
      provider: "github",
      externalId: "paperclipai/paperclip#pull/123",
      title: "PR 123",
      url: "https://github.com/paperclipai/paperclip/pull/123",
      status: "open",
      metadata: { repo: "paperclipai/paperclip", number: 123, state: "open", marker: "preserved" },
    });

    const createMergeDelivery = (deliveryId: string, updatedAt: string, mergeCommitSha: string, normalized = false) => ({
      id: deliveryId,
      provider: "github" as const,
      event: "pull_request",
      action: "closed",
      installationId: "101",
      repositoryId: "99",
      createdAt: updatedAt,
      bindingIds: [`${grantId}_101`],
      payload: {
        repository: "paperclipai/paperclip",
        number: 123,
        state: "closed",
        merged: true,
        mergedAt: "2026-09-04T11:59:00.000Z",
        updatedAt,
        url: "https://github.com/paperclipai/paperclip/pull/123",
        ...(normalized ? { mergeCommitSha } : { merge_commit_sha: mergeCommitSha }),
      },
    });
    const firstEvent = createMergeDelivery("delivery_merge_first", "2026-09-04T11:59:01.000Z", "c".repeat(40));
    const preMergeEvent = {
      ...firstEvent,
      id: "delivery_pre_merge_with_test_sha",
      action: "synchronize",
      payload: {
        ...firstEvent.payload,
        state: "open",
        merged: false,
        mergedAt: undefined,
        merge_commit_sha: "e".repeat(40),
        updatedAt: "2026-09-04T11:58:00.000Z",
      },
    };
    const { connector: preMergeConnector } = createConnector(preMergeEvent);
    await expect(githubConnectionEventService(db, { connector: preMergeConnector }).pollOnce())
      .resolves.toMatchObject({ processed: 1, failed: 0 });
    const [preMergeProduct] = await db.select().from(issueWorkProducts).where(eq(issueWorkProducts.id, workProductId));
    expect(preMergeProduct).toMatchObject({ status: "open", metadata: { merged: false, mergeCommitSha: "e".repeat(40) } });

    const { connector: firstConnector } = createConnector(firstEvent);
    await expect(githubConnectionEventService(db, { connector: firstConnector }).pollOnce())
      .resolves.toMatchObject({ processed: 1, failed: 0 });

    const delayedEvent = {
      ...firstEvent,
      id: "delivery_delayed_open",
      action: "synchronize",
      payload: {
        ...firstEvent.payload,
        state: "open",
        merged: false,
        mergedAt: undefined,
        merge_commit_sha: undefined,
        updatedAt: "2026-09-04T11:58:00.000Z",
      },
    };
    const { connector: delayedConnector } = createConnector(delayedEvent);
    await expect(githubConnectionEventService(db, { connector: delayedConnector }).pollOnce())
      .resolves.toMatchObject({ processed: 1, failed: 0 });

    const retryEvent = createMergeDelivery("delivery_merge_retry", "2026-09-04T12:00:01.000Z", "d".repeat(40), true);
    const { connector: retryConnector } = createConnector(retryEvent);
    await expect(githubConnectionEventService(db, { connector: retryConnector }).pollOnce())
      .resolves.toMatchObject({ processed: 1, failed: 0 });

    const [product] = await db.select().from(issueWorkProducts).where(eq(issueWorkProducts.id, workProductId));
    expect(product).toMatchObject({
      status: "merged",
      url: "https://github.com/paperclipai/paperclip/pull/123",
      metadata: {
        repo: "paperclip",
        number: 123,
        state: "closed",
        merged: true,
        mergedAt: "2026-09-04T11:59:00.000Z",
        mergeCommitSha: "d".repeat(40),
        marker: "preserved",
      },
    });
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(issue?.status).toBe("in_progress");
  });

  it("rolls back the receipt and both projections when work-product persistence fails", async () => {
    const companyId = randomUUID();
    const applicationId = randomUUID();
    const connectionId = randomUUID();
    const grantId = randomUUID();
    const issueId = randomUUID();
    const workProductId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Paperclip", issuePrefix: "GHE" });
    await db.insert(toolApplications).values({
      id: applicationId,
      companyId,
      applicationKey: `github-${randomUUID()}`,
      name: "GitHub",
      type: "mcp_server",
      status: "active",
    });
    await db.insert(toolConnections).values({
      id: connectionId,
      companyId,
      applicationId,
      name: "GitHub",
      uid: `github-${randomUUID()}`,
      transport: "mcp_remote",
      authKind: "oauth",
      credentialPolicy: "per_user",
      status: "active",
      enabled: true,
      config: { sourceTemplateKey: "github", oauth: { connectorProfile: "github.code" } },
      transportConfig: {},
    });
    await db.insert(connectionGrants).values({
      id: grantId,
      companyId,
      connectionId,
      kind: "user",
      subjectUserId: `github-owner-${randomUUID()}`,
      status: "active",
      isDefault: false,
      providerTenant: {
        oauth: { strategy: "paperclip_cloud_connector", accessTokenExpiresAt: null },
        github: {
          userId: "42", login: "octocat", installationCount: 1, repositoryCount: 1,
          repositorySelection: "selected", installationIds: ["101"], webhookHealth: "pending",
        },
      },
    });
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Projection failure",
      status: "in_progress",
      priority: "medium",
    });
    await db.insert(externalObjects).values({
      companyId,
      providerKey: "github",
      objectType: "pull_request",
      externalId: "paperclipai/paperclip#pull/123",
      statusCategory: "open",
      statusTone: "info",
      data: { marker: "preserved" },
    });
    await db.insert(issueWorkProducts).values({
      id: workProductId,
      companyId,
      issueId,
      type: "pull_request",
      provider: "github",
      externalId: "paperclipai/paperclip#pull/123",
      title: "PR 123",
      url: "https://github.com/paperclipai/paperclip/pull/123",
      status: "open",
      metadata: { repo: "paperclipai/paperclip", number: 123, state: "open" },
    });
    await db.execute(sql`CREATE FUNCTION paperclip_test_reject_pr_work_product_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected projection write failure'; END $$`);
    await db.execute(sql`CREATE TRIGGER paperclip_test_reject_pr_work_product_projection BEFORE UPDATE ON issue_work_products FOR EACH ROW EXECUTE FUNCTION paperclip_test_reject_pr_work_product_projection()`);

    const event = {
      id: "delivery_projection_failure",
      provider: "github" as const,
      event: "pull_request",
      action: "closed",
      installationId: "101",
      repositoryId: "99",
      createdAt: "2026-09-04T12:00:00.000Z",
      bindingIds: [`${grantId}_101`],
      payload: {
        repository: "paperclipai/paperclip",
        number: 123,
        state: "closed",
        merged: true,
        mergedAt: "2026-09-04T11:59:00.000Z",
        merge_commit_sha: "c".repeat(40),
        updatedAt: "2026-09-04T11:59:01.000Z",
        url: "https://github.com/paperclipai/paperclip/pull/123",
      },
    };
    const { connector } = createConnector(event);
    const service = githubConnectionEventService(db, { connector });
    await expect(service.pollOnce()).resolves.toMatchObject({ failed: 1, processed: 0 });
    const [failedReceipt] = await db.select().from(connectionEventDeliveries).where(eq(
      connectionEventDeliveries.providerDeliveryId,
      event.id,
    ));
    expect(failedReceipt?.status).toBe("failed");
    const [unchangedProduct] = await db.select().from(issueWorkProducts).where(eq(issueWorkProducts.id, workProductId));
    expect(unchangedProduct).toMatchObject({ status: "open", metadata: { state: "open" } });
    const [unchangedSnapshot] = await db.select().from(externalObjects).where(eq(externalObjects.externalId, "paperclipai/paperclip#pull/123"));
    expect(unchangedSnapshot).toMatchObject({ statusKey: null, data: { marker: "preserved" } });
    expect(connector.acknowledgeEvents).not.toHaveBeenCalled();

    await db.execute(sql`DROP TRIGGER paperclip_test_reject_pr_work_product_projection ON issue_work_products`);
    await db.execute(sql`DROP FUNCTION paperclip_test_reject_pr_work_product_projection()`);
    await expect(githubConnectionEventService(db, { connector }).pollOnce()).resolves.toMatchObject({ processed: 1, failed: 0 });
    const [recoveredProduct] = await db.select().from(issueWorkProducts).where(eq(issueWorkProducts.id, workProductId));
    expect(recoveredProduct).toMatchObject({ status: "merged", metadata: { mergeCommitSha: "c".repeat(40) } });
  });

  it.each([false, true])("applies installation events once without discarding newer verified access (refreshed: %s)", async (refreshed) => {
    const companyId = randomUUID();
    const applicationId = randomUUID();
    const connectionId = randomUUID();
    const grantId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Paperclip", issuePrefix: "GHI" });
    await db.insert(toolApplications).values({
      id: applicationId,
      companyId,
      applicationKey: `github-${randomUUID()}`,
      name: "GitHub",
      type: "mcp_server",
      status: "active",
    });
    await db.insert(toolConnections).values({
      id: connectionId,
      companyId,
      applicationId,
      name: "GitHub",
      uid: `github-${randomUUID()}`,
      transport: "mcp_remote",
      authKind: "oauth",
      credentialPolicy: "per_user",
      status: "active",
      enabled: true,
      config: { sourceTemplateKey: "github", oauth: { connectorProfile: "github.code" } },
      transportConfig: {},
    });
    await db.insert(connectionGrants).values({
      id: grantId,
      companyId,
      connectionId,
      kind: "user",
      subjectUserId: `github-owner-${randomUUID()}`,
      status: "active",
      isDefault: false,
      providerTenant: {
        oauth: { strategy: "paperclip_cloud_connector", accessTokenExpiresAt: null },
        github: {
          userId: "42",
          login: "octocat",
          installationCount: 1,
          repositoryCount: 3,
          repositorySelection: "selected",
          installationIds: ["101"],
          installationOwnerLogins: ["paperclipai"],
          repositories: [{ id: "203", fullName: "paperclipai/removed", installationId: "101" }],
          webhookHealth: "pending",
        },
      },
    });

    const leasedEvent = {
      id: "delivery_repository_change_101",
      provider: "github" as const,
      event: "installation_repositories",
      action: "added",
      installationId: "101",
      repositoryId: null,
      createdAt: "2026-09-04T12:00:00.000Z",
      bindingIds: [`${grantId}_101`],
      payload: {
        repositorySelection: "selected",
        repositoriesAdded: ["201", "202"],
        repositoriesRemoved: ["203"],
      },
    };
    let poll = 0;
    const connector = {
      getCapabilities: vi.fn(async () => ["github.code" as const]),
      startAuthorization: vi.fn(),
      claim: vi.fn(),
      refresh: vi.fn(),
      revoke: vi.fn(),
      setWebhookBinding: vi.fn(async () => undefined),
      leaseEvents: vi.fn(async () => {
        if (refreshed) {
          const [latest] = await db.select().from(connectionGrants).where(eq(connectionGrants.id, grantId));
          await db.update(connectionGrants).set({ providerTenant: {
            ...latest!.providerTenant,
            github: { ...latest!.providerTenant!.github!, lastAccessRefreshAt: "2026-09-04T12:00:02.000Z" },
          } }).where(eq(connectionGrants.id, grantId));
        }
        return ({ leaseId: `lease-${++poll}`, events: [leasedEvent] });
      }),
      acknowledgeEvents: vi.fn(async () => 1),
    } as unknown as PaperclipCloudConnector;
    let currentTime = new Date("2026-09-04T12:00:05.000Z");
    const service = githubConnectionEventService(db, { connector, now: () => currentTime });

    const unsubscribe = subscribeCompanyLiveEvents(companyId, () => {
      throw new Error("fixture live subscriber failed");
    });
    await expect(service.pollOnce()).resolves.toMatchObject({ processed: 1, duplicate: 0, failed: 0 });
    unsubscribe();
    let [grant] = await db.select().from(connectionGrants).where(eq(connectionGrants.id, grantId));
    expect(grant?.providerTenant?.github).toMatchObject({ repositoryCount: refreshed ? 3 : 4, webhookHealth: "healthy" });
    if (refreshed) {
      expect(grant?.providerTenant?.github?.repositories).toHaveLength(1);
    } else {
      expect(grant?.providerTenant?.github?.repositories).toBeUndefined();
    }

    currentTime = new Date(currentTime.getTime() + 6_000);
    await expect(service.pollOnce()).resolves.toMatchObject({ processed: 0, duplicate: 1, failed: 0 });
    [grant] = await db.select().from(connectionGrants).where(eq(connectionGrants.id, grantId));
    expect(grant?.providerTenant?.github?.repositoryCount).toBe(refreshed ? 3 : 4);
    const [receipt] = await db.select().from(connectionEventDeliveries).where(eq(
      connectionEventDeliveries.providerDeliveryId,
      leasedEvent.id,
    ));
    expect(receipt).toMatchObject({ status: "processed", attempts: 1 });
  });
});
