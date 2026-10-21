// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/queryKeys";
import { AgentDetailPage } from "./AgentDetailPage";
const params = vi.hoisted(() => ({ agentId: "agent", companyPrefix: "CO", tab: "plugin:test.plugin:insights" }));
const state = vi.hoisted(() => ({ slots: [{ pluginKey: "test.plugin", id: "insights", displayName: "Insights" }, { pluginKey: "test.plugin", id: "notes", displayName: "Notes" }] as unknown[], isLoading: false, errorMessage: null }));
const mount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/router", () => ({ useParams: () => params, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompanyId: "other", companies: [{ id: "company", issuePrefix: "CO" }] }) }));
vi.mock("./AgentDetail", () => ({ AgentDetail: () => <p>Built-in agent view</p> }));
vi.mock("@/plugins/slots", () => ({ usePluginSlots: () => state, PluginSlotMount: (props: unknown) => { mount(props); return <p>Plugin contribution</p>; } }));
function render() {
  const client = new QueryClient();
  client.setQueryData([...queryKeys.agents.detail("agent"), "company"], { id: "agent-id", companyId: "company", name: "Agent" });
  return renderToStaticMarkup(<QueryClientProvider client={client}><AgentDetailPage /></QueryClientProvider>);
}
describe("agent plugin detail views", () => {
  it.each(["insights", "notes"])("mounts arbitrary %s contributions with the resolved agent/company", (id) => {
    params.tab = `plugin:test.plugin:${id}`;
    expect(render()).toContain("Plugin contribution");
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({ slot: expect.objectContaining({ id }), context: expect.objectContaining({ companyId: "company", entityId: "agent-id", entityType: "agent" }) }));
  });
  it("shows unavailable for a removed contribution", () => {
    params.tab = "plugin:removed:insights";
    expect(render()).toContain("This plugin view is unavailable");
    params.tab = "plugin:test.plugin:insights";
  });
  it("preserves built-in agent routes", () => {
    params.tab = "overview";
    expect(render()).toContain("Built-in agent view");
    params.tab = "plugin:test.plugin:insights";
  });
});
