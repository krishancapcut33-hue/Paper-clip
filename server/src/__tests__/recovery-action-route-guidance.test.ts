import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { recoveryActionNotFoundGuidance } from "../app.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", recoveryActionNotFoundGuidance);
  return app;
}

// The wrong paths agents actually call, per the server log: company-scoped,
// action-scoped, and PATCH on the action-scoped form.
const wrongPaths = [
  "/api/recovery-actions/0a967a4b-3a52-42b7-8c3d-8e47176ba9a7/resolve",
  "/api/companies/41d8aeaf-0e55-4127-b037-7a6d740be3b6/recovery-actions/0a967a4b-3a52-42b7-8c3d-8e47176ba9a7/resolve",
];

describe("recovery-action 404 guidance", () => {
  it.each(wrongPaths)("names the working resolve route for %s", async (path) => {
    const res = await request(createApp()).post(path).send({ resolutionNote: "x" }).expect(404);
    expect(res.body.error).toBe("API route not found");
    expect(res.body.details.route).toBe(
      "POST /api/issues/{issueId}/recovery-actions/resolve",
    );
    expect(res.body.details.requestedPath).toContain(path);
    expect(res.body.details.requestBody.outcome).toContain("restored");
  });

  it("keeps the plain 404 for unrelated unknown routes", async () => {
    const res = await request(createApp()).get("/api/does-not-exist").expect(404);
    expect(res.body).toEqual({ error: "API route not found" });
  });
});