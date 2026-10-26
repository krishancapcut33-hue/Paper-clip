import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const fixture = fileURLToPath(new URL("../../../tests/e2e/fixtures/agent-chat.mjs", import.meta.url));

for (const wakeReason of ["issue_continuation_needed", "chat_task_completed", "issue_commented"]) {
  test(`chat fixture handles ${wakeReason} without replaying a plan on system wakes`, async () => {
    const requests = [];
    const server = createServer(async (req, res) => {
      let text = "";
      for await (const chunk of req) text += chunk;
      const body = text ? JSON.parse(text) : undefined;
      requests.push({ method: req.method, path: req.url, body });
      let response;
      switch (`${req.method} ${req.url}`) {
        case "GET /api/heartbeat-runs/run":
          response = { contextSnapshot: { issueId: "chat", wakeReason, wakeCommentId: "user-comment" } };
          break;
        case "GET /api/issues/chat":
          response = { id: "chat", conversationAgentId: "agent" };
          break;
        case "GET /api/issues/chat/comments?order=asc":
          response = [{ id: "user-comment", authorUserId: "user", body: JSON.stringify({ action: "plan", text: "Preserved plan" }) }];
          break;
        case "GET /api/issues/chat/documents":
          response = [{ key: "plan", latestRevisionId: "approved-revision" }];
          break;
        case "PUT /api/issues/chat/documents/plan":
          response = { ...body, latestRevisionId: "new-revision" };
          break;
        case "POST /api/issues/chat/comments":
          response = { id: "reply" };
          break;
        default:
          res.statusCode = 404;
          response = { error: "Unexpected fixture request" };
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const child = spawn(process.execPath, [fixture], {
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          PAPERCLIP_API_URL: `http://127.0.0.1:${server.address().port}`,
          PAPERCLIP_API_KEY: "fixture-test",
          PAPERCLIP_RUN_ID: "run",
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      const code = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
      });
      assert.equal(code, 0, stderr);
      const writes = requests.filter(({ method }) => method === "PUT");
      assert.equal(writes.length, wakeReason === "issue_commented" ? 1 : 0);
      if (writes.length) {
        assert.equal(writes[0].body.body, "Preserved plan");
        assert.equal(writes[0].body.baseRevisionId, "approved-revision");
      }
      assert.equal(requests.at(-1).path, "/api/issues/chat/comments");
      if (wakeReason !== "issue_commented") assert.equal(requests.length, 3);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
