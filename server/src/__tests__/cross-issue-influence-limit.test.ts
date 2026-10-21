import { describe, expect, it } from "vitest";
import {
  CROSS_ISSUE_INFLUENCE_ENFORCE_AT,
  CROSS_ISSUE_INFLUENCE_LIMIT,
  crossIssueInfluenceLimitError,
  evaluateCrossIssueInfluenceLimit,
  observeCrossIssueInfluence,
} from "../services/cross-issue-influence-limit.ts";

function counterDb(
  initialCount = 0,
  runOverrides: Record<string, unknown> | null = {},
  // Issue ids whose checkout/execution claim points at this run (empty = none).
  heldIssueIds: string[] = [],
) {
  let observedCount = initialCount;
  const inserted: Array<Record<string, unknown>> = [];
  const selects: Array<string[]> = [];
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    select: (selection: Record<string, unknown>) => {
      selects.push(Object.keys(selection));
      return {
        from: () => ({
          where: () => {
            const keys = Object.keys(selection);
            if (keys.includes("count")) {
              return {
                then: (resolve: (rows: unknown[]) => unknown) => resolve([{ count: observedCount }]),
              };
            }
            if (keys.includes("heldId")) {
              // The timer-wake checkout lookup:
              // select({ heldId: issues.id }).from(issues).where(...).limit(2).then(...)
              const then = (resolve: (rows: unknown[]) => unknown) =>
                resolve(heldIssueIds.slice(0, 2).map((id) => ({ heldId: id })));
              return {
                limit: () => ({ then }),
                then,
              };
            }
            return {
              for: () => ({
                then: (resolve: (rows: unknown[]) => unknown) => resolve(runOverrides === null ? [] : [{
                  id: "11111111-1111-4111-8111-111111111111",
                  companyId: "22222222-2222-4222-8222-222222222222",
                  agentId: "33333333-3333-4333-8333-333333333333",
                  responsibleUserId: "user-1",
                  contextSnapshot: { issueId: "44444444-4444-4444-8444-444444444444" },
                  // The one issue this run may write to uncapped; bound lazily
                  // on the first checked-out same-issue write.
                  homeIssueId: null,
                  ...runOverrides,
                }]),
              }),
            };
          },
        }),
      };
    },
    insert: () => ({
      values: async (value: Record<string, unknown>) => {
        inserted.push(value);
        if (value.action === "issue.cross_issue_influence_observed") observedCount += 1;
      },
    }),
    // update(heartbeatRuns).set({ homeIssueId }).where(...): the lazy home-issue bind.
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          updates.push(value);
          return [];
        },
      }),
    }),
  };
  return {
    db: {
      transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    },
    inserted,
    selects,
    updates,
    get observedCount() {
      return observedCount;
    },
  };
}

describe("cross-issue influence limit rollout", () => {
  it("logs observations without enforcement during the one-week rollout", () => {
    const decision = evaluateCrossIssueInfluenceLimit({
      priorCount: CROSS_ISSUE_INFLUENCE_LIMIT,
      now: new Date(CROSS_ISSUE_INFLUENCE_ENFORCE_AT.getTime() - 1),
    });

    expect(decision).toMatchObject({
      allowed: true,
      mode: "log_only",
      count: CROSS_ISSUE_INFLUENCE_LIMIT + 1,
      cap: CROSS_ISSUE_INFLUENCE_LIMIT,
    });
  });

  it("allows the twentieth influence and fails closed on the twenty-first after the flip", () => {
    const now = CROSS_ISSUE_INFLUENCE_ENFORCE_AT;
    expect(evaluateCrossIssueInfluenceLimit({ priorCount: 19, now })).toMatchObject({
      allowed: true,
      mode: "enforce",
      count: 20,
      cap: 20,
    });

    const rejected = evaluateCrossIssueInfluenceLimit({ priorCount: 20, now });
    expect(rejected).toMatchObject({
      allowed: false,
      mode: "enforce",
      count: 21,
      cap: 20,
    });
    const capError = crossIssueInfluenceLimitError(rejected, {
      actorLabel: "Fable",
      issueIdentifier: "TASK-482",
    });
    expect(capError.details).toMatchObject({
      code: "cross_issue_influence_cap_exceeded",
      cap: 20,
      count: 21,
      mode: "enforce",
      enforceAt: CROSS_ISSUE_INFLUENCE_ENFORCE_AT.toISOString(),
    });
    // Plan §6: the 429 names the boundary, who can act, and the way forward.
    expect(capError.error).toContain("20");
    expect(capError.error).toContain("Who can act:");
    expect(capError.error).toContain("Try this:");
    expect(capError.error).toContain("next heartbeat");
    expect(capError.details.boundary).toContain("20");
    expect(capError.details.whoCanAct).toContain("Fable");
  });

  it("uses one durable counter for cross-issue comments, PATCH updates, and interaction resolutions", async () => {
    const fake = counterDb();
    const base = {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      now: new Date(CROSS_ISSUE_INFLUENCE_ENFORCE_AT.getTime() - 1),
    } as const;

    await expect(observeCrossIssueInfluence(fake.db as never, { ...base, kind: "comment" }))
      .resolves.toMatchObject({ count: 1, allowed: true });
    await expect(observeCrossIssueInfluence(fake.db as never, { ...base, kind: "update" }))
      .resolves.toMatchObject({ count: 2, allowed: true });
    await expect(observeCrossIssueInfluence(fake.db as never, { ...base, kind: "interaction_resolution" }))
      .resolves.toMatchObject({ count: 3, allowed: true });

    expect(fake.observedCount).toBe(3);
    expect(fake.inserted.map((row) => (row.details as { kind: string }).kind))
      .toEqual(["comment", "update", "interaction_resolution"]);
  });

  it("counts an interaction resolution against a budget already spent on comments", async () => {
    const fake = counterDb(CROSS_ISSUE_INFLUENCE_LIMIT);

    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "interaction_resolution",
      now: CROSS_ISSUE_INFLUENCE_ENFORCE_AT,
    })).resolves.toMatchObject({
      allowed: false,
      mode: "enforce",
      count: CROSS_ISSUE_INFLUENCE_LIMIT + 1,
    });
    expect(fake.inserted).toEqual([
      expect.objectContaining({ action: "issue.cross_issue_influence_cap_rejected" }),
    ]);
  });

  it("does not count same-issue writes", async () => {
    const fake = counterDb(0, {
      contextSnapshot: { issueId: "55555555-5555-4555-8555-555555555555" },
    });
    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "comment",
    })).resolves.toBeNull();
    expect(fake.inserted).toEqual([]);
  });

  it.each([
    ["missing", null],
    ["wrong-agent", { agentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    ["wrong-company", { companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
  ] as const)("fails closed for a %s locked run", async (_label, runOverrides) => {
    const fake = counterDb(0, runOverrides);

    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "comment",
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "cross_issue_influence_run_context_required" },
    });
    expect(fake.inserted).toEqual([]);
  });

  it("fails closed before querying for a malformed run id", async () => {
    const fake = counterDb();

    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "attacker-controlled-run-id",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "comment",
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "cross_issue_influence_run_context_required" },
    });
    expect(fake.inserted).toEqual([]);
  });

  it("counts writes from an unscoped run instead of rejecting them", async () => {
    // A timer heartbeat with no checked-out issue has no source issue: every
    // write it makes is cross-issue by definition. The persisted run row is
    // still the attribution anchor, so the write spends the cap rather than
    // failing as run-less.
    const fake = counterDb(0, { contextSnapshot: {} });

    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "update",
    })).resolves.toMatchObject({ count: 1, allowed: true });
    expect(fake.inserted).toEqual([
      expect.objectContaining({
        action: "issue.cross_issue_influence_observed",
        details: expect.objectContaining({ sourceIssueId: null }),
      }),
    ]);
  });

  it("still caps an unscoped run once its budget is spent", async () => {
    const fake = counterDb(CROSS_ISSUE_INFLUENCE_LIMIT, { contextSnapshot: {} });

    await expect(observeCrossIssueInfluence(fake.db as never, {
      companyId: "22222222-2222-4222-8222-222222222222",
      runId: "11111111-1111-4111-8111-111111111111",
      agentId: "33333333-3333-4333-8333-333333333333",
      targetIssueId: "55555555-5555-4555-8555-555555555555",
      kind: "comment",
      now: CROSS_ISSUE_INFLUENCE_ENFORCE_AT,
    })).resolves.toMatchObject({
      allowed: false,
      count: CROSS_ISSUE_INFLUENCE_LIMIT + 1,
    });
    expect(fake.inserted).toEqual([
      expect.objectContaining({ action: "issue.cross_issue_influence_cap_rejected" }),
    ]);
  });

  describe("timer-wake runs that hold the target issue's checkout", () => {
    const company = "22222222-2222-4222-8222-222222222222";
    const runId = "11111111-1111-4111-8111-111111111111";
    const agentId = "33333333-3333-4333-8333-333333333333";
    const targetIssueId = "55555555-5555-4555-8555-555555555555";
    const sourceIssueId = "44444444-4444-4444-8444-444444444444";
    const otherIssueId = "66666666-6666-4666-8666-666666666666";
    // heartbeat_timer wake: the run row exists but carries no source issue.
    const timerWakeRun = { contextSnapshot: {} };
    const wokenRun = { contextSnapshot: { issueId: sourceIssueId } };
    const base = {
      companyId: company,
      runId,
      agentId,
      targetIssueId,
      kind: "update",
    } as const;

    it("treats a timer-wake run's write to its own checked-out issue as same-issue (no cap spend)", async () => {
      const fake = counterDb(0, timerWakeRun, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toBeNull();
      expect(fake.inserted).toEqual([]);
    });

    it("accepts an executionRunId-only claim as the same-issue link", async () => {
      const fake = counterDb(0, timerWakeRun, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toBeNull();
      expect(fake.inserted).toEqual([]);
    });

    it("treats a woken run's write to the issue it checked out as same-issue", async () => {
      const fake = counterDb(0, wokenRun, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toBeNull();
      expect(fake.inserted).toEqual([]);
    });

    const withoutCheckout: Array<[string, string[]]> = [
      ["an issue nobody claims", []],
      ["a different issue claimed by this run", [otherIssueId]],
    ];
    it.each(withoutCheckout)(
      "still counts a timer-wake write when the run does not hold the target issue (%s)",
      async (_label, heldIds) => {
        const fake = counterDb(0, timerWakeRun, heldIds);

        await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toMatchObject({
          allowed: true,
          count: 1,
          cap: CROSS_ISSUE_INFLUENCE_LIMIT,
        });
        expect(fake.inserted).toEqual([
          expect.objectContaining({
            action: "issue.cross_issue_influence_observed",
            details: expect.objectContaining({ sourceIssueId: null, targetIssueId }),
          }),
        ]);
      },
    );

    it("keeps attributing a woken run's foreign-issue write to its source issue", async () => {
      // The foreign issue is claimed by a different run, so this run holds
      // nothing and the write stays a counted cross-issue influence.
      const fake = counterDb(0, wokenRun, []);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toMatchObject({
        allowed: true,
        count: 1,
      });
      expect(fake.inserted).toEqual([
        expect.objectContaining({
          action: "issue.cross_issue_influence_observed",
          details: expect.objectContaining({ sourceIssueId, targetIssueId }),
        }),
      ]);
    });

    it("still rejects a timer-wake run's foreign write once the cap is spent", async () => {
      const fake = counterDb(CROSS_ISSUE_INFLUENCE_LIMIT, timerWakeRun, []);

      await expect(observeCrossIssueInfluence(fake.db as never, {
        ...base,
        now: CROSS_ISSUE_INFLUENCE_ENFORCE_AT,
      })).resolves.toMatchObject({
        allowed: false,
        count: CROSS_ISSUE_INFLUENCE_LIMIT + 1,
      });
      expect(fake.inserted).toEqual([
        expect.objectContaining({ action: "issue.cross_issue_influence_cap_rejected" }),
      ]);
    });

    it("never runs the checkout lookup for a non-UUID target id", async () => {
      // A non-UUID identifier must not take part in the lookup at all, and it
      // can never equal a held issue id, so the write stays counted.
      const fake = counterDb(0, timerWakeRun, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, {
        ...base,
        targetIssueId: "TASK-482",
        targetIssueIdentifier: "TASK-482",
      })).resolves.toMatchObject({ allowed: true, count: 1 });
      expect(fake.selects.some((keys) => keys.includes("heldId"))).toBe(false);
      expect(fake.inserted).toEqual([
        expect.objectContaining({ action: "issue.cross_issue_influence_observed" }),
      ]);
    });

    it("charges a write when the run holds a second issue too (no stacked-checkout bypass)", async () => {
      // The exemption is limited to the run's sole held issue: a run that
      // claims several issues must not buy uncapped writes by stacking claims.
      const fake = counterDb(0, timerWakeRun, [targetIssueId, otherIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toMatchObject({
        allowed: true,
        count: 1,
        cap: CROSS_ISSUE_INFLUENCE_LIMIT,
      });
      expect(fake.inserted).toEqual([
        expect.objectContaining({
          action: "issue.cross_issue_influence_observed",
          details: expect.objectContaining({ sourceIssueId: null, targetIssueId }),
        }),
      ]);
    });

    it("binds the run's home issue on its first checked-out same-issue write", async () => {
      // First exemption is recorded durably on the run row so that later
      // checkouts cannot inherit it.
      const fake = counterDb(0, timerWakeRun, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toBeNull();
      expect(fake.updates).toEqual([{ homeIssueId: targetIssueId }]);
      expect(fake.inserted).toEqual([]);
    });

    it("keeps exempting the bound issue when its claim is released and taken again", async () => {
      const fake = counterDb(0, { ...timerWakeRun, homeIssueId: targetIssueId }, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toBeNull();
      expect(fake.updates).toEqual([]);
      expect(fake.inserted).toEqual([]);
    });

    it("charges a successive sole claim once the run's exemption is bound to another issue", async () => {
      // The run already spends its exemption on otherIssueId (checked out,
      // written, released). Checking out targetIssueId next must not open a
      // second uncapped channel: the write is counted like any cross-issue one.
      const fake = counterDb(0, { ...timerWakeRun, homeIssueId: otherIssueId }, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, base)).resolves.toMatchObject({
        allowed: true,
        count: 1,
        cap: CROSS_ISSUE_INFLUENCE_LIMIT,
      });
      expect(fake.updates).toEqual([]);
      expect(fake.inserted).toEqual([
        expect.objectContaining({
          action: "issue.cross_issue_influence_observed",
          details: expect.objectContaining({ sourceIssueId: null, targetIssueId }),
        }),
      ]);
    });

    it("still rejects a successive sole claim once the run's cap is spent", async () => {
      const fake = counterDb(CROSS_ISSUE_INFLUENCE_LIMIT, {
        ...timerWakeRun,
        homeIssueId: otherIssueId,
      }, [targetIssueId]);

      await expect(observeCrossIssueInfluence(fake.db as never, {
        ...base,
        now: CROSS_ISSUE_INFLUENCE_ENFORCE_AT,
      })).resolves.toMatchObject({
        allowed: false,
        count: CROSS_ISSUE_INFLUENCE_LIMIT + 1,
      });
      expect(fake.updates).toEqual([]);
      expect(fake.inserted).toEqual([
        expect.objectContaining({ action: "issue.cross_issue_influence_cap_rejected" }),
      ]);
    });
  });
});
