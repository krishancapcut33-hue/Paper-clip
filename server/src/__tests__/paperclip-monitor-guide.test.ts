import fs from "node:fs/promises";
import path from "node:path";
import { it, expect } from "vitest";

  it("uses the authoritative PATCH response to confirm monitor scheduling", async () => {
    const skillBody = await fs.readFile(path.resolve("skills/paperclip/references/issue-monitors.md"), "utf8");

    expect(skillBody).toContain("Use that request's default full response");
    expect(skillBody).toContain("do not issue a confirming GET");
    expect(skillBody).toContain("`monitorNextCheckAt` is non-null");
    expect(skillBody).toContain("`assigneeAgentId` is set");
    expect(skillBody).toContain("`assigneeUserId` is null");
  });

