import { describe, expect, it } from "vitest";
import { resolveDefaultProjectWorkspacePath } from "../services/projects.js";

describe("resolveDefaultProjectWorkspacePath", () => {
  const project = { id: "proj-1", name: "My Project", companyId: "comp-1" };

  it("returns null when template is empty", () => {
    expect(resolveDefaultProjectWorkspacePath({ template: null, project })).toBeNull();
    expect(resolveDefaultProjectWorkspacePath({ template: "   ", project })).toBeNull();
  });

  it("requires a project placeholder", () => {
    expect(
      resolveDefaultProjectWorkspacePath({ template: "/tmp/{company_id}", project }),
    ).toBeNull();
  });

  it("renders placeholders and expands ~", () => {
    const result = resolveDefaultProjectWorkspacePath({
      template: "~/Workspaces/{project_slug}",
      project,
    });
    expect(result).not.toBeNull();
    expect(result!.endsWith("/Workspaces/my-project")).toBe(true);
    expect(result!.startsWith("/")).toBe(true);
  });

  it("rejects non-absolute and traversal paths", () => {
    expect(
      resolveDefaultProjectWorkspacePath({ template: "relative/{project_name}", project }),
    ).toBeNull();
    expect(
      resolveDefaultProjectWorkspacePath({ template: "/tmp/{project_name}/../x", project }),
    ).toBeNull();
  });

  it("sanitizes project name segments", () => {
    const result = resolveDefaultProjectWorkspacePath({
      template: "/tmp/{project_name}",
      project: { id: "p", name: "a/b\\c", companyId: "c" },
    });
    expect(result).toBe("/tmp/a-b-c");
  });

  it("renders repo_name when provided", () => {
    const result = resolveDefaultProjectWorkspacePath({
      template: "/tmp/{project_name}/{repo_name}",
      project,
      repoUrl: "https://github.com/org/my-repo.git",
    });
    expect(result).toBe("/tmp/My Project/my-repo");
  });
});
