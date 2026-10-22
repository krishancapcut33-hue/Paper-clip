import { createToolAccessAudit } from "./tool-access/audit.js";
import { createConnectionTokenBroker } from "./tool-access/token-broker/service.js";
import { assertConfiguredTokenBrokerEndpointsAllowed } from "./tool-access/token-broker/endpoint-policy.js";
import { createToolProfileService } from "./tool-access/profiles/service.js";
import { createToolProfileResolver } from "./tool-access/profiles/resolution.js";
import { toProfile, toProfileEntry, toProfileBinding, pendingNewToolsForProfile, profileCatalogColumns } from "./tool-access/profiles/projection.js";
import { lockManagedAppPolicies, lockToolAssignmentAgents, lockToolConnectionRuntimeInputs } from "./tool-access/assignment-locks.js";
export { lockToolConnectionRuntimeInputs } from "./tool-access/assignment-locks.js";
import type { ActorInfo, DbTransaction, ToolAccessMutationDb } from "./tool-access/types.js";
import { normalizeKey, connectionUid } from "./tool-access/identifiers.js";
import { createOAuthEndpointPolicy } from "./tool-access/oauth/endpoint-policy.js";
import { createOAuthDiscovery } from "./tool-access/oauth/discovery.js";
import { createOAuthClientProtocol, storedOAuthTokenEndpointAuthMethod } from "./tool-access/oauth/client.js";
import { normalizeOAuthProviderError, oauthProviderErrorMessage } from "./tool-access/oauth/provider-errors.js";
import { oauthConfig, normalizeOauthScopes, resolveGrantedOauthScopes, sameOAuthIssuer, originOf, isSmokeLabOAuthFixture } from "./tool-access/oauth/metadata.js";
import { resolveOAuthClientIdMetadataDocumentUrl } from "./tool-access/oauth/client-metadata.js";
import type { OAuthProviderEndpoints, OAuthClientRegistrationSource } from "./tool-access/oauth/types.js";
export { OAUTH_CLIENT_ID_METADATA_DOCUMENT_PATH, resolveOAuthClientIdMetadataDocumentUrl, oauthClientIdMetadataDocument } from "./tool-access/oauth/client-metadata.js";
import {
  remoteEndpoint,
  connectionMethodFor,
  connectionMethodForConnection,
  credentialFieldsFor,
  normalizeConnectionMethodConfig,
  projectedConnectionHeaders,
  projectedConnectionToolInputSchema,
} from "./tool-access/connection-methods.js";
export {
  normalizeConnectionMethodConfig,
  projectedConnectionHeaders,
  projectConnectionMethodToolArguments,
  projectConnectionMethodToolInputSchema,
  projectedConnectionToolArguments,
  projectedConnectionToolInputSchema,
} from "./tool-access/connection-methods.js";
import { loadGitHubGrantMetadata, loadGitHubTokenRepositories } from "./tool-access/github-access-discovery.js";
export { loadGitHubGrantMetadata, loadGitHubTokenRepositories } from "./tool-access/github-access-discovery.js";
import { getAppDefinitionForApplicationKey, isConnectorFeatureEnabled } from "@paperclipai/shared";
import { stableHash, descriptorHash } from "./tool-catalog-hash.js";

import { DAYTONA_TOOLS, daytonaClient, daytonaRisk, isDaytonaConnection, isDaytonaToolName } from "./daytona.js";
import { chatCredentialMutationLease } from "./chat-credential-mutation-lease.js";
import { notifyChatEndpointWork } from "./chat-work-notifications.js";
import { removeSlackRegistration } from "./chat-slack-registration-cleanup.js";
import { chatEndpoints } from "@paperclipai/db";
import { AGGREGATOR_NAMES, isAppAggregator, type AggregatorAppsResponse, type ArcadeDiscoverySetupInput } from "@paperclipai/shared/aggregator-apps";
import { resolveAggregatorApp, type AppCatalogAggregator } from "@paperclipai/shared/aggregator-app-catalog";
import { AggregatorDiscoveryUnavailableError, discoverArcadeApps, discoverExecutorApps, type DiscoveredApp } from "./aggregator-app-discovery.js";
import { COMPOSIO_APP_TOOLKITS, findComposioCatalogApp } from "@paperclipai/shared/aggregator-app-catalog";
import type { ComposioAppAccount, ComposioAppAccountInput, ComposioAppSetupInput, ComposioAppSetupResult, ComposioAppSnapshot, ComposioAppsResponse } from "@paperclipai/shared";
import { composioAppAccounts, composioAppSetupResult } from "./composio-app-setup.js";
import { defaultConnectionAgentInstructions } from "@paperclipai/shared";
import { googleWorkspaceEffectiveScopes, GOOGLE_WORKSPACE_DEFAULT_SELECTION, googleWorkspaceSelectedScopes, type GoogleWorkspaceServiceSelection, GOOGLE_WORKSPACE_SERVICES, googleWorkspaceServiceGranted, googleWorkspaceToolName, googleWorkspaceToolTarget, googleWorkspaceGrantedScopes, isGoogleWorkspaceToolGranted, isGoogleWorkspaceScopeGrant, type GoogleWorkspaceService } from "@paperclipai/shared";
import { isInsufficientConnectionScope, INSUFFICIENT_CONNECTION_SCOPE_MESSAGE } from "./connection-permission-errors.js";
import { mcpDiscoveryHttpFailure, retainMcpConnectionFailure, withMcpConnectionFailure } from "./mcp-connection-failure.js";
import { ASANA_CONNECTOR_SCOPES, isAsanaConnectorProfileId, type AsanaConnectorProfileId } from "@paperclipai/shared";
import { BROWSER_USE_TOOLS } from "@paperclipai/shared";
import { browserUseClient, isBrowserUseConnection } from "./browser-use-client.js";
import { browserUseService } from "./browser-use.js";
import { COGNEE_STDIO_TEMPLATE, cogneeCloudUrl } from "./cognee-connection.js";
import { isMemoryConnectorId, isRemoteMcpConnectorMethod, connectionPurposeTransportSchema } from "@paperclipai/shared";
import { instanceSettingsService } from "./instance-settings.js";
import { githubBotRequest } from "./chat-github-client.js";
import { syncConnectionCredentialBindings } from "./connection-credential-bindings.js";
import {
  emitConnectionCreated,
  emitConnectionUpdated,
} from "./connector-telemetry.js";
import { canBrowseProjectRepositoryGrant, mergeProjectRepository } from "./project-repositories.js";

import { measureRunPhase } from "./execution-preparation-timing.js";
import { measureRunTransaction } from "./execution-transaction-timing.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, connectionGrantMembers, connectionGrantDelegations, connectionGrants, connectionTokenIssuances, authUsers, companyMemberships, companySecretBindings, companySecrets, principalPermissionGrants, userSecretDefinitions, userSecretDeclarations, heartbeatRuns, issues, issueThreadInteractions, plugins, toolAccessAuditEvents, toolApplications, toolActionRequests, toolCatalogEntries, toolConnectionInstalls, toolConnectionAppSnapshots, toolConnectionAppSyncs, toolConnections, toolOauthStates, toolStdioCommandTemplates, toolCallEvents, toolInvocations, toolPolicies, toolGatewaySessions, toolMcpGateways, toolMcpGatewayTokens, toolProfileBindings, toolProfileEntries, toolProfiles, toolRuntimeMetricCounters, toolRuntimeSlots } from "@paperclipai/db";
import type { AppDefinition, ConnectionGrantKind, CreateToolApplication, CreateToolConnection, ConnectToolApp, ConnectToolAppResult, CreateToolStdioCommandTemplate, FinishToolApp, FinishToolAppResult, FinalizeOAuthAccess, CreateToolProfileBindingForProfile, CreateToolProfileEntryForProfile, DeploymentExposure, DeploymentMode, ImportMcpJson, McpConnectionCredentialRef, McpJsonImportPreview, ToolApplication, ToolCatalogEntry, ToolCatalogRefreshResult, ToolConnection, ToolConnectionInstall, ToolConnectionInstallSnapshot, ToolConnectionRemovalResult, ToolConnectionRemovalSummary, ToolConnectionHealthCheckResult, ToolConnectionHealthStatus, ToolConnectionAuthKind, ToolConnectionCredentialPolicy, ToolConnectionCredentialSource, ToolConnectionTransport, ToolCredentialSecretRef, ToolOAuthStartResult, ToolAppsAttentionResponse, ToolAppMetadataPreflightResult, ToolActionRequest, ToolActionRequestListItem, ToolActionRequestStatus, ToolConnectionActivityResponse, ToolAppConnectionActionSummary, ToolExampleInstallResult, ToolExampleSmokeCheck, ToolExampleSmokeResult, ToolExampleSummary, ToolCallEvent, ToolInvocation, ToolProfileBinding, ToolProfileEntry, ToolPolicyDecision, ToolPolicy, ToolRiskLevel, ToolRuntimeAlertRecommendation, ToolRuntimeHealthSummary, ToolRunDecision, ToolRunDecisionLookup, ToolRuntimeSlot, ToolStdioCommandTemplate, UpdateToolApplication, UpdateToolConnection, PutToolConnectionInstalls, VercelConnectCredentialReference, VercelConnectGrantReference } from "@paperclipai/shared";
import {
  CLASS3_STATIC_LEASE_ALLOWLIST,
  GITHUB_CONNECTOR_PROFILES,
  GOOGLE_WORKSPACE_CONNECTOR_PROFILES,
  connectionIntentPayloadSchema,
  getAppDefinitionForUrl,
  getAvailableConnectionMethods,
  getConnectableAppDefinition,
  isGitHubConnectorProfileId,
  isGoogleWorkspaceConnectorProfileId,
  isToolConnectionAttentionHealth,
  recommendedDefaultsForApp,
  type GitHubConnectorProfileId,
  type GoogleWorkspaceConnectorProfileId,
} from "@paperclipai/shared";
import {
  checkMcpRemoteHeaderName,
  checkMcpRemoteHeaderValue,
  mcpRemoteHeaderNameFromConfigPath,
  mcpRemoteHeaderRejectionMessage,
} from "@paperclipai/shared";
import {
  badRequest,
  conflict,
  forbidden,
  HttpError,
  notFound,
  unprocessable,
} from "../errors.js";
import { isUniqueViolation } from "../db-errors.js";
import { logger } from "../middleware/logger.js";
import { logActivity } from "./activity-log.js";
import { isSlackMcpAccessDisabledResponse } from "./slack-mcp-error.js";
import { initializeMcpHttpSession, McpHttpInitializationError, getMcpHttpSession, forgetMcpHttpSessions, readMcpHttpResponse, mcpHttpRequestHeaders } from "./mcp-http.js";
import {
  assertPublicRemoteHttpEndpoint,
  parseRemoteHttpEndpoint,
  type RemoteHttpEndpointLookup,
} from "./remote-http-endpoint-guard.js";
import {
  guardedRemoteHttpFetch,
  type GuardedRemoteHttpFetchOptions,
} from "./remote-http-fetch.js";
import {
  REMOTE_URL_SECRET_CONFIG_PATH,
  remoteUrlCredentialMatchesPublicUrl,
  splitRemoteUrlCredential,
} from "./remote-url-credentials.js";
import { secretService } from "./secrets.js";
import { connectionCredentialConfigPath as credentialRefConfigPath, connectionGrantCredentialRef, connectionSecretsUsedByOtherConsumers, resolveConnectionGrantSecret, validateConnectionGrantSecretOwnership, writeConnectionCredential } from "./connection-credentials.js";
import { agentmailApi } from "./agentmail-api.js";
import type { ConfigureRailwaySsh, RailwaySshSetup } from "@paperclipai/shared";
import { generateRailwaySshKey, RAILWAY_SSH_SECRET_PATH, validateRailwayKnownHosts } from "./railway-ssh.js";
import { createRailwayClient, discoverRailwayWorkspace, isRailwayConnection, isRailwayEndpoint, isRailwayToolBlocked, normalizeRailwayToolName, RAILWAY_TOOLS, RAILWAY_TOOL_PREFIX, railwayRisk, RailwayError } from "./railway.js";
import { toolAccessPolicyService } from "./tool-access-policy.js";
import {
  readSignedToolArgumentsPayload,
  TOOL_ACTION_REQUEST_SIGNING_GRACE_MS,
} from "./tool-content-guards.js";

import { googleChatToolDescription } from "./google-chat-tool-policy.js";
import { gmailArchiveToolDescription } from "./gmail-archive-tool-policy.js";
import { TOOL_RUNTIME_AUDIT_WRITE_FAILURE_METRIC } from "./tool-runtime-metrics.js";
import {
  createToolRuntimeSupervisor,
  ToolRuntimeSupervisorError,
} from "./tool-runtime-supervisor.js";
import { listConnectionLifecycleEvents } from "./tool-connection-activity.js";
import { isRetiredComposioConnection, RETIRED_COMPOSIO_MESSAGE } from "@paperclipai/shared";
import {
  appWithPaperclipCloudConnectorAvailability,
  paperclipCloudConnectorCapabilitiesFromEnv,
  createPaperclipCloudConnector,
  isPaperclipCloudConnectorStrategy,
  paperclipCloudConnectorConfigFromEnv,
  PaperclipCloudConnectorError,
  type PaperclipCloudConnector,
} from "./paperclip-cloud-connector.js";
import {
  createVercelConnectClient,
  deriveVercelConnectSubject,
  vercelConnectCallbackUrl,
  vercelConnectIntegrationStatus,
  vercelGrantReference,
  vercelTokenRequest,
  VercelConnectClientError,
  type VercelConnectClient,
} from "./vercel-connect.js";
const REMOTE_HTTP_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REMOTE_HTTP_REDIRECTS = 5;
const OAUTH_REFRESH_LEASE_MS = 120_000;
const OAUTH_REFRESH_LEASE_WAIT_MS = 30_000;
const OAUTH_REFRESH_LEASE_POLL_MS = 25;

const oauthRegistrationFlights = new Map<string, Promise<unknown>>();

async function singleFlight<T>(
  flights: Map<string, Promise<unknown>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const existing = flights.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = operation();
  flights.set(key, pending);
  try {
    return await pending;
  } finally {
    if (flights.get(key) === pending) flights.delete(key);
  }
}

type ToolAccessServiceOptions = {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
  trustedLocalStdioRuntimeHost?: string | null;
  now?: () => Date;
  /** How long persisted remote MCP action discovery remains fresh. */
  catalogCacheTtlMs?: number;
  /** Test seam for deciding whether an OAuth client metadata URL is publicly resolvable. */
  oauthClientMetadataLookup?: RemoteHttpEndpointLookup;
  /** Test seam for deterministic remote endpoint resolution. Production uses DNS. */
  remoteHttpEndpointLookup?: RemoteHttpEndpointLookup;
  /** Test seam for protocol fixtures. Production uses the DNS-pinned transport. */
  remoteHttpRequest?: (url: string, init: RequestInit) => Promise<Response>;
  /** Smaller reviewed catalog for deterministic discovery fixtures. */
  composioAppToolkits?: readonly string[];
  /** Test seam for the centrally registered Gmail OAuth broker. */
  paperclipCloudConnector?: PaperclipCloudConnector | null;
  /** @deprecated Use paperclipCloudConnector. */
  paperclipIdGmailConnector?: PaperclipCloudConnector | null;
  /** Test seam for Vercel Connect without live vendor traffic. */
  vercelConnectClient?: VercelConnectClient | null;
};

export type McpToolDescriptor = {
  name: string;
  title?: string | null;
  description?: string | null;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

const GOOGLE_SHEETS_SPREADSHEET_SCHEMA = {
  type: "object",
  properties: {
    spreadsheetId: { type: "string", minLength: 1 },
  },
  required: ["spreadsheetId"],
};

const GOOGLE_SHEETS_RANGE_SCHEMA = {
  type: "object",
  properties: {
    spreadsheetId: { type: "string", minLength: 1 },
    range: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: ["spreadsheetId", "range"],
};

const GOOGLE_SHEETS_VALUE_ROWS_SCHEMA = {
  type: "array",
  minItems: 1,
  items: {
    type: "array",
    items: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
      ],
    },
  },
};

const GOOGLE_SHEETS_WRITE_VALUES_SCHEMA = {
  type: "object",
  properties: {
    spreadsheetId: { type: "string", minLength: 1 },
    range: { type: "string", minLength: 1, maxLength: 500 },
    values: GOOGLE_SHEETS_VALUE_ROWS_SCHEMA,
    valueInputOption: {
      type: "string",
      enum: ["RAW", "USER_ENTERED"],
      default: "RAW",
    },
  },
  required: ["spreadsheetId", "range", "values"],
};

function schemaHasInputProperties(schema: unknown): boolean {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return false;
  const properties = (schema as Record<string, unknown>).properties;
  return Boolean(
    properties &&
    typeof properties === "object" &&
    !Array.isArray(properties) &&
    Object.keys(properties).length > 0,
  );
}

const APPROVED_STDIO_TEMPLATES: Record<
  string,
  {
    name: string;
    command?: string | null;
    args?: string[];
    envKeys?: string[];
    tools: McpToolDescriptor[];
  }
> = {
  "paperclip.echo-calculator-time": {
    name: "Paperclip Echo / Calculator / Time fixture",
    tools: [
      {
        name: "echo",
        description: "Return the provided message.",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: "add",
        description: "Add two numbers.",
        inputSchema: {
          type: "object",
          properties: { a: { type: "number" }, b: { type: "number" } },
          required: ["a", "b"],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: "now",
        description: "Return the current server time.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
      },
      {
        name: "fail_with_code",
        description: "Deterministically fail with a requested status code.",
        inputSchema: {
          type: "object",
          properties: { code: { type: "number" } },
          required: ["code"],
        },
        annotations: { readOnlyHint: true },
      },
    ],
  },
  "paperclip.synthetic-todo-kv": {
    name: "Paperclip Synthetic Todo / KV fixture",
    tools: [
      {
        name: "list_items",
        description: "List synthetic todo items.",
        annotations: { readOnlyHint: true },
      },
      {
        name: "create_item",
        description: "Create a synthetic todo item.",
        annotations: { readOnlyHint: false },
      },
      {
        name: "mark_done",
        description: "Mark a synthetic todo item done.",
        annotations: { readOnlyHint: false },
      },
      {
        name: "delete_item",
        description: "Delete a synthetic todo item.",
        annotations: { destructiveHint: true },
      },
      {
        name: "get_value",
        description: "Read a synthetic KV value.",
        annotations: { readOnlyHint: true },
      },
      {
        name: "set_value",
        description: "Write a synthetic KV value.",
        annotations: { readOnlyHint: false },
      },
    ],
  },
  "paperclip.cognee-cloud": COGNEE_STDIO_TEMPLATE,
  "paperclip.google-sheets": {
    name: "Google Sheets",
    command: "paperclip-google-sheets-mcp-server",
    args: [],
    envKeys: [
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_PATH",
      "GOOGLE_SHEETS_ALLOWED_SPREADSHEET_IDS",
    ],
    tools: [
      {
        name: "list_spreadsheets",
        description:
          "List the Google Sheets spreadsheets configured in this connection allowlist.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
      },
      {
        name: "get_spreadsheet_info",
        description:
          "Get spreadsheet metadata and sheet tab information for an allowlisted spreadsheet.",
        inputSchema: GOOGLE_SHEETS_SPREADSHEET_SCHEMA,
        annotations: { readOnlyHint: true },
      },
      {
        name: "read_values",
        description: "Read cell values from an allowlisted spreadsheet range.",
        inputSchema: GOOGLE_SHEETS_RANGE_SCHEMA,
        annotations: { readOnlyHint: true },
      },
      {
        name: "search_rows",
        description: "Search rows in an allowlisted spreadsheet range.",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: { type: "string", minLength: 1 },
            range: { type: "string", minLength: 1, maxLength: 500 },
            query: { type: "string", minLength: 1 },
            caseSensitive: { type: "boolean", default: false },
            maxResults: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 50,
            },
          },
          required: ["spreadsheetId", "range", "query"],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: "append_rows",
        description: "Append rows to an allowlisted spreadsheet range.",
        inputSchema: GOOGLE_SHEETS_WRITE_VALUES_SCHEMA,
        annotations: { readOnlyHint: false },
      },
      {
        name: "update_values",
        description: "Update values in an allowlisted spreadsheet range.",
        inputSchema: GOOGLE_SHEETS_WRITE_VALUES_SCHEMA,
        annotations: { readOnlyHint: false },
      },
      {
        name: "add_sheet_tab",
        description: "Add a sheet tab to an allowlisted spreadsheet.",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: { type: "string", minLength: 1 },
            title: { type: "string", minLength: 1, maxLength: 100 },
            rowCount: { type: "integer", minimum: 1, maximum: 1000000 },
            columnCount: { type: "integer", minimum: 1, maximum: 18278 },
          },
          required: ["spreadsheetId", "title"],
        },
        annotations: { readOnlyHint: false },
      },
      {
        name: "clear_values",
        description: "Clear values in an allowlisted spreadsheet range.",
        inputSchema: GOOGLE_SHEETS_RANGE_SCHEMA,
        annotations: { destructiveHint: true },
      },
      {
        name: "delete_rows",
        description: "Delete rows from an allowlisted spreadsheet tab.",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: { type: "string", minLength: 1 },
            sheetId: { type: "integer", minimum: 0 },
            startIndex: { type: "integer", minimum: 0 },
            endIndex: { type: "integer", minimum: 1 },
          },
          required: ["spreadsheetId", "sheetId", "startIndex", "endIndex"],
        },
        annotations: { destructiveHint: true },
      },
    ],
  },
};

const GOOGLE_SHEETS_GALLERY_KEY = "google-sheets";
const GOOGLE_SHEETS_TEMPLATE_ID = "paperclip.google-sheets";
const GOOGLE_SHEETS_ALLOWED_SPREADSHEET_IDS_ENV =
  "GOOGLE_SHEETS_ALLOWED_SPREADSHEET_IDS";

type ToolExampleDefinition = {
  id: string;
  title: string;
  description: string;
  applicationKey: string;
  applicationName: string;
  applicationDescription: string;
  connectionName: string;
  templateId: keyof typeof APPROVED_STDIO_TEMPLATES;
  profileKey: string;
  profileName: string;
  profileDescription: string;
};

const TOOL_EXAMPLES: ToolExampleDefinition[] = [
  {
    id: "safe-read-only-todo-kv",
    title: "Safe read-only Todo / KV fixture",
    description:
      "Installs a deterministic local MCP fixture and grants only its read-only catalog entries.",
    applicationKey: "paperclip.examples.safe-read-only-todo-kv",
    applicationName: "Paperclip example: Safe read-only Todo / KV",
    applicationDescription:
      "Deterministic MCP fixture for first-run tool governance checks.",
    connectionName: "Paperclip example: Safe read-only Todo / KV",
    templateId: "paperclip.synthetic-todo-kv",
    profileKey: "paperclip.examples.safe-read-only-todo-kv.profile",
    profileName: "Example safe read-only tools",
    profileDescription:
      "Allows only the read-only tools from the Paperclip Todo / KV example fixture.",
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  return {};
}

export function googleSheetsRobotEmailFromEnv(
  env: NodeJS.ProcessEnv = process.env,
):
  | { available: true; robotEmail: string }
  | { available: false; reason: string } {
  const inlineOrPath = env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim();
  const explicitPath = env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_PATH?.trim();
  if (!inlineOrPath && !explicitPath) {
    return {
      available: false,
      reason: "Google Sheets is not available on this instance yet.",
    };
  }

  try {
    const raw = explicitPath
      ? readFileSync(explicitPath, "utf8")
      : inlineOrPath!.startsWith("{")
        ? inlineOrPath!
        : readFileSync(inlineOrPath!, "utf8");
    const parsed = JSON.parse(raw) as { client_email?: unknown };
    if (typeof parsed.client_email === "string" && parsed.client_email.trim()) {
      return { available: true, robotEmail: parsed.client_email.trim() };
    }
  } catch {
    return {
      available: false,
      reason: "Google Sheets is not available on this instance yet.",
    };
  }
  return {
    available: false,
    reason: "Google Sheets is not available on this instance yet.",
  };
}

function googleSheetsAllowedSpreadsheetIds(
  configValues: Record<string, unknown> | undefined,
): string[] {
  const raw = configValues?.allowedSpreadsheetIds;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]/g)
      : [];
  return Array.from(
    new Set(values.map((value) => String(value).trim()).filter(Boolean)),
  );
}

function isGoogleSheetsConnectionConfig(
  configValues: Record<string, unknown> | undefined,
): boolean {
  return (
    configValues?.sourceTemplateKey === GOOGLE_SHEETS_GALLERY_KEY ||
    configValues?.templateId === GOOGLE_SHEETS_TEMPLATE_ID
  );
}

function normalizeGoogleSheetsConnectionConfig(
  configValues: Record<string, unknown>,
): Record<string, unknown> {
  if (!isGoogleSheetsConnectionConfig(configValues)) return configValues;
  const allowedSpreadsheetIds = googleSheetsAllowedSpreadsheetIds(configValues);
  if (allowedSpreadsheetIds.length === 0) {
    throw badRequest("Paste at least one Google Sheets link.");
  }
  return {
    ...configValues,
    allowedSpreadsheetIds,
    env: {
      ...asRecord(configValues.env),
      [GOOGLE_SHEETS_ALLOWED_SPREADSHEET_IDS_ENV]:
        allowedSpreadsheetIds.join(","),
    },
  };
}

// Detects a Postgres foreign_key_violation (SQLSTATE 23503) raised by the
// tool_connections.application_id constraint — i.e. an application delete that lost the race to
// a concurrently-created connection now that the FK is ON DELETE RESTRICT. Walks the error and
// its `cause` since the driver may wrap the original pg error.
function isToolConnectionForeignKeyViolation(error: unknown): boolean {
  const records: Record<string, unknown>[] = [];
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth += 1
  ) {
    const record = current as Record<string, unknown>;
    records.push(record);
    current = record.cause;
  }
  return records.some((record) => {
    const code = typeof record.code === "string" ? record.code : null;
    const constraint =
      typeof record.constraint === "string"
        ? record.constraint
        : typeof record.constraint_name === "string"
          ? record.constraint_name
          : null;
    const message = typeof record.message === "string" ? record.message : "";
    return (
      code === "23503" &&
      (constraint ===
        "tool_connections_application_id_tool_applications_id_fk" ||
        /tool_connections/.test(constraint ?? "") ||
        /tool_connections/.test(message))
    );
  });
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

/**
 * The key namespace `connectGalleryApp`, `reconnectGalleryApp` and
 * `createOrRotateOAuthSecret` mint for credentials a connection owns outright.
 * Nothing else writes this prefix, which is what lets removal tell a dedicated
 * app credential apart from a secret the operator manages by hand — see
 * `classifyConnectionSecrets`. Matched as a prefix on purpose: `secrets.remove`
 * suffixes `__deleted__<id>` onto the key before it deletes the row, so a
 * removal that is retried after a provider failure must still recognise it.
 */
const CONNECTION_OWNED_SECRET_KEY_PREFIX = "tool_app.";

/** Token fields a legacy row may have inlined into `config.oauth`. */
const INLINE_OAUTH_TOKEN_FIELDS = [
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "client_secret",
  "clientSecret",
];

/**
 * Drop inline OAuth token material from a connection config, keeping the
 * non-secret identity (client id, issuer, registration source) a later
 * reconnect reuses. Current code stores tokens as secret refs, never in the
 * config; this exists so a row written by an older build cannot keep a usable
 * token after the operator removed the app.
 */
function withoutInlineOAuthTokens(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const oauth = config.oauth;
  if (!oauth || typeof oauth !== "object" || Array.isArray(oauth))
    return config;
  const next = { ...(oauth as Record<string, unknown>) };
  let changed = false;
  for (const field of INLINE_OAUTH_TOKEN_FIELDS) {
    if (field in next) {
      delete next[field];
      changed = true;
    }
  }
  return changed ? { ...config, oauth: next } : config;
}

function actorBinding(actor: ActorInfo | undefined) {
  return {
    actorType: actor?.actorType ?? null,
    actorId: actor?.actorId ?? null,
    sessionId:
      typeof actor?.sessionId === "string" && actor.sessionId.trim().length > 0
        ? actor.sessionId
        : null,
  };
}

function oauthActorType(value: string | null): ActorInfo["actorType"] | null {
  return value === "agent" ||
    value === "user" ||
    value === "system" ||
    value === "plugin"
    ? value
    : null;
}

function assertSameOAuthActor(
  stateRow: typeof toolOauthStates.$inferSelect,
  actor: ActorInfo | undefined,
) {
  const expected = {
    actorType: oauthActorType(stateRow.createdByActorType),
    actorId: stateRow.createdByActorId,
    sessionId: stateRow.createdBySessionId,
  };
  const actual = actorBinding(actor);
  if (!expected.actorType || !expected.actorId) {
    throw forbidden(
      "OAuth sign-in state is not bound to an authenticated board session",
    );
  }
  if (
    expected.actorType !== actual.actorType ||
    expected.actorId !== actual.actorId
  ) {
    throw forbidden(
      "OAuth sign-in must be completed by the user who started it",
    );
  }
  if (expected.sessionId && expected.sessionId !== actual.sessionId) {
    throw forbidden(
      "OAuth sign-in must be completed from the same authenticated session",
    );
  }
}

function toApplication(
  row: typeof toolApplications.$inferSelect,
): ToolApplication {
  return {
    id: row.id,
    companyId: row.companyId,
    applicationKey: row.applicationKey ?? undefined,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    pluginId: row.pluginId,
    ownerAgentId: row.ownerAgentId,
    ownerUserId: row.ownerUserId,
    metadata: row.metadata ?? null,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertClass3ToolCredentialRefAllowed(ref: {
  configPath?: string | null;
  projectionClass?: string | null;
  projectionAllowlistKey?: string | null;
}) {
  const projectionClass = ref.projectionClass ?? "unclassified";
  if (projectionClass !== "class_3_static_lease") return;
  if (!ref.configPath?.trim() || !ref.projectionAllowlistKey?.trim()) {
    throw unprocessable(
      "Class-3 static lease tool credentials require an allowlist key and config path",
      {
        code: "class_3_static_lease_allowlist_required",
        targetType: "tool_connection",
        configPath: ref.configPath ?? null,
      },
    );
  }
  const allowed = CLASS3_STATIC_LEASE_ALLOWLIST.some(
    (entry) =>
      entry.key === ref.projectionAllowlistKey &&
      entry.targetType === "tool_connection" &&
      entry.configPath === ref.configPath,
  );
  if (!allowed) {
    throw unprocessable(
      "Class-3 static lease tool credential is outside the approved allowlist",
      {
        code: "class_3_static_lease_not_allowed",
        allowlistKey: ref.projectionAllowlistKey,
        targetType: "tool_connection",
        configPath: ref.configPath,
      },
    );
  }
}

function toConnection(row: typeof toolConnections.$inferSelect): ToolConnection {
  connectionPurposeTransportSchema.parse(row);
  const retired = isRetiredComposioConnection(row);
  return {
    id: row.id,
    companyId: row.companyId,
    applicationId: row.applicationId,
    name: row.name,
    uid: row.uid,
    connectionKind: row.connectionKind,
    connectionPurpose: row.connectionPurpose,
    ownership: row.ownership,
    transport: row.transport,
    authKind: row.authKind,
    credentialSource: row.credentialSource,
    externalCredential: row.externalCredential ?? null,
    credentialPolicy: row.credentialPolicy,
    status: row.status,
    enabled: row.enabled && !retired,
    agentInstructions: row.agentInstructions ?? null,
    config: row.config ?? {},
    transportConfig: row.transportConfig ?? {},
    credentialRefs: row.credentialRefs ?? [],
    credentialSecretRefs: row.credentialSecretRefs ?? [],
    healthStatus: retired ? "error" : row.healthStatus,
    healthMessage: retired ? RETIRED_COMPOSIO_MESSAGE : row.healthMessage,
    healthCheckedAt: row.healthCheckedAt,
    lastHealthAt: row.lastHealthAt,
    lastCatalogRefreshAt: row.lastCatalogRefreshAt,
    lastError: row.lastError,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function redactedVercelGrant(
  value: VercelConnectGrantReference | null | undefined,
): Omit<VercelConnectGrantReference, "subjectId"> | null {
  if (!value) return null;
  const { subjectId: _subjectId, ...redacted } = value;
  return redacted;
}

function toConnectionGrant(row: typeof connectionGrants.$inferSelect) {
  return {
    ...row,
    externalCredential: redactedVercelGrant(row.externalCredential),
  };
}

function toConnectionInstall(
  row: typeof toolConnectionInstalls.$inferSelect,
): ToolConnectionInstall {
  return {
    id: row.id,
    companyId: row.companyId,
    connectionId: row.connectionId,
    targetType: row.targetType,
    targetId: row.targetId,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function toCatalogEntry(
  row: typeof toolCatalogEntries.$inferSelect,
): ToolCatalogEntry {
  return {
    id: row.id,
    companyId: row.companyId,
    applicationId: row.applicationId,
    connectionId: row.connectionId,
    entryKind: row.entryKind,
    name: row.name,
    toolName: row.toolName,
    title: row.title,
    description: row.description,
    inputSchema: row.inputSchema ?? {},
    outputSchema: row.outputSchema ?? null,
    annotations: row.annotations ?? {},
    riskLevel: row.riskLevel,
    isReadOnly: row.isReadOnly,
    isWrite: row.isWrite,
    isDestructive: row.isDestructive,
    status: row.status,
    addedAt: row.firstSeenAt,
    version: row.version,
    versionHash: row.versionHash,
    schemaHash: row.schemaHash,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    reviewedAt: row.reviewedAt,
    reviewedByAgentId: row.reviewedByAgentId,
    reviewedByUserId: row.reviewedByUserId,
    quarantinedAt: row.quarantinedAt,
    quarantineReason: row.quarantineReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCatalogEntryForConnection(
  row: typeof toolCatalogEntries.$inferSelect,
  connection: typeof toolConnections.$inferSelect,
): ToolCatalogEntry {
  const rawCatalogEntry = toCatalogEntry(row);
  const catalogEntry = {
    ...rawCatalogEntry,
    inputSchema: projectedConnectionToolInputSchema(
      connection,
      rawCatalogEntry.inputSchema ?? {},
      row.toolName,
    ),
    description: gmailArchiveToolDescription(
      connection,
      row.toolName,
      googleChatToolDescription(connection, row.toolName, rawCatalogEntry.description),
    ),
  };
  if (
    connection.transport === "local_stdio" &&
    asRecord(connection.config).templateId === GOOGLE_SHEETS_TEMPLATE_ID &&
    !schemaHasInputProperties(catalogEntry.inputSchema)
  ) {
    const templateTool = APPROVED_STDIO_TEMPLATES[
      GOOGLE_SHEETS_TEMPLATE_ID
    ].tools.find((tool) => tool.name === row.toolName);
    if (schemaHasInputProperties(templateTool?.inputSchema)) {
      return { ...catalogEntry, inputSchema: templateTool!.inputSchema! };
    }
  }
  return catalogEntry;
}

function toRuntimeSlot(
  row: typeof toolRuntimeSlots.$inferSelect,
): ToolRuntimeSlot {
  return {
    id: row.id,
    companyId: row.companyId,
    applicationId: row.applicationId,
    connectionId: row.connectionId,
    projectWorkspaceId: row.projectWorkspaceId,
    executionWorkspaceId: row.executionWorkspaceId,
    issueId: row.issueId,
    ownerScopeType: row.ownerScopeType,
    ownerScopeId: row.ownerScopeId,
    runtimeKind: row.runtimeKind,
    slotKey: row.slotKey,
    status: row.status,
    reuseKey: row.reuseKey,
    workspaceScope: row.workspaceScope,
    credentialScopeHash: row.credentialScopeHash,
    provider: row.provider,
    providerRef: row.providerRef,
    processId: row.processId,
    commandTemplateKey: row.commandTemplateKey,
    healthStatus: row.healthStatus,
    healthMessage: row.healthMessage,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastStartedAt: row.lastStartedAt,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt,
    lastUsedAt: row.lastUsedAt,
    idleExpiresAt: row.idleExpiresAt,
    idleDeadlineAt: row.idleDeadlineAt,
    lastError: row.lastError,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function builtInStdioTemplate(
  templateId: string,
): ToolStdioCommandTemplate | null {
  const template = APPROVED_STDIO_TEMPLATES[templateId];
  if (!template) return null;
  return {
    templateId,
    name: template.name,
    title: template.name,
    description: null,
    status: "active",
    source: "built_in",
    command: template.command ?? null,
    args: template.args ?? [],
    envKeys: template.envKeys ?? [],
    tools: template.tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? null,
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      annotations: tool.annotations ?? {},
    })),
  };
}

function toStdioCommandTemplate(
  row: typeof toolStdioCommandTemplates.$inferSelect,
): ToolStdioCommandTemplate {
  return {
    id: row.id,
    companyId: row.companyId,
    templateId: row.templateKey,
    name: row.name,
    title: row.name,
    description: row.description,
    status: row.status,
    source: "admin",
    command: row.command,
    args: row.args ?? [],
    envKeys: row.envKeys ?? [],
    tools: (row.tools ?? [])
      .map((tool) => normalizeToolDescriptor(tool))
      .filter((tool): tool is McpToolDescriptor => Boolean(tool))
      .map((tool) => ({
        name: tool.name,
        title: tool.title ?? null,
        description: tool.description ?? null,
        inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
        annotations: tool.annotations ?? {},
      })),
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toToolInvocation(
  row: typeof toolInvocations.$inferSelect,
): ToolInvocation {
  return {
    id: row.id,
    companyId: row.companyId,
    idempotencyKey: row.idempotencyKey,
    actorType: row.actorType as ToolInvocation["actorType"],
    actorId: row.actorId,
    agentId: row.agentId,
    issueId: row.issueId,
    runId: row.runId,
    applicationId: row.applicationId,
    connectionId: row.connectionId,
    catalogEntryId: row.catalogEntryId,
    toolName: row.toolName,
    argumentsHash: row.argumentsHash,
    argumentsSummary: row.argumentsSummary ?? null,
    policyDecision: row.policyDecision,
    matchedPolicyIds: row.matchedPolicyIds,
    approvalState: row.approvalState,
    status: row.status,
    upstreamRequestId: row.upstreamRequestId,
    resultHash: row.resultHash,
    resultSummary: row.resultSummary ?? null,
    resultSizeBytes: row.resultSizeBytes,
    resultArtifactId: row.resultArtifactId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toToolActionRequest(
  row: typeof toolActionRequests.$inferSelect,
): ToolActionRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    invocationId: row.invocationId,
    issueId: row.issueId,
    interactionId: row.interactionId,
    approvalId: row.approvalId,
    status: row.status,
    canonicalArgumentsHash: row.canonicalArgumentsHash,
    canonicalArgumentsSummary: row.canonicalArgumentsSummary,
    signedArguments: row.signedArguments,
    previewMarkdown: row.previewMarkdown,
    requestedByAgentId: row.requestedByAgentId,
    requestedByUserId: row.requestedByUserId,
    resolvedByAgentId: row.resolvedByAgentId,
    resolvedByUserId: row.resolvedByUserId,
    decidedByAgentId: row.decidedByAgentId,
    decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt,
    expiresAt: row.expiresAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toToolCallEvent(
  row: typeof toolCallEvents.$inferSelect,
): ToolCallEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    eventType: row.eventType,
    actorType: row.actorType as ToolCallEvent["actorType"],
    actorId: row.actorId,
    agentId: row.agentId,
    runId: row.runId,
    issueId: row.issueId,
    applicationId: row.applicationId,
    connectionId: row.connectionId,
    catalogEntryId: row.catalogEntryId,
    invocationId: row.invocationId,
    actionRequestId: row.actionRequestId,
    runtimeSlotId: row.runtimeSlotId,
    toolName: row.toolName,
    decision: row.decision,
    matchedPolicyIds: row.matchedPolicyIds,
    reasonCode: row.reasonCode,
    outcome: row.outcome,
    latencyMs: row.latencyMs,
    argumentsSummary: row.argumentsSummary ?? null,
    requestHash: row.requestHash,
    requestSummary: row.requestSummary ?? null,
    resultHash: row.resultHash,
    resultSummary: row.resultSummary ?? null,
    resultSizeBytes: row.resultSizeBytes,
    redactionPlan: row.redactionPlan ?? null,
    rateLimitState: row.rateLimitState ?? null,
    metadata: row.metadata ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

function userFallbackName(userId: string): string {
  if (userId === "local-board") return "Board";
  return userId;
}

function denialReasonForDecision(
  invocation: typeof toolInvocations.$inferSelect,
  latestAuditEvent: typeof toolCallEvents.$inferSelect | null,
) {
  if (
    invocation.status === "denied" ||
    invocation.status === "rate_limited" ||
    invocation.status === "failed" ||
    invocation.status === "timed_out"
  ) {
    return (
      invocation.errorMessage ??
      invocation.errorCode ??
      latestAuditEvent?.reasonCode ??
      null
    );
  }
  if (
    latestAuditEvent?.outcome === "denied" ||
    latestAuditEvent?.outcome === "failure" ||
    latestAuditEvent?.outcome === "timeout"
  ) {
    return latestAuditEvent.errorMessage ?? latestAuditEvent.reasonCode ?? null;
  }
  return null;
}

function toPolicy(row: typeof toolPolicies.$inferSelect): ToolPolicy {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    policyType: row.policyType,
    priority: row.priority,
    enabled: row.enabled,
    selectors: row.selectors ?? {},
    conditions: row.conditions ?? null,
    config: row.config ?? null,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function connectionSetupMutationFingerprint(
  row: typeof toolConnections.$inferSelect,
): string {
  return stableHash({
    name: row.name,
    transport: row.transport,
    status: row.status,
    enabled: row.enabled,
    agentInstructions: row.agentInstructions,
    config: row.config,
    transportConfig: row.transportConfig,
    credentialRefs: row.credentialRefs,
    credentialSecretRefs: row.credentialSecretRefs,
    credentialSource: row.credentialSource,
    externalCredential: row.externalCredential,
    credentialPolicy: row.credentialPolicy,
  });
}

function normalizeToolDescriptor(tool: unknown): McpToolDescriptor | null {
  const record = asRecord(tool);
  if (typeof record.name !== "string" || record.name.trim().length === 0)
    return null;
  return {
    name: record.name.trim(),
    title: typeof record.title === "string" ? record.title : null,
    description:
      typeof record.description === "string" ? record.description : null,
    inputSchema: asRecord(record.inputSchema ?? record.input_schema),
    annotations: asRecord(record.annotations),
  };
}

// Match a verb anywhere it forms a name segment, not just at the leading edge.
// Real MCP servers namespace and style tool names many ways:
//   "github:create_issue", "notion:update_page", "slack:postMessage", "set_value".
// A leading-anchor regex (/^(create|...)/) misses every namespaced/camelCase
// form and silently classifies writes as read-only. We normalise camelCase to
// snake_case first so "postMessage" -> "post_message", then match the verb when
// it is delimiter- or word-bounded. This mirrors the gateway classifier in
// tool-gateway.ts (inferToolRisk) so the two stay consistent.
function verbMatches(toolName: string, verbs: string): boolean {
  const normalized = toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  return new RegExp(`\\b(${verbs})\\b|(^|[:._-])(${verbs})([:._-]|$)`).test(
    normalized,
  );
}

const NOTION_READ_TOOLS = new Set([
  "notion-fetch",
  "notion-get-async-task",
  "notion-get-comments",
  "notion-get-teams",
  "notion-get-users",
  "notion-query-data-sources",
  "notion-query-database-view",
  "notion-query-meeting-notes",
  "notion-search",
]);

const NOTION_WRITE_TOOLS = new Set([
  "notion-convert-page-to-skill",
  "notion-create-comment",
  "notion-create-database",
  "notion-create-folder",
  "notion-create-pages",
  "notion-create-view",
  "notion-duplicate-page",
  "notion-move-pages",
  "notion-update-data-source",
  "notion-update-page",
  "notion-update-view",
]);

const SHOPIFY_DESTRUCTIVE_TOOLS = new Set([
  "cancel-cart",
  "cancel-checkout",
  "complete-checkout",
]);

function normalizedProviderToolName(toolName: string): string {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[:._-]+/g, "-");
}

// Aggregators can add arbitrarily powerful tools without changing their MCP
// endpoint. Only these reviewed, exact capabilities are read-only. Unknown or
// renamed actions remain enabled by the usual access rules, but have write risk.
const AGGREGATOR_READ_TOOLS = new Map<string, ReadonlySet<string>>([
  ["executor", new Set(["skills"])],
  ["composio", new Set(["COMPOSIO_SEARCH_TOOLS", "COMPOSIO_GET_TOOL_SCHEMAS", "COMPOSIO_SEARCH_SKILLS", "COMPOSIO_USE_SKILL"])],
  ["arcade", new Set(["Github.GetRepository"])],
  ["zapier", new Set()],
]);

export function classifyRisk(
  tool: McpToolDescriptor,
  sourceTemplateKey?: string | null,
): ToolRiskLevel {
  if (sourceTemplateKey === "google-workspace") {
    const target = googleWorkspaceToolTarget(tool.name);
    if (!target) return "destructive";
    const risk = classifyRisk({ ...tool, name: target.upstreamName }, target.appSlug);
    if (risk === "destructive" || target.leaf === "delete_event" || target.leaf === "send_message") return "destructive";
    if (target.write) return "write";
    return risk;
  }
  const annotations = tool.annotations ?? {};
  if (annotations.destructiveHint === true || annotations.destructive === true)
    return "destructive";
  const normalizedToolName = normalizedProviderToolName(tool.name);
  if (isMemoryConnectorId(sourceTemplateKey)) {
    if (verbMatches(tool.name, "delete|remove|destroy|forget|prune|reset")) return "destructive";
    // Supermemory uses one add_memory tool for both save and forget.
    if (sourceTemplateKey === "supermemory" && normalizedToolName === "add-memory") return "destructive";
    if (verbMatches(tool.name, "add|remember|save|record|ingest|cognify|update|create|set|upload|select|rename|share")) return "write";
    if (annotations.readOnlyHint === false || annotations.writeHint === true) return "write";
    const reads = ["get", "list", "search", "recall", "query", "retrieve", "who"];
    return verbMatches(tool.name, reads.join("|")) ? "read" : "write";
  }
  const reviewedReads = AGGREGATOR_READ_TOOLS.get(sourceTemplateKey ?? "");
  if (reviewedReads) {
    if (verbMatches(tool.name, "delete|remove|destroy|unpublish")) return "destructive";
    if (annotations.readOnlyHint === false || annotations.writeHint === true) return "write";
    return reviewedReads.has(tool.name) ? "read" : "write";
  }
  if (sourceTemplateKey === "browser-use-cloud") {
    return BROWSER_USE_TOOLS.find(t => t.name === tool.name)?.annotations.readOnlyHint ? "read" : "destructive";
  }
  if (sourceTemplateKey === "daytona") return daytonaRisk(tool.name);
  if (sourceTemplateKey === "railway") {
    const reviewed = railwayRisk(normalizedToolName);
    return reviewed === "read" && (annotations.readOnlyHint === false || annotations.writeHint === true) ? "write" : reviewed;
  }
  // Fireflies sharing, moving, and access revocation are mutations even when
  // a provider omits annotations or mistakenly advertises a read hint.
  if (sourceTemplateKey === "fireflies" && [
    "fireflies-share-meeting", "fireflies-revoke-meeting-access", "fireflies-move-meeting",
  ].includes(normalizedToolName)) return "write";
  // Enterpret's run_graph_query self-reports readOnlyHint: true, but Cypher is
  // not a read-only language and live validation never established the tool as
  // safe. Treat it as write so Ask-first defaults can restrict it.
  if (sourceTemplateKey === "enterpret" && normalizedToolName === "run-graph-query")
    return "write";
  // Gmail archive removes a system label. Keep it behind the archive method's
  // destructive Ask-first default even when the preview provider omits hints.
  if (sourceTemplateKey === "gmail" && normalizedToolName === "unlabel-thread")
    return "destructive";
  if (sourceTemplateKey === "posthog" && normalizedToolName === "exec")
    return "destructive";
  // Superagent mirrors its REST API, and several mutations use verbs the
  // generic classifier reads as reads: billable triage_finding, scans,
  // restore_agent_builtin_rule, and credential-revoking revoke_agent_client.
  // Only list/get tools and tools the provider marks read-only are reads.
  if (sourceTemplateKey === "superagent") {
    if (verbMatches(tool.name, "delete|remove|destroy|revoke")) return "destructive";
    if (annotations.readOnlyHint === false || annotations.writeHint === true) return "write";
    return /^(list|get)-/.test(normalizedToolName) || annotations.readOnlyHint === true ? "read" : "write";
  }
  // Ditto's translate, link and unlink tools replace saved text or developer
  // IDs, but the generic classifier reads those verbs as reads. Only
  // list/get/search tools, suggest_edit, and tools Ditto marks read-only are
  // reads.
  if (sourceTemplateKey === "ditto") {
    if (verbMatches(tool.name, "delete|remove|destroy")) return "destructive";
    if (annotations.readOnlyHint === false || annotations.writeHint === true) return "write";
    return /^(list|get|search)-/.test(normalizedToolName) ||
      normalizedToolName === "suggest-edit" ||
      annotations.readOnlyHint === true
      ? "read"
      : "write";
  }
  if (
    sourceTemplateKey === "shopify" &&
    SHOPIFY_DESTRUCTIVE_TOOLS.has(normalizedToolName)
  )
    return "destructive";
  // Notion's hosted MCP catalog contains mutations whose names do not use one
  // of the generic create/update/delete verbs (move, duplicate, and convert).
  // Keep all reviewed tools explicit so provider changes are visible in code,
  // while an annotation may still escalate a known read to a write.
  if (
    sourceTemplateKey === "notion" &&
    NOTION_WRITE_TOOLS.has(normalizedToolName)
  )
    return "write";
  if (annotations.readOnlyHint === false || annotations.writeHint === true)
    return "write";
  if (
    sourceTemplateKey === "notion" &&
    NOTION_READ_TOOLS.has(normalizedToolName)
  )
    return "read";
  if (verbMatches(tool.name, "delete|remove|destroy|unpublish"))
    return "destructive";
  if (
    verbMatches(
      tool.name,
      "create|update|write|set|send|publish|post|mutate|mark|archive",
    )
  )
    return "write";
  // PostHog exposes a broad and evolving catalog. Unknown tools must never be
  // silently treated as reads; provider annotations can opt known reads in.
  if (sourceTemplateKey === "posthog")
    return annotations.readOnlyHint === true ? "read" : "write";
  return "read";
}

export function isGmailToolPermanentlyBlocked(
  tool: McpToolDescriptor,
): boolean {
  if (googleWorkspaceToolLeafName(tool.name) === "unlabel-thread") return false;
  const riskLevel = classifyRisk(tool, "gmail");
  return (
    verbMatches(
      tool.name,
      "send|trash|spam|delete|remove|destroy|execute|run",
    ) ||
    (normalizedProviderToolName(tool.name).includes("label") &&
      riskLevel !== "read")
  );
}

const GOOGLE_WORKSPACE_READ_TOOLS: Record<string, ReadonlySet<string>> = {
  gmail: new Set([
    "get-message",
    "get-thread",
    "get-draft",
    "list-drafts",
    "list-labels",
    "search-threads",
    "list-threads",
    "search-messages",
  ]),
  "google-drive": new Set([
    "download-file-content",
    "get-file-metadata",
    "get-file-permissions",
    "list-recent-files",
    "read-file-content",
    "search-files",
  ]),
  "google-docs": new Set(["read-doc"]),
  "google-sheets": new Set(["get-values", "get-spreadsheet"]),
  "google-slides": new Set(["read-presentation"]),
  "google-calendar": new Set([
    "get-event",
    "list-calendars",
    "list-events",
    "search-events",
    "suggest-time",
  ]),
  "google-chat": new Set([
    "search-conversations",
    "list-messages",
    "search-messages",
  ]),
  "google-people": new Set([
    "search-directory-people",
    "search-contacts",
    "get-user-profile",
  ]),
  "google-workspace-search": new Set(["search-corpus"]),
};

function googleWorkspaceToolLeafName(name: string): string {
  return (name.split(/[.:/]/).pop() ?? name)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export function isGoogleWorkspaceToolAllowed(
  profileId: GoogleWorkspaceConnectorProfileId,
  tool: McpToolDescriptor,
): boolean {
  if (profileId === "workspace.all") return googleWorkspaceToolTarget(tool.name) !== null;
  const profile = GOOGLE_WORKSPACE_CONNECTOR_PROFILES[profileId];
  const toolName = googleWorkspaceToolLeafName(tool.name);
  const readTools =
    GOOGLE_WORKSPACE_READ_TOOLS[profile.appSlug] ?? new Set<string>();
  return (
    readTools.has(toolName) ||
    profile.writeTools.some(
      (writeTool) => googleWorkspaceToolLeafName(writeTool) === toolName,
    )
  );
}

type ManagedConnectorProfileId =
  GoogleWorkspaceConnectorProfileId | GitHubConnectorProfileId | AsanaConnectorProfileId;

function managedConnectorProfile(value: string | undefined): {
  id: ManagedConnectorProfileId;
  provider: "google" | "github" | "asana";
  scopes: readonly string[];
} | null {
  if (value && isAsanaConnectorProfileId(value)) {
    return { id: value, provider: "asana", scopes: ASANA_CONNECTOR_SCOPES };
  }
  if (value && isGoogleWorkspaceConnectorProfileId(value)) {
    return {
      id: value,
      provider: "google",
      scopes: GOOGLE_WORKSPACE_CONNECTOR_PROFILES[value].scopes,
    };
  }
  if (value && isGitHubConnectorProfileId(value)) {
    return {
      id: value,
      provider: "github",
      scopes: GITHUB_CONNECTOR_PROFILES[value].scopes,
    };
  }
  return null;
}

/**
 * Did this error come from the OAuth endpoint gate (PAP-17099)? Such a refusal
 * is Paperclip's own decision about an unsafe address, so it must keep its code
 * and its 422 instead of being folded into a generic upstream failure.
 */
function isOAuthEndpointRejection(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  const code = asRecord(error.details).code;
  return typeof code === "string" && code.endsWith("_endpoint_rejected");
}

function healthFailureHttpStatus(failure: {
  status: ToolConnectionHealthStatus;
  code: string;
}): number {
  if (failure.status === "missing_secret") return 422;
  if (failure.code === "oauth_challenge") return 422;
  if (failure.code === "oauth_refresh_missing") return 422;
  if (failure.code === "oauth_reauthorization_required") return 422;
  if (failure.code === "oauth_insufficient_scope") return 422;
  if (failure.code === "slack_mcp_access_disabled") return 422;
  if (failure.code === "user_authorization_required") return 422;
  if (failure.code === "composio_broker_retired") return 422;
  if (failure.code === "tool_connection_transport_unsupported") return 422;
  if (failure.code === "cognee_access_unverified" || failure.code === "memory_api_key_rejected") return 422;
  if (failure.code.endsWith("_endpoint_rejected")) return 422;
  return 502;
}

function unsupportedToolConnectionTransport() {
  return unprocessable(
    "This connection has no supported tool integration. Add a supported account or MCP connection from Connectors.",
    { code: "tool_connection_transport_unsupported" },
  );
}

function sanitizeHttpFailure(error: unknown): {
  status: ToolConnectionHealthStatus;
  message: string;
  code: string;
} {
  if (error instanceof HttpError) {
    const code = asRecord(error.details).code;
    if (code === "cognee_access_unverified" || code === "memory_api_key_rejected") {
      return { status: "error", message: error.message, code };
    }
    if (code === "grant_credential_invalid" || code === "oauth_insufficient_scope") {
      return { status: code === "grant_credential_invalid" ? "missing_secret" : "degraded", message: error.message, code };
    }
    if (code === "slack_mcp_access_disabled" || code === "google_workspace_services_unavailable") {
      return { status: "error", message: error.message, code };
    }
    if (code === "user_authorization_required") {
      return { status: "error", message: error.message, code };
    }
    if (code === "tool_connection_transport_unsupported") {
      return { status: "error", message: error.message, code };
    }
    if (code === "composio_broker_retired") {
      return { status: "error", message: error.message, code };
    }
    if (typeof code === "string" && code.startsWith("remote_http_")) {
      return { status: "error", message: error.message, code };
    }
    if (isOAuthEndpointRejection(error)) {
      return { status: "error", message: error.message, code: String(code) };
    }
    if (code === "oauth_challenge") {
      return {
        status: "error",
        message: "This app needs you to sign in.",
        code: "oauth_challenge",
      };
    }
    if (code === "oauth_refresh_missing") {
      return {
        status: "failed",
        message: "OAuth credentials have expired and need to be reconnected.",
        code: "oauth_refresh_missing",
      };
    }
    if (code === "oauth_reauthorization_required") {
      return {
        status: "error",
        message: "OAuth authorization expired. Reconnect this app to continue.",
        code: "oauth_reauthorization_required",
      };
    }
    if (typeof code === "string" && code.startsWith("vercel_connect_")) {
      return {
        status:
          code === "vercel_connect_unavailable" ||
          code === "vercel_connect_auth_failed" ||
          code === "vercel_connect_installation_required"
            ? "degraded"
            : "error",
        message: error.message,
        code,
      };
    }
    if (
      code === "oauth_refresh_in_progress" ||
      code === "oauth_refresh_superseded" ||
      code === "oauth_refresh_outcome_unknown"
    ) {
      return {
        status: "error",
        message: error.message,
        code,
      };
    }
    if (
      code === "binding_missing" ||
      code === "secret_deleted" ||
      code === "secret_inactive" ||
      code === "version_missing"
    ) {
      return {
        status: "missing_secret",
        message: "A configured credential secret could not be resolved.",
        code: String(code),
      };
    }
    if (error.status === 404 && /secret/i.test(error.message)) {
      return {
        status: "missing_secret",
        message: "A configured credential secret could not be resolved.",
        code: "secret_missing",
      };
    }
    return { status: "error", message: error.message, code: "paperclip_error" };
  }
  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message.slice(0, 240),
      code: "runtime_error",
    };
  }
  return {
    status: "error",
    message: "Connection check failed.",
    code: "runtime_error",
  };
}

function vercelConnectResourcesFor(
  connection: typeof toolConnections.$inferSelect,
): string[] {
  const resource = new URL(remoteEndpoint(connection.config));
  // OAuth resource indicators name the protected MCP resource, not the
  // connection's transport-only filtering query. PostHog uses this canonical
  // URL to select its MCP consent scope set.
  resource.search = "";
  resource.hash = "";
  return [resource.toString()];
}

function readStdioTemplateId(config: Record<string, unknown>): string {
  const templateId = config.templateId;
  if (typeof templateId !== "string" || templateId.trim().length === 0) {
    throw badRequest(
      "Local stdio MCP connections must use an approved templateId",
    );
  }
  return templateId.trim();
}

async function gitHubReadGrantAccess(db: Db, companyId: string, connectionId: string, userId: string | null, localTrusted: boolean) {
  const [connection] = await db.select().from(toolConnections).where(and(eq(toolConnections.companyId, companyId), eq(toolConnections.id, connectionId)));
  if (!connection || !connection.enabled || connection.status !== "active" || asRecord(connection.config).sourceTemplateKey !== "github") {
    throw forbidden("GitHub connection is unavailable. Choose a connection you can use.");
  }
  const [membership] = userId ? await db.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.principalId, userId), eq(companyMemberships.principalType, "user"), eq(companyMemberships.status, "active"))) : [];
  if (!localTrusted && (!membership || membership.membershipRole === "viewer")) throw forbidden("GitHub access requires an active company member.");
  const grants = await db.select().from(connectionGrants).where(and(eq(connectionGrants.companyId, companyId), eq(connectionGrants.connectionId, connectionId)));
  const members = await db.select().from(connectionGrantMembers).where(eq(connectionGrantMembers.companyId, companyId));
  const candidates = grants.filter(grant => !(grant.kind === "organization" && ["per_user", "per_agent"].includes(connection.credentialPolicy)) && canBrowseProjectRepositoryGrant({
    grant, userId, activeMember: localTrusted || Boolean(membership), audience: members.filter(member => member.grantId === grant.id).map(member => member.subjectId),
  }));
  const allowed: typeof candidates = [];
  for (const grant of candidates) {
    const ref = grant.credentialSecretRefs.find(ref => ref.configPath === "oauth.access_token" || /authorization|token|api_key/i.test(ref.configPath));
    if (!ref) continue;
    try {
      await validateConnectionGrantSecretOwnership(db, connection, grant, ref);
      allowed.push(grant);
    } catch (error) {
      if (!(error instanceof HttpError && asRecord(error.details).code === "grant_credential_invalid")) throw error;
    }
  }
  const legacyShared = !grants.length && connection.credentialPolicy === "shared";
  if (!allowed.length && !legacyShared) throw forbidden("Choose a GitHub connection with an active authorization you can use.");
  return { connection, allowed, legacyShared };
}

export function toolAccessService(
  db: Db,
  options: ToolAccessServiceOptions = {},
) {
  const secrets = secretService(db);
  const { assertOAuthEndpointUrl, safeOAuthEndpointUrl } = createOAuthEndpointPolicy(allowPrivateRemoteEndpoints);
  const { oauthEndpointsForConnection, discoverOAuthEndpoints, preflightConnectionMetadata } = createOAuthDiscovery({
    fetchRemoteHttpUrl, assertRemoteEndpointAllowed, assertOAuthEndpointUrl, safeOAuthEndpointUrl,
  });
  const { requestOAuthClientRegistration, exchangeOAuthToken } = createOAuthClientProtocol({
    fetchRemoteHttpUrl, assertOAuthEndpointUrl,
  });
  const composioSyncJobs = new Map<string, Promise<void>>();
  const composioSyncTtlMs = 5 * 60_000;
  const composioSyncLeaseMs = 4 * 60_000;

  async function resolvedRemoteEndpoint(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
  ): Promise<string> {
    const publicEndpoint = remoteEndpoint(connection.config);
    const ref = connection.credentialRefs.find(
      (candidate) => candidate.placement === "url",
    );
    if (!ref) return publicEndpoint;
    let value: string;
    try {
      const grant = await vaultGrantForConnection(connection, actor);
      const grantRef = grant ? connectionGrantCredentialRef(grant, ref) : undefined;
      if (grant && !grantRef) throw unprocessable("Your MCP URL credential is missing. Reconnect this connection.", {
        code: "grant_credential_invalid", connectionId: connection.id, grantId: grant.id,
      });
      value = grant && grantRef
        ? (await resolveOAuthGrantSecret(connection, grant, grantRef, actor, undefined)).value
        : await secrets.resolveSecretValue(connection.companyId, ref.secretId, ref.version ?? "latest", {
            consumerType: "tool_connection", consumerId: connection.id,
            configPath: REMOTE_URL_SECRET_CONFIG_PATH,
            actorType: actor?.actorType ?? "system", actorId: actor?.actorId ?? null,
          });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw unprocessable("Your MCP URL credential could not be resolved. Reconnect this connection.", {
        code: "mcp_remote_missing_secret", connectionId: connection.id, credential: REMOTE_URL_SECRET_CONFIG_PATH,
      });
    }
    if (!remoteUrlCredentialMatchesPublicUrl(publicEndpoint, value)) {
      throw unprocessable(
        "The stored MCP URL credential no longer matches this connection.",
        {
          code: "mcp_remote_url_credential_mismatch",
          connectionId: connection.id,
        },
      );
    }
    return parseRemoteHttpEndpoint(value, (message, code) =>
      badRequest(message, { code }),
    ).toString();
  }
  const policySvc = toolAccessPolicyService(db);
  const now = options.now ?? (() => new Date());
  const audit = createToolAccessAudit(db);
  const { mintConnectionTokenForAgent, loadBrokerRunContext } = createConnectionTokenBroker(db, { now, secrets, policySvc, audit, getConnectionRow, ensureDefaultOrganizationGrant });
  const profileService = createToolProfileService(db, now);
  const profileDetails = profileService.getProfile;
  const profileResolver = createToolProfileResolver(db, { assertOptionalAgent, resolveInstalledConnectionsForAgent, toCatalogEntry });
  const configuredCloudConnector =
    options.paperclipCloudConnector ?? options.paperclipIdGmailConnector;
  const connectorWasProvided =
    options.paperclipCloudConnector !== undefined ||
    options.paperclipIdGmailConnector !== undefined;
  let cachedCloudConnector = configuredCloudConnector ?? null;
  const currentCloudConnector = (): PaperclipCloudConnector | null => {
    if (cachedCloudConnector || connectorWasProvided)
      return cachedCloudConnector;
    const config = paperclipCloudConnectorConfigFromEnv();
    cachedCloudConnector = config
      ? createPaperclipCloudConnector({ config, now: () => now().getTime() })
      : null;
    return cachedCloudConnector;
  };
  async function appForConnectionSetup(app: AppDefinition): Promise<AppDefinition> {
    if (!app.methods.some((method) => isPaperclipCloudConnectorStrategy(method.oauthStrategy))) {
      return app;
    }
    const profiles = connectorWasProvided
      ? (await currentCloudConnector()?.getCapabilities() ?? [])
      : await paperclipCloudConnectorCapabilitiesFromEnv();
    return appWithPaperclipCloudConnectorAvailability(app, profiles);
  }
  let nextGitHubContinuitySweepAt = 0;
  const vercelConnect =
    options.vercelConnectClient === undefined
      ? createVercelConnectClient()
      : options.vercelConnectClient;
  const runtimeSupervisor = createToolRuntimeSupervisor(db, options);
  // These maps remove duplicate work inside one service instance. OAuth also
  // uses the database refresh lease below as its cross-process boundary.
  const oauthRefreshFlights = new Map<string, Promise<unknown>>();
  const oauthGrantRefreshFlights = new Map<string, Promise<unknown>>();
  const catalogRefreshFlights = new Map<string, Promise<unknown>>();
  const catalogCacheTtlMs = Math.max(
    0,
    options.catalogCacheTtlMs ?? 15 * 60 * 1000,
  );

  function vercelConnectHttpError(error: unknown): HttpError {
    if (error instanceof VercelConnectClientError) {
      return new HttpError(error.status, error.message, { code: error.code });
    }
    return new HttpError(
      502,
      "Vercel Connect could not complete the credential request.",
      {
        code: "vercel_connect_request_failed",
      },
    );
  }

  function vercelCredentialFor(
    connection: typeof toolConnections.$inferSelect,
  ): VercelConnectCredentialReference {
    if (
      connection.credentialSource !== "vercel_connect" ||
      !connection.externalCredential
    ) {
      throw unprocessable("This connection does not use Vercel Connect", {
        code: "vercel_connect_not_configured",
      });
    }
    return connection.externalCredential;
  }

  async function resolveVercelCredentialHeaders(
    connection: typeof toolConnections.$inferSelect,
    grant: typeof connectionGrants.$inferSelect,
    options: { forceRefresh?: boolean } = {},
  ): Promise<Record<string, string>> {
    if (!vercelConnect)
      throw vercelConnectHttpError(
        new VercelConnectClientError("vercel_connect_unavailable", 503),
      );
    const credential = vercelCredentialFor(connection);
    const derived = deriveVercelConnectSubject({
      credential,
      connectionId: connection.id,
      companyId: connection.companyId,
      grantKind: grant.kind,
      subjectUserId: grant.subjectUserId,
    });
    const request = vercelTokenRequest({
      credential,
      grant,
      connectionId: connection.id,
      companyId: connection.companyId,
      resources: vercelConnectResourcesFor(connection),
    });
    try {
      const token = await vercelConnect.getToken(request, options);
      if (
        token.connector.id !== credential.connectorId &&
        token.connector.uid !== credential.connectorUid
      ) {
        throw new VercelConnectClientError(
          "vercel_connect_request_failed",
          502,
        );
      }
      await db
        .update(connectionGrants)
        .set({
          externalCredential: vercelGrantReference({
            credential,
            token,
            subjectId: derived.subjectId,
            verifiedAt: now(),
          }),
          status: "active",
          revokedAt: null,
          updatedAt: now(),
        })
        .where(
          and(
            eq(connectionGrants.id, grant.id),
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
          ),
        );
      return {
        [credential.headerName]: `${credential.headerPrefix ?? ""}${token.token}`,
      };
    } catch (error) {
      if (
        error instanceof VercelConnectClientError &&
        error.code === "vercel_connect_authorization_required"
      ) {
        await db
          .update(connectionGrants)
          .set({
            status: "needs_reauthorization",
            updatedAt: now(),
          })
          .where(
            and(
              eq(connectionGrants.id, grant.id),
              eq(connectionGrants.companyId, connection.companyId),
            ),
          );
      }
      throw vercelConnectHttpError(error);
    }
  }

  async function vercelGrantForConnection(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
  ) {
    const actorUserId =
      actor?.actorType === "user" ? (actor.actorId ?? null) : null;
    if (actorUserId) {
      const [personal] = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, "user"),
            eq(connectionGrants.subjectUserId, actorUserId),
          ),
        )
        .limit(1);
      if (personal) return personal;
    }
    const [organization] = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "organization"),
          eq(connectionGrants.isDefault, true),
        ),
      )
      .limit(1);
    if (!organization) {
      throw conflict("This Vercel Connect identity has not been authorized", {
        code: "vercel_connect_authorization_required",
      });
    }
    return organization;
  }

  function allowPrivateRemoteEndpoints() {
    return (
      options.deploymentMode !== "authenticated" ||
      options.deploymentExposure !== "public"
    );
  }

  async function assertRemoteHttpUrlAllowed(value: string): Promise<string> {
    const endpoint = parseRemoteHttpEndpoint(value, (message, code) =>
      badRequest(message, { code }),
    );
    await assertPublicRemoteHttpEndpoint(
      endpoint,
      {
        allowPrivateNetwork: allowPrivateRemoteEndpoints(),
        lookup: options.remoteHttpEndpointLookup,
      },
      (message, code) => badRequest(message, { code }),
    );
    return endpoint.toString();
  }

  function remoteHttpFetchOptions(): GuardedRemoteHttpFetchOptions {
    return {
      allowPrivateNetwork: allowPrivateRemoteEndpoints(),
      lookup: options.remoteHttpEndpointLookup,
      error: (message, code) => badRequest(message, { code }),
    };
  }

  async function requestRemoteHttpEndpoint(
    endpoint: URL,
    init: RequestInit,
  ): Promise<Response> {
    return options.remoteHttpRequest
      ? options.remoteHttpRequest(endpoint.toString(), {
          ...init,
          redirect: "manual",
        })
      : guardedRemoteHttpFetch(endpoint, init, remoteHttpFetchOptions());
  }

  /**
   * Fetch an operator-supplied remote URL with the egress guard bound to the
   * connection itself.
   *
   * `guardedRemoteHttpFetch` resolves the hostname once and dials the approved
   * address, so a name server that answers public-then-private cannot move the
   * connection onto a loopback or metadata address after validation
   * (PAP-17098). Redirects stay manual and run the full guard again on the next
   * hop, because a `Location` is just as attacker-controlled as the first URL.
   */
  async function fetchRemoteHttpUrl(
    value: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let currentUrl = value;
    const method = (init.method ?? "GET").toUpperCase();
    for (
      let redirectCount = 0;
      redirectCount <= MAX_REMOTE_HTTP_REDIRECTS;
      redirectCount += 1
    ) {
      const endpoint = parseRemoteHttpEndpoint(currentUrl, (message, code) =>
        badRequest(message, { code }),
      );
      const response = await requestRemoteHttpEndpoint(endpoint, init);
      const location = REMOTE_HTTP_REDIRECT_STATUSES.has(response.status)
        ? (response.headers?.get?.("location") ?? null)
        : null;
      if (!location) return response;
      if (method !== "GET" && method !== "HEAD") {
        throw new HttpError(
          502,
          "Remote OAuth endpoint redirected unexpectedly",
          { code: "oauth_redirect_rejected" },
        );
      }
      if (redirectCount >= MAX_REMOTE_HTTP_REDIRECTS) {
        throw new HttpError(
          502,
          "Remote OAuth endpoint redirected too many times",
          { code: "oauth_redirect_limit" },
        );
      }
      currentUrl = new URL(location, endpoint).toString();
    }
    throw new HttpError(
      502,
      "Remote OAuth endpoint redirected too many times",
      { code: "oauth_redirect_limit" },
    );
  }

  async function assertRemoteEndpointAllowed(
    config: Record<string, unknown>,
  ): Promise<string> {
    return assertRemoteHttpUrlAllowed(remoteEndpoint(config));
  }

  async function assertRemoteConnectionEndpointsAllowed(
    config: Record<string, unknown>,
  ): Promise<string> {
    const endpoint = await assertRemoteEndpointAllowed(config);
    await assertConfiguredTokenBrokerEndpointsAllowed(config);
    return endpoint;
  }

  function trustedRuntimeHost() {
    return (
      options.trustedLocalStdioRuntimeHost ??
      process.env.PAPERCLIP_TRUSTED_MCP_RUNTIME_HOST ??
      process.env.PAPERCLIP_TOOL_RUNTIME_TRUSTED_HOST ??
      null
    );
  }

  function assertLocalStdioCanBeEnabled(
    transport: ToolConnectionTransport,
    enabled: boolean,
    config: Record<string, unknown> = {},
  ) {
    if (config.templateId === "paperclip.cognee-cloud") return;
    if (
      transport === "local_stdio" &&
      enabled &&
      options.deploymentMode === "authenticated" &&
      options.deploymentExposure === "public" &&
      !trustedRuntimeHost()
    ) {
      throw unprocessable(
        "Local stdio MCP connections cannot be enabled in authenticated public deployments without a trusted runtime host",
      );
    }
  }

  async function getAdminStdioTemplate(companyId: string, templateId: string) {
    return db
      .select()
      .from(toolStdioCommandTemplates)
      .where(
        and(
          eq(toolStdioCommandTemplates.companyId, companyId),
          eq(toolStdioCommandTemplates.templateKey, templateId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  async function resolveStdioTemplate(
    companyId: string,
    configOrTemplateId: Record<string, unknown> | string,
  ) {
    const templateId =
      typeof configOrTemplateId === "string"
        ? configOrTemplateId.trim()
        : readStdioTemplateId(configOrTemplateId);
    const builtIn = builtInStdioTemplate(templateId);
    if (builtIn) return builtIn;
    const adminTemplate = await getAdminStdioTemplate(companyId, templateId);
    if (!adminTemplate || adminTemplate.status !== "active") {
      throw badRequest(
        "Local stdio MCP connections must use an approved templateId",
      );
    }
    return toStdioCommandTemplate(adminTemplate);
  }

  async function stdioTemplateId(
    companyId: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    return (await resolveStdioTemplate(companyId, config)).templateId;
  }

  function shouldQuarantineNewEntries(
    connection: typeof toolConnections.$inferSelect,
  ): boolean {
    return isDaytonaConnection(connection) || asRecord(connection.config).quarantineNewEntries === true;
  }

  function isAttentionHealthStatus(
    status: ToolConnectionHealthStatus,
  ): boolean {
    return isToolConnectionAttentionHealth(status);
  }

  async function composioCredentialKey(connection: typeof toolConnections.$inferSelect, actor: ActorInfo) {
    const usesConnectionRefs = ["arcade", "executor"].includes(String(connection.config.sourceTemplateKey)) && connection.authKind !== "oauth" && connection.credentialPolicy === "shared";
    const grant = usesConnectionRefs ? null : await vaultGrantForConnection(connection, actor);
    const refs = grant?.credentialSecretRefs ?? connection.credentialSecretRefs;
    const discovery = asRecord(asRecord(connection.config.aggregatorDiscovery)[actor.actorId!]);
    const ids = [...new Set([...refs.map(ref => ref.secretId), ...(typeof discovery.secretId === "string" ? [discovery.secretId] : [])])].sort();
    const versions = ids.length ? await db.select({ id: companySecrets.id, version: companySecrets.latestVersion }).from(companySecrets)
      .where(and(eq(companySecrets.companyId, connection.companyId), inArray(companySecrets.id, ids))).orderBy(asc(companySecrets.id)) : [];
    return createHash("sha256").update(JSON.stringify({ grant: grant?.id, refs, versions,
      ...(Object.keys(discovery).length ? { discovery } : {}),
      ...(connection.config.sourceTemplateKey === "arcade" || connection.config.sourceTemplateKey === "executor"
        ? { headers: projectedConnectionHeaders(connection), managementUrl: connection.config.managementUrl } : {}), endpoint: remoteEndpoint(connection.config), policy: connection.credentialPolicy, connectedAt: asRecord(connection.config.oauth)?.connectedAt })).digest("hex");
  }

  async function cachedComposioApps(connection: typeof toolConnections.$inferSelect, actor: ActorInfo): Promise<ComposioAppSnapshot[]> {
    const credentialKey = await composioCredentialKey(connection, actor);
    const rows = await db.select().from(toolConnectionAppSnapshots).where(and(
      eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connection.id),
      eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey),
    ));
    return rows.map(row => ({ connectionId: row.connectionId, toolkit: row.toolkit, status: row.status, accounts: row.accounts,
      checkedAt: row.checkedAt.toISOString(), errorAt: row.errorAt?.toISOString() ?? null }));
  }

  async function composioAppsResponse(connection: typeof toolConnections.$inferSelect, actor: ActorInfo): Promise<ComposioAppsResponse> {
    const credentialKey = await composioCredentialKey(connection, actor);
    const [sync] = await db.select().from(toolConnectionAppSyncs).where(and(
      eq(toolConnectionAppSyncs.companyId, connection.companyId), eq(toolConnectionAppSyncs.connectionId, connection.id),
      eq(toolConnectionAppSyncs.userId, actor.actorId!), eq(toolConnectionAppSyncs.credentialKey, credentialKey),
    ));
    const interrupted = sync?.status === "syncing" && sync.updatedAt.getTime() < Date.now() - composioSyncLeaseMs;
    return { apps: await cachedComposioApps(connection, actor), sync: {
      status: interrupted || sync?.status === "unsupported" ? "error" : sync?.status ?? "idle", coverage: "supported_catalog",
      checked: sync?.checked ?? 0, total: sync?.total ?? 0, failed: sync?.failed ?? 0,
      lastCompletedAt: sync?.lastCompletedAt?.toISOString() ?? null,
      error: interrupted ? "App checks were interrupted. Refresh to try again."
        : (sync?.status === "error" || sync?.status === "unsupported") ? "Couldn’t finish checking Composio apps. Refresh to try again." : null,
    } };
  }

  async function openComposioGateway(connectionId: string, actor: ActorInfo) {
    const connection = await getConnectionRow(connectionId);
    if (actor.actorType !== "user" || !actor.actorId) throw forbidden("A human connection manager must configure this app");
    if (connection.config.sourceTemplateKey !== "composio" || connection.transport !== "mcp_remote"
      || connection.status !== "active" || !connection.enabled) throw unprocessable("Connect your Composio gateway first");
    const catalog = await db.select().from(toolCatalogEntries).where(and(
      eq(toolCatalogEntries.companyId, connection.companyId), eq(toolCatalogEntries.connectionId, connection.id),
    ));
    if (!catalog.some(tool => tool.toolName === "COMPOSIO_MANAGE_CONNECTIONS" && tool.status === "active")) {
      throw unprocessable("Refresh your Composio gateway's actions before configuring this app");
    }
    const endpoint = await resolvedRemoteEndpoint(connection, actor);
    const headers = { ...projectedConnectionHeaders(connection), ...(await resolveCredentialHeaders(connection, actor)) };
    const credentialKey = await composioCredentialKey(await getConnectionRow(connectionId), actor);
    const send = (init: RequestInit) => requestRemoteHttpEndpoint(new URL(endpoint), { ...init, signal: AbortSignal.timeout(30_000) });
    let sessionHeaders = connection.config.mcpSessionRequired === true
      ? await getMcpHttpSession({ send, headers, scope: `${connection.id}:app-setup:${actor.actorId}`, requestId: "paperclip-app-setup" }) : headers;
    async function manage(toolkits: { name: string; action: "list" | "add" | "rename" | "remove"; account_id?: string; alias?: string }[], tolerateToolkitErrors = false) {
      const checkedAt = new Date();
      const id = `paperclip-app-setup-${randomUUID()}`;
      const request = () => send({ method: "POST", headers: mcpHttpRequestHeaders(sessionHeaders), body: JSON.stringify({
        jsonrpc: "2.0", id, method: "tools/call", params: { name: "COMPOSIO_MANAGE_CONNECTIONS", arguments: { toolkits } },
      }) });
      const markFailed = async () => {
        const names = toolkits.filter(tool => tool.action === "list").map(tool => tool.name);
        if (names.length) await db.update(toolConnectionAppSnapshots).set({ errorAt: checkedAt }).where(and(
          eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connectionId),
          eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey),
          inArray(toolConnectionAppSnapshots.toolkit, names), lte(toolConnectionAppSnapshots.checkedAt, checkedAt),
        ));
      };
      try {
      let response = await request();
      // Only reads retry. An uncertain account mutation must never repeat automatically.
      if (toolkits.every(tool => tool.action === "list") && (response.status === 400 || response.status === 404)) {
        await response.body?.cancel();
        sessionHeaders = await initializeMcpHttpSession({ send, headers, requestId: id });
        response = await request();
      }
      if (!response.ok) throw new HttpError(502, toolkits.every(tool => tool.action === "list")
        ? "Composio could not check this app. Reconnect the gateway if its sign-in expired."
        : "Composio has not confirmed this change. Refresh the accounts before trying again.", { code: "composio_app_setup_failed", status: response.status });
      const payload = await readMcpHttpResponse(response, id);
      if (await composioCredentialKey(await getConnectionRow(connectionId), actor) !== credentialKey) {
        throw conflict("The Composio account changed while checking apps. Refresh to check the current account.");
      }
      const failedToolkits: string[] = [];
      for (const tool of toolkits.filter(tool => tool.action === "list")) {
        let accounts: ComposioAppAccount[];
        try {
          composioAppSetupResult(payload, tool.name);
          const parsed = composioAppAccounts(payload, tool.name);
          if (!parsed) throw unprocessable("Composio did not return a complete account list. Refresh the accounts before trying again.");
          accounts = parsed;
        } catch (error) {
          await db.update(toolConnectionAppSnapshots).set({ errorAt: checkedAt }).where(and(
            eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connectionId),
            eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey),
            eq(toolConnectionAppSnapshots.toolkit, tool.name), lte(toolConnectionAppSnapshots.checkedAt, checkedAt),
          ));
          if (!tolerateToolkitErrors) throw error;
          failedToolkits.push(tool.name);
          continue;
        }
        const status = accounts.some(account => account.status === "ACTIVE") ? "connected" as const : "not_connected" as const;
        await db.insert(toolConnectionAppSnapshots).values({ companyId: connection.companyId, connectionId, userId: actor.actorId!,
          credentialKey, toolkit: tool.name, accounts, status, checkedAt, errorAt: null,
        }).onConflictDoUpdate({ target: [toolConnectionAppSnapshots.companyId, toolConnectionAppSnapshots.connectionId, toolConnectionAppSnapshots.userId, toolConnectionAppSnapshots.toolkit],
          set: { accounts, status, checkedAt, credentialKey, errorAt: null }, setWhere: lte(toolConnectionAppSnapshots.checkedAt, checkedAt) });
      }
      return { payload, failedToolkits };
      } catch (error) { await markFailed(); throw error; }
    }
    return { connection, catalog, credentialKey, manage: async (...args: Parameters<typeof manage>) => (await manage(...args)).payload, checkBatch: manage };
  }

  async function startComposioAppSync(connectionId: string, force: boolean, actor: ActorInfo) {
    const opened = await openComposioGateway(connectionId, actor);
    const { connection, credentialKey } = opened;
    const existing = await cachedComposioApps(connection, actor);
    const catalog = options.composioAppToolkits ?? COMPOSIO_APP_TOOLKITS;
    const toolkits = [...new Set([...existing.filter(app => app.accounts.length > 0).map(app => app.toolkit), ...catalog])];
    const leaseId = randomUUID();
    const startedAt = new Date();
    const [lease] = await db.insert(toolConnectionAppSyncs).values({ companyId: connection.companyId, connectionId,
      userId: actor.actorId!, credentialKey, leaseId, status: "syncing", total: toolkits.length, updatedAt: startedAt,
    }).onConflictDoUpdate({ target: [toolConnectionAppSyncs.companyId, toolConnectionAppSyncs.connectionId, toolConnectionAppSyncs.userId, toolConnectionAppSyncs.credentialKey],
      set: { leaseId, status: "syncing", checked: 0, total: toolkits.length, failed: 0, updatedAt: startedAt },
      setWhere: and(
        or(ne(toolConnectionAppSyncs.status, "syncing"), lt(toolConnectionAppSyncs.updatedAt, new Date(Date.now() - composioSyncLeaseMs))),
        force ? sql`true` : or(ne(toolConnectionAppSyncs.status, "ready"), isNull(toolConnectionAppSyncs.lastCompletedAt),
          lt(toolConnectionAppSyncs.lastCompletedAt, new Date(Date.now() - composioSyncTtlMs))),
      ),
    }).returning();
    if (lease) {
      const updateLease = async (values: Partial<typeof toolConnectionAppSyncs.$inferInsert>) => {
        const updated = await db.update(toolConnectionAppSyncs).set({ ...values, updatedAt: new Date() })
          .where(and(eq(toolConnectionAppSyncs.id, lease.id), eq(toolConnectionAppSyncs.leaseId, leaseId))).returning({ id: toolConnectionAppSyncs.id });
        if (!updated.length) throw conflict("App checks were replaced by a newer sync.");
      };
      const job = (async () => {
        let failed = 0;
        try {
          for (let start = 0; start < toolkits.length; start += 32) {
            if (Date.now() - startedAt.getTime() > composioSyncLeaseMs) throw new Error("Sync deadline exceeded");
            await updateLease({});
            const current = start === 0 ? opened : await openComposioGateway(connectionId, actor);
            if (current.credentialKey !== credentialKey) throw conflict("Composio credentials changed during sync.");
            const batch = toolkits.slice(start, start + 32);
            const result = await current.checkBatch(batch.map(name => ({ name, action: "list" })), true);
            failed += result.failedToolkits.length;
            await updateLease({ checked: start + batch.length, failed });
          }
          await updateLease({ status: failed > 0 ? "error" : "ready", lastCompletedAt: new Date(), failed });
        } catch {
          const [activeLease] = await db.select({ id: toolConnectionAppSyncs.id }).from(toolConnectionAppSyncs)
            .where(and(eq(toolConnectionAppSyncs.id, lease.id), eq(toolConnectionAppSyncs.leaseId, leaseId)));
          if (!activeLease) return;
          // Preserve observations, but never present a failed check as current authorization.
          await db.update(toolConnectionAppSnapshots).set({ errorAt: new Date() }).where(and(
            eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connectionId),
            eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey),
            lte(toolConnectionAppSnapshots.checkedAt, startedAt),
          ));
          await updateLease({ status: "error", failed }).catch(() => undefined);
        }
      })();
      composioSyncJobs.set(leaseId, job);
      void job.finally(() => composioSyncJobs.delete(leaseId)).catch(() => undefined);
    }
    return composioAppsResponse(await getConnectionRow(connectionId), actor);
  }

  function aggregatorProvider(connection: typeof toolConnections.$inferSelect): AppCatalogAggregator {
    const provider = connection.config.sourceTemplateKey;
    if (!isAppAggregator(provider) || connection.transport !== "mcp_remote") throw notFound("Aggregator gateway not found");
    return provider;
  }

  function assertDiscoveryActor(actor: ActorInfo) {
    if (actor.actorType !== "user" || !actor.actorId) throw forbidden("A human connection manager must check accounts");
  }

  async function aggregatorDiscoveryState(connection: typeof toolConnections.$inferSelect, actor: ActorInfo, retryUnsupported = false): Promise<AggregatorAppsResponse["discovery"]> {
    const provider = aggregatorProvider(connection);
    if (connection.status !== "active" || !connection.enabled) return { availability: "disabled", message: "Restore this gateway to check its accounts." };
    if (provider === "arcade") {
      const discovery = asRecord(asRecord(connection.config.aggregatorDiscovery)[actor.actorId!]);
      const headers = projectedConnectionHeaders(connection);
      const grant = connection.authKind === "oauth" || connection.credentialPolicy !== "shared" ? await vaultGrantForConnection(connection, actor) : null;
      const refs = grant?.credentialSecretRefs ?? connection.credentialSecretRefs;
      const hasUserId = Boolean(Object.entries(headers).find(([key]) => key.toLowerCase() === "arcade-user-id")?.[1])
        || refs.some(ref => ref.configPath.toLowerCase() === "headers.arcade-user-id");
      if ((!discovery.secretId || !discovery.userId) && !(hasUserId && connection.authKind === "api_key")) {
        return { availability: "setup_required", message: "Set up account sync to see your Arcade apps here." };
      }
    }
    const catalog = await db.select({ name: toolCatalogEntries.toolName }).from(toolCatalogEntries).where(and(
      eq(toolCatalogEntries.companyId, connection.companyId), eq(toolCatalogEntries.connectionId, connection.id), eq(toolCatalogEntries.status, "active"),
    ));
    if ((provider === "executor" && !catalog.some(tool => ["integrations", "execute"].includes(tool.name)))
      || (provider === "composio" && !catalog.some(tool => tool.name === "COMPOSIO_MANAGE_CONNECTIONS"))) {
      return { availability: "unsupported", message: `${AGGREGATOR_NAMES[provider]} account discovery is unavailable on this gateway. Refresh its actions or check its setup.` };
    }
    if (!retryUnsupported && provider === "executor") {
      const credentialKey = await composioCredentialKey(connection, actor);
      const [sync] = await db.select({ status: toolConnectionAppSyncs.status }).from(toolConnectionAppSyncs).where(and(
        eq(toolConnectionAppSyncs.companyId, connection.companyId), eq(toolConnectionAppSyncs.connectionId, connection.id),
        eq(toolConnectionAppSyncs.userId, actor.actorId!), eq(toolConnectionAppSyncs.credentialKey, credentialKey),
      ));
      if (sync?.status === "unsupported") return { availability: "unsupported", message: "Executor account discovery is unavailable on this server. You can still use the gateway’s actions." };
    }
    return { availability: "available", message: null };
  }

  async function aggregatorAppsResponse(connection: typeof toolConnections.$inferSelect, actor: ActorInfo): Promise<AggregatorAppsResponse> {
    assertDiscoveryActor(actor);
    const provider = aggregatorProvider(connection);
    const result = await composioAppsResponse(connection, actor);
    const discovery = await aggregatorDiscoveryState(connection, actor);
    return { provider, discovery, apps: result.apps.map(snapshot => {
      const app = resolveAggregatorApp(provider, snapshot.toolkit, snapshot.accounts[0]?.appName);
      return { ...snapshot, provider, freshness: discovery.availability !== "available" || snapshot.errorAt || result.sync.status === "error" || connection.status !== "active" || !connection.enabled || Date.now() - new Date(snapshot.checkedAt).getTime() > composioSyncTtlMs ? "stale" as const : "fresh" as const, appSlug: app.slug.startsWith(`${provider}:`) ? `${provider}:${connection.id}:${snapshot.toolkit}` : snapshot.accounts[0]?.appSlug ?? app.slug, appName: snapshot.accounts[0]?.appName ?? app.name };
    }), sync: { ...result.sync, coverage: provider === "composio" ? "supported_catalog" : provider === "arcade" ? "gateway_tools" : "visible_accounts",
      error: result.sync.error ? `Couldn’t finish checking ${AGGREGATOR_NAMES[provider]} apps. Refresh to try again.` : null,
    } };
  }

  async function discoverAggregatorInventory(connection: typeof toolConnections.$inferSelect, actor: ActorInfo): Promise<DiscoveredApp[]> {
    const provider = aggregatorProvider(connection);
    const tools = await remoteTools(connection, undefined, actor);
    connection = await getConnectionRow(connection.id);
    const headers = { ...projectedConnectionHeaders(connection), ...(await resolveCredentialHeaders(connection, actor)) };
    const endpoint = new URL(await resolvedRemoteEndpoint(connection, actor));
    if (provider === "arcade") {
      // The extra project credential never joins invocation headers or tool grants.
      if (endpoint.hostname !== "api.arcade.dev" || endpoint.protocol !== "https:") throw unprocessable("Account sync requires an Arcade Cloud gateway");
      const discovery = asRecord(asRecord(connection.config.aggregatorDiscovery)[actor.actorId!]);
      let key: string | undefined;
      let userId: string | undefined;
      if (typeof discovery.secretId === "string" && typeof discovery.userId === "string") {
        const [secret] = await db.select().from(companySecrets).where(and(eq(companySecrets.id, discovery.secretId), eq(companySecrets.companyId, connection.companyId), eq(companySecrets.ownerUserId, actor.actorId!)));
        if (!secret?.userSecretDefinitionId) throw forbidden("Your Arcade discovery credential is unavailable");
        const resolved = await secrets.resolveUserSecretValue(connection.companyId, { definitionId: secret.userSecretDefinitionId, responsibleUserId: actor.actorId!, required: true }, {
          actorType: "user", actorId: actor.actorId!, consumerType: "tool_connection", consumerId: connection.id, responsibleUserId: actor.actorId!,
        });
        key = resolved?.value;
        userId = discovery.userId;
      } else {
        userId = Object.entries(headers).find(([name]) => name.toLowerCase() === "arcade-user-id")?.[1];
        if (connection.authKind === "api_key") key = Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization")?.[1].replace(/^Bearer\s+/i, "");
      }
      if (!key || !userId) throw unprocessable("Set up Arcade account sync first");
      return discoverArcadeApps({ userId, gatewayTools: tools.map(tool => tool.name), request: async path => {
        const response = await requestRemoteHttpEndpoint(new URL(path, endpoint.origin), { method: "GET", headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) });
        if (!response.ok) { await response.body?.cancel(); throw new HttpError(502, "Arcade could not list your accounts. Check the project API key and Arcade user ID."); }
        return response.json();
      } });
    }
    const send = (init: RequestInit) => requestRemoteHttpEndpoint(endpoint, { ...init, signal: AbortSignal.timeout(30_000) });
    let sessionHeaders = connection.config.mcpSessionRequired === true ? await getMcpHttpSession({ send, headers, scope: `${connection.id}:inventory:${actor.actorId}`, requestId: "paperclip-account-inventory" }) : headers;
    return discoverExecutorApps({ toolNames: tools.map(tool => tool.name), managementUrl: typeof connection.config.managementUrl === "string" ? connection.config.managementUrl : null,
      call: async (name, args) => {
        const id = `paperclip-account-inventory-${randomUUID()}`;
        const request = () => send({ method: "POST", headers: mcpHttpRequestHeaders(sessionHeaders), body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }) });
        let response = await request();
        if (response.status === 400 || response.status === 404) {
          await response.body?.cancel(); sessionHeaders = await initializeMcpHttpSession({ send, headers, requestId: id }); response = await request();
        }
        if (!response.ok) { await response.body?.cancel(); throw new HttpError(502, "Executor could not list your accounts. Reconnect if sign-in expired."); }
        return readMcpHttpResponse(response, id);
      },
    });
  }

  async function syncAggregatorApps(connectionId: string, force: boolean, actor: ActorInfo): Promise<AggregatorAppsResponse> {
    assertDiscoveryActor(actor);
    let connection = await getConnectionRow(connectionId);
    const provider = aggregatorProvider(connection);
    const discovery = await aggregatorDiscoveryState(connection, actor, force);
    if (discovery.availability !== "available") return aggregatorAppsResponse(connection, actor);
    if (provider === "composio") {
      await startComposioAppSync(connectionId, force, actor);
      return aggregatorAppsResponse(await getConnectionRow(connectionId), actor);
    }
    // Resolve/refresh the caller's gateway credentials before fingerprinting the lease.
    await resolveCredentialHeaders(connection, actor);
    connection = await getConnectionRow(connectionId);
    const credentialKey = await composioCredentialKey(connection, actor);
    const leaseId = randomUUID();
    const startedAt = new Date();
    const [lease] = await db.insert(toolConnectionAppSyncs).values({ companyId: connection.companyId, connectionId, userId: actor.actorId!, credentialKey, leaseId, status: "syncing", updatedAt: startedAt })
      .onConflictDoUpdate({ target: [toolConnectionAppSyncs.companyId, toolConnectionAppSyncs.connectionId, toolConnectionAppSyncs.userId, toolConnectionAppSyncs.credentialKey],
        set: { leaseId, status: "syncing", checked: 0, total: 0, failed: 0, updatedAt: startedAt },
        setWhere: and(or(ne(toolConnectionAppSyncs.status, "syncing"), lt(toolConnectionAppSyncs.updatedAt, new Date(Date.now() - composioSyncLeaseMs))),
          force ? sql`true` : or(ne(toolConnectionAppSyncs.status, "ready"), isNull(toolConnectionAppSyncs.lastCompletedAt), lt(toolConnectionAppSyncs.lastCompletedAt, new Date(Date.now() - composioSyncTtlMs)))),
      }).returning();
    if (lease) {
      const job = (async () => {
        try {
          const apps = await discoverAggregatorInventory(connection, actor);
          await db.transaction(async tx => {
            const [current] = await tx.select().from(toolConnections).where(and(eq(toolConnections.id, connectionId), eq(toolConnections.companyId, connection.companyId))).for("update");
            const [active] = await tx.select().from(toolConnectionAppSyncs).where(and(eq(toolConnectionAppSyncs.id, lease.id), eq(toolConnectionAppSyncs.leaseId, leaseId))).for("update");
            if (!current || !active || current.status !== "active" || !current.enabled || Date.now() - startedAt.getTime() > composioSyncLeaseMs
              || await composioCredentialKey(current, actor) !== credentialKey) throw conflict("The gateway changed during account discovery");
            const checkedAt = new Date();
            // Commit the entire enumeration at once; a failed later page cannot delete accounts.
            await tx.update(toolConnectionAppSnapshots).set({ accounts: [], status: "not_connected", checkedAt, errorAt: null }).where(and(
              eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connectionId), eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey),
            ));
            for (const app of apps) await tx.insert(toolConnectionAppSnapshots).values({ companyId: connection.companyId, connectionId, userId: actor.actorId!, credentialKey,
              toolkit: app.toolkit, accounts: app.accounts, status: app.accounts.some(account => account.status === "ACTIVE") ? "connected" : "not_connected", checkedAt,
            }).onConflictDoUpdate({ target: [toolConnectionAppSnapshots.companyId, toolConnectionAppSnapshots.connectionId, toolConnectionAppSnapshots.userId, toolConnectionAppSnapshots.toolkit],
              set: { accounts: app.accounts, status: app.accounts.some(account => account.status === "ACTIVE") ? "connected" : "not_connected", checkedAt, errorAt: null, credentialKey },
            });
            await tx.update(toolConnectionAppSyncs).set({ status: "ready", checked: apps.length, total: apps.length, failed: 0, updatedAt: checkedAt, lastCompletedAt: checkedAt }).where(eq(toolConnectionAppSyncs.id, lease.id));
          });
        } catch (error) {
          await db.transaction(async tx => {
            const [active] = await tx.select().from(toolConnectionAppSyncs).where(and(eq(toolConnectionAppSyncs.id, lease.id), eq(toolConnectionAppSyncs.leaseId, leaseId))).for("update");
            if (!active) return;
            await tx.update(toolConnectionAppSnapshots).set({ errorAt: new Date() }).where(and(eq(toolConnectionAppSnapshots.companyId, connection.companyId), eq(toolConnectionAppSnapshots.connectionId, connectionId), eq(toolConnectionAppSnapshots.userId, actor.actorId!), eq(toolConnectionAppSnapshots.credentialKey, credentialKey)));
            await tx.update(toolConnectionAppSyncs).set({ status: error instanceof AggregatorDiscoveryUnavailableError ? "unsupported" : "error", failed: 1, updatedAt: new Date() }).where(eq(toolConnectionAppSyncs.id, lease.id));
          });
        }
      })();
      composioSyncJobs.set(leaseId, job);
      void job.finally(() => composioSyncJobs.delete(leaseId)).catch(() => undefined);
    }
    return aggregatorAppsResponse(await getConnectionRow(connectionId), actor);
  }

  async function configureArcadeDiscovery(connectionId: string, input: ArcadeDiscoverySetupInput, actor: ActorInfo) {
    assertDiscoveryActor(actor);
    const companyId = (await getConnectionRow(connectionId)).companyId;
    await db.transaction(async tx => {
      const [connection] = await tx.select().from(toolConnections).where(eq(toolConnections.id, connectionId)).for("update");
      if (!connection || aggregatorProvider(connection) !== "arcade" || connection.status === "archived") throw notFound("Arcade gateway not found");
      const all = asRecord(connection.config.aggregatorDiscovery);
      const before = asRecord(all[actor.actorId!]);
      const { secret } = await writeConnectionCredential(tx, {
        companyId: connection.companyId, connectionName: connection.name, configPath: "aggregatorDiscovery.apiKey", label: "Arcade account sync API key",
        value: input.apiKey, ownerUserId: actor.actorId!, actor: actorForSecret(actor),
        existingRef: typeof before.secretId === "string" ? { secretId: before.secretId, configPath: "aggregatorDiscovery.apiKey", versionSelector: "latest" } : undefined,
        definitionKey: `arcade_discovery.${connection.id}`,
      });
      const config = { ...connection.config, aggregatorDiscovery: { ...all, [actor.actorId!]: { userId: input.userId, secretId: secret.id } } };
      await tx.update(toolConnections).set({ config, transportConfig: config, updatedAt: new Date() }).where(eq(toolConnections.id, connectionId));
    });
    await logActivity(db, { companyId, actorType: "user", actorId: actor.actorId!, action: "tool_connection.account_sync_configured", entityType: "tool_connection", entityId: connectionId, details: { provider: "arcade" } });
    return syncAggregatorApps(connectionId, true, actor);
  }

  function runtimeAlert(
    input: ToolRuntimeAlertRecommendation,
  ): ToolRuntimeAlertRecommendation {
    return input;
  }

  function buildRuntimeAlerts(input: {
    stuckStartingSlots: number;
    stuckRunningSlots: number;
    timeoutRate: number;
    timeoutCount: number;
    failureRate: number;
    failureCount: number;
    capacityDeferrals: number;
    restartAttempts: number;
    restartSuppressions: number;
    degradedConnections: number;
    disabledConnections: number;
    missingSecretFailures: number;
    auditWriteFailures: number;
  }): ToolRuntimeAlertRecommendation[] {
    const runbookSection = "doc/MCP-RUNTIME-OPERATIONS.md";
    const timeoutSeverity =
      input.timeoutCount >= 10 || input.timeoutRate >= 25
        ? "critical"
        : input.timeoutCount >= 3 && input.timeoutRate >= 10
          ? "warning"
          : "warning";
    const failureSeverity =
      input.failureCount >= 10 || input.failureRate >= 25
        ? "critical"
        : input.failureCount >= 5 && input.failureRate >= 10
          ? "warning"
          : "warning";
    const restartSeverity =
      input.restartSuppressions > 0 ? "critical" : "warning";
    return [
      runtimeAlert({
        name: "mcp_runtime_stuck_starting_slot",
        severity: "critical",
        status: input.stuckStartingSlots > 0 ? "firing" : "ok",
        threshold: "Any starting slot older than 5 minutes.",
        observed: `${input.stuckStartingSlots} stuck starting slot(s).`,
        description:
          "A local stdio runtime slot is stuck before it reaches running state.",
        firstResponderAction:
          "Inspect the slot health/logs, stop the slot, restart it once, then disable the connection if the slot sticks again.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_stuck_running_slot",
        severity: "critical",
        status: input.stuckRunningSlots > 0 ? "firing" : "ok",
        threshold: "Any running slot with no progress for 5 minutes.",
        observed: `${input.stuckRunningSlots} stuck running slot(s).`,
        description:
          "A runtime slot is running but has not recorded progress inside the supervisor stuck-slot window.",
        firstResponderAction:
          "Inspect recent audit events and active tool calls; restart the slot only after confirming no healthy call is still in progress.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_high_timeout_rate",
        severity: timeoutSeverity,
        status:
          input.timeoutCount >= 3 && input.timeoutRate >= 10 ? "firing" : "ok",
        threshold:
          "Warning at >=3 timeouts and >=10% timeout rate in 1 hour; critical at >=10 timeouts or >=25%.",
        observed: `${input.timeoutCount} timeout(s), ${input.timeoutRate}% timeout rate.`,
        description:
          "Tool gateway calls are timing out or being runtime-deferred at an elevated rate.",
        firstResponderAction:
          "Check upstream MCP health, Paperclip runtime capacity, and recent gateway audit failures before retrying workloads.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_high_error_rate",
        severity: failureSeverity,
        status:
          input.failureCount >= 5 && input.failureRate >= 10 ? "firing" : "ok",
        threshold:
          "Warning at >=5 failures and >=10% failure rate in 1 hour; critical at >=10 failures or >=25%.",
        observed: `${input.failureCount} failure(s), ${input.failureRate}% failure rate.`,
        description:
          "Tool gateway calls are failing after policy authorization.",
        firstResponderAction:
          "Group audit failures by reasonCode, then fix credentials/config or disable the affected connection.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_capacity_deferrals_repeated",
        severity: input.capacityDeferrals >= 10 ? "critical" : "warning",
        status: input.capacityDeferrals >= 3 ? "firing" : "ok",
        threshold:
          "Warning at >=3 capacity deferrals in 1 hour; critical at >=10.",
        observed: `${input.capacityDeferrals} capacity deferral(s) in 1 hour.`,
        description:
          "The runtime supervisor is refusing local stdio work because company or host slot capacity is exhausted.",
        firstResponderAction:
          "Stop idle/stale slots, lower noisy workloads, or raise slot caps only after confirming host capacity.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_restart_storm",
        severity: restartSeverity,
        status:
          input.restartSuppressions > 0 || input.restartAttempts >= 3
            ? "firing"
            : "ok",
        threshold:
          "Warning at >=3 restarts in 1 hour; critical on any restart suppression.",
        observed: `${input.restartAttempts} restart attempt(s), ${input.restartSuppressions} suppression(s).`,
        description:
          "Runtime slots are restarting repeatedly or have hit restart-storm suppression.",
        firstResponderAction:
          "Stop the affected slot, inspect stderr/audit reason codes, and keep the connection disabled until the template/upstream is fixed.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_connection_health_degraded",
        severity: input.degradedConnections > 0 ? "critical" : "warning",
        status:
          input.degradedConnections > 0 || input.disabledConnections > 0
            ? "firing"
            : "ok",
        threshold:
          "Any active enabled connection with degraded/failed/missing-secret health, or any disabled enabled-path connection.",
        observed: `${input.degradedConnections} degraded connection(s), ${input.disabledConnections} disabled connection(s).`,
        description:
          "A configured MCP connection is not healthy or has been disabled.",
        firstResponderAction:
          "Run a connection health check, refresh catalog after recovery, or keep the connection disabled and route agents to alternatives.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_missing_secret_failures",
        severity: input.missingSecretFailures >= 3 ? "critical" : "warning",
        status: input.missingSecretFailures > 0 ? "firing" : "ok",
        threshold:
          "Warning on any missing-secret failure; critical at >=3 in 1 hour.",
        observed: `${input.missingSecretFailures} missing-secret failure(s) in 1 hour.`,
        description:
          "A connection or tool call needed a bound secret that could not be resolved.",
        firstResponderAction:
          "Check secret bindings and provider health without printing secret values; rotate or rebind missing secrets.",
        runbookSection,
      }),
      runtimeAlert({
        name: "mcp_runtime_audit_write_failures",
        severity: "critical",
        status: input.auditWriteFailures > 0 ? "firing" : "ok",
        threshold: "Any audit write failure.",
        observed: `${input.auditWriteFailures} audit write failure(s) in 1 hour.`,
        description:
          "Tool gateway audit writes failed, reducing incident traceability.",
        firstResponderAction:
          "Treat as a control-plane incident: check database writes, activity log writes, and retry only after audit durability is restored.",
        runbookSection,
      }),
    ];
  }

  async function runtimeHealth(
    companyId: string,
  ): Promise<ToolRuntimeHealthSummary> {
    const generatedAt = now();
    const windowStartedAt = new Date(generatedAt.getTime() - 60 * 60 * 1000);
    const stuckSlotMs = 5 * 60 * 1000;
    const [
      slots,
      connections,
      auditRows,
      callEvents,
      auditWriteFailureCounterRows,
    ] = await Promise.all([
      db
        .select()
        .from(toolRuntimeSlots)
        .where(eq(toolRuntimeSlots.companyId, companyId)),
      db
        .select()
        .from(toolConnections)
        .where(eq(toolConnections.companyId, companyId)),
      db
        .select()
        .from(toolAccessAuditEvents)
        .where(
          and(
            eq(toolAccessAuditEvents.companyId, companyId),
            gte(toolAccessAuditEvents.createdAt, windowStartedAt),
          ),
        )
        .orderBy(desc(toolAccessAuditEvents.createdAt)),
      db
        .select()
        .from(toolCallEvents)
        .where(
          and(
            eq(toolCallEvents.companyId, companyId),
            gte(toolCallEvents.createdAt, windowStartedAt),
          ),
        )
        .orderBy(desc(toolCallEvents.createdAt)),
      db
        .select({
          count: sql<number>`coalesce(sum(${toolRuntimeMetricCounters.count}), 0)::int`,
        })
        .from(toolRuntimeMetricCounters)
        .where(
          and(
            eq(toolRuntimeMetricCounters.companyId, companyId),
            eq(
              toolRuntimeMetricCounters.metric,
              TOOL_RUNTIME_AUDIT_WRITE_FAILURE_METRIC,
            ),
            gte(toolRuntimeMetricCounters.bucketStartAt, windowStartedAt),
          ),
        ),
    ]);
    const activeSlots = slots.filter(
      (slot) =>
        slot.status === "starting" ||
        slot.status === "running" ||
        slot.status === "idle",
    );
    const staleActiveSlots = activeSlots.filter((slot) => {
      const lastProgressAt =
        slot.lastUsedAt ?? slot.startedAt ?? slot.updatedAt;
      return generatedAt.getTime() - lastProgressAt.getTime() > stuckSlotMs;
    });
    const callTerminalEvents = callEvents.filter(
      (event) =>
        event.eventType === "call_completed" ||
        event.eventType === "call_failed" ||
        event.eventType === "call_denied",
    );
    const toolCallsLastHour = callTerminalEvents.length;
    const toolTimeoutsLastHour = callTerminalEvents.filter(
      (event) => event.outcome === "timeout",
    ).length;
    const toolFailuresLastHour = callTerminalEvents.filter(
      (event) => event.outcome === "failure",
    ).length;
    const durations = auditRows
      .map((row) => numberValue(asRecord(row.details).durationMs))
      .filter((value): value is number => value !== null && value >= 0);
    const capacityDeferrals = auditRows.filter(
      (row) =>
        row.action === "runtime_deferred" ||
        row.reasonCode === "runtime_company_capacity_exhausted" ||
        row.reasonCode === "runtime_host_capacity_exhausted",
    ).length;
    const restartAttempts = auditRows.filter(
      (row) =>
        row.action === "runtime_started" && row.reasonCode !== "lazy_start",
    ).length;
    const restartSuppressions = auditRows.filter(
      (row) =>
        row.action === "runtime_restart_suppressed" ||
        row.reasonCode === "runtime_restart_suppressed",
    ).length;
    const idleEvictions = auditRows.filter(
      (row) =>
        row.action === "runtime_stopped" &&
        row.reasonCode === "idle_ttl_expired",
    ).length;
    const missingSecretFailures = auditRows.filter(
      (row) =>
        row.reasonCode === "missing_secret" ||
        (row.outcome === "failure" && row.reasonCode?.includes("secret")),
    ).length;
    const legacyAuditWriteFailures = auditRows.filter(
      (row) =>
        row.action === "runtime_audit_write_failed" ||
        row.reasonCode === "audit_write_failed",
    ).length;
    const auditWriteFailuresMetric =
      Number(auditWriteFailureCounterRows[0]?.count ?? 0) +
      legacyAuditWriteFailures;
    const enabledPathConnections = connections.filter(
      (connection) => connection.status === "active" && connection.enabled,
    );
    const activeConnections = enabledPathConnections.length;
    const disabledConnections = connections.filter(
      (connection) => connection.status === "disabled",
    ).length;
    const degradedConnections = enabledPathConnections.filter((connection) =>
      ["degraded", "failed", "error", "missing_secret"].includes(
        connection.healthStatus,
      ),
    ).length;
    const metrics = {
      windowStartedAt,
      windowEndedAt: generatedAt,
      activeSlots: activeSlots.length,
      startingSlots: slots.filter((slot) => slot.status === "starting").length,
      runningSlots: slots.filter((slot) => slot.status === "running").length,
      idleSlots: slots.filter((slot) => slot.status === "idle").length,
      failedSlots: slots.filter(
        (slot) => slot.status === "failed" || slot.status === "error",
      ).length,
      stoppedSlots: slots.filter(
        (slot) => slot.status === "stopped" || slot.status === "disabled",
      ).length,
      stuckStartingSlots: staleActiveSlots.filter(
        (slot) => slot.status === "starting",
      ).length,
      stuckRunningSlots: staleActiveSlots.filter(
        (slot) => slot.status === "running",
      ).length,
      capacityDeferralsLastHour: capacityDeferrals,
      restartAttemptsLastHour: restartAttempts,
      restartSuppressionsLastHour: restartSuppressions,
      idleEvictionsLastHour: idleEvictions,
      toolCallsLastHour,
      toolTimeoutsLastHour,
      toolFailuresLastHour,
      timeoutRateLastHour: percent(toolTimeoutsLastHour, toolCallsLastHour),
      failureRateLastHour: percent(toolFailuresLastHour, toolCallsLastHour),
      averageToolLatencyMsLastHour:
        durations.length > 0
          ? Math.round(
              durations.reduce((sum, value) => sum + value, 0) /
                durations.length,
            )
          : null,
      p95ToolLatencyMsLastHour: percentile(durations, 95),
      missingSecretFailuresLastHour: missingSecretFailures,
      auditWriteFailuresLastHour: auditWriteFailuresMetric,
      activeConnections,
      disabledConnections,
      degradedConnections,
      remoteHttpConnections: connections.filter(
        (connection) =>
          connection.status !== "archived" &&
          connection.transport === "mcp_remote",
      ).length,
      localStdioConnections: connections.filter(
        (connection) =>
          connection.status !== "archived" &&
          connection.transport === "local_stdio",
      ).length,
    };
    const recommendations = buildRuntimeAlerts({
      stuckStartingSlots: metrics.stuckStartingSlots,
      stuckRunningSlots: metrics.stuckRunningSlots,
      timeoutRate: metrics.timeoutRateLastHour,
      timeoutCount: metrics.toolTimeoutsLastHour,
      failureRate: metrics.failureRateLastHour,
      failureCount: metrics.toolFailuresLastHour,
      capacityDeferrals,
      restartAttempts,
      restartSuppressions,
      degradedConnections,
      disabledConnections,
      missingSecretFailures,
      auditWriteFailures: metrics.auditWriteFailuresLastHour,
    });
    const firing = recommendations.filter((alert) => alert.status === "firing");
    const status = firing.some((alert) => alert.severity === "critical")
      ? "critical"
      : firing.length > 0
        ? "degraded"
        : "ok";
    const deploymentMode = options.deploymentMode ?? "local_trusted";
    const deploymentExposure = options.deploymentExposure ?? "private";
    const localStdioSupported =
      deploymentMode === "local_trusted" || Boolean(trustedRuntimeHost());
    return {
      status,
      generatedAt,
      runbookPath: "doc/MCP-RUNTIME-OPERATIONS.md",
      metrics,
      supportMatrix: {
        remoteHttp: {
          supported: true,
          note: "mcp_remote MCP connections are supported in hosted cloud and local deployments.",
        },
        localStdio: {
          supported: localStdioSupported,
          note: localStdioSupported
            ? "local_stdio is available for local trusted mode or through the configured trusted MCP runtime host."
            : `local_stdio should stay disabled for ${deploymentMode}/${deploymentExposure}; use mcp_remote or configure a trusted runtime worker.`,
        },
      },
      alerts: firing,
      recommendations,
    };
  }

  async function runtimeSlotById(
    companyId: string,
    slotId: string,
  ): Promise<ToolRuntimeSlot> {
    const [row] = await db
      .select()
      .from(toolRuntimeSlots)
      .where(
        and(
          eq(toolRuntimeSlots.companyId, companyId),
          eq(toolRuntimeSlots.id, slotId),
        ),
      )
      .limit(1);
    if (!row) throw notFound("Runtime slot not found");
    return toRuntimeSlot(row);
  }

  function runtimeSupervisorHttpError(error: ToolRuntimeSupervisorError) {
    return new HttpError(error.status, error.message, {
      code: error.reasonCode,
      ...error.details,
    });
  }

  async function controlRuntimeSlot(input: {
    companyId: string;
    slotId: string;
    action: "stop" | "restart";
    actor?: ActorInfo;
  }): Promise<ToolRuntimeSlot> {
    try {
      if (input.action === "stop") {
        await runtimeSupervisor.stopSlot({
          companyId: input.companyId,
          slotId: input.slotId,
          reason: "operator_stop",
        });
      } else {
        await runtimeSupervisor.restartSlot({
          companyId: input.companyId,
          slotId: input.slotId,
        });
      }
      const slot = await runtimeSlotById(input.companyId, input.slotId);
      await logActivity(db, {
        companyId: input.companyId,
        actorType: input.actor?.actorType ?? "system",
        actorId: input.actor?.actorId ?? "tool-access-service",
        action:
          input.action === "stop"
            ? "tool_runtime_slot.operator_stopped"
            : "tool_runtime_slot.operator_restarted",
        entityType: "tool_runtime_slot",
        entityId: input.slotId,
        details: {
          runtimeKind: slot.runtimeKind,
          status: slot.status,
          slotKey: slot.slotKey,
        },
      });
      return slot;
    } catch (error) {
      if (error instanceof ToolRuntimeSupervisorError) {
        throw runtimeSupervisorHttpError(error);
      }
      throw error;
    }
  }

  async function assertApplication(companyId: string, applicationId: string) {
    const [row] = await db
      .select()
      .from(toolApplications)
      .where(
        and(
          eq(toolApplications.id, applicationId),
          eq(toolApplications.companyId, companyId),
        ),
      );
    if (!row) throw notFound("Tool application not found");
    return row;
  }

  async function assertOptionalAgent(
    companyId: string,
    agentId: string | null | undefined,
    label: string,
  ) {
    if (!agentId) return;
    const [row] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
    if (!row) throw unprocessable(`${label} must belong to the same company`);
  }

  async function assertOptionalPlugin(pluginId: string | null | undefined) {
    if (!pluginId) return;
    const [row] = await db
      .select({ id: plugins.id })
      .from(plugins)
      .where(eq(plugins.id, pluginId));
    if (!row) throw unprocessable("Tool application plugin was not found");
  }

  async function assertSecretRefs(
    companyId: string,
    refs: Array<{
      secretId: string;
      configPath?: string | null;
      projectionClass?: string | null;
      projectionAllowlistKey?: string | null;
    }>,
  ) {
    if (refs.length === 0) return;
    for (const ref of refs) {
      assertClass3ToolCredentialRefAllowed(ref);
    }
    const secretIds = [...new Set(refs.map((ref) => ref.secretId))];
    for (const secretId of secretIds) {
      const [secret] = await db
        .select({ id: companySecrets.id })
        .from(companySecrets)
        .where(
          and(
            eq(companySecrets.id, secretId),
            eq(companySecrets.companyId, companyId),
          ),
        );
      if (!secret)
        throw unprocessable(
          "Tool connection credential secrets must belong to the same company",
        );
    }
  }

  async function assertGoogleSheetsSpreadsheetOwnership(
    companyId: string,
    config: Record<string, unknown>,
    options: { excludeConnectionId?: string } = {},
  ) {
    if (!isGoogleSheetsConnectionConfig(config)) return;
    const allowedSpreadsheetIds = googleSheetsAllowedSpreadsheetIds(config);
    if (allowedSpreadsheetIds.length === 0) return;
    const allowed = new Set(allowedSpreadsheetIds);
    const rows = await db
      .select({
        id: toolConnections.id,
        companyId: toolConnections.companyId,
        config: toolConnections.config,
      })
      .from(toolConnections)
      .where(ne(toolConnections.status, "archived"));

    const conflictingSpreadsheetIds = new Set<string>();
    for (const row of rows) {
      if (row.id === options.excludeConnectionId || row.companyId === companyId)
        continue;
      if (!isGoogleSheetsConnectionConfig(row.config)) continue;
      for (const spreadsheetId of googleSheetsAllowedSpreadsheetIds(
        row.config,
      )) {
        if (allowed.has(spreadsheetId))
          conflictingSpreadsheetIds.add(spreadsheetId);
      }
    }

    if (conflictingSpreadsheetIds.size > 0) {
      throw conflict(
        "Google Sheets spreadsheet is already connected to another company.",
        {
          code: "google_sheets_spreadsheet_already_bound",
          spreadsheetIds: Array.from(conflictingSpreadsheetIds).sort(),
        },
      );
    }
  }

  async function assertCatalogEntry(
    companyId: string,
    catalogEntryId: string | null | undefined,
  ) {
    if (!catalogEntryId) return;
    const [row] = await db
      .select({ id: toolCatalogEntries.id })
      .from(toolCatalogEntries)
      .where(
        and(
          eq(toolCatalogEntries.id, catalogEntryId),
          eq(toolCatalogEntries.companyId, companyId),
        ),
      );
    if (!row)
      throw unprocessable(
        "Tool profile catalog entry selector must belong to the same company",
      );
  }

  async function appProfileForConnection(
    dbClient: Pick<Db, "select" | "insert" | "delete">,
    connection: typeof toolConnections.$inferSelect,
  ) {
    const profileKey = `app:${connection.id}`;
    let [profile] = await dbClient
      .select()
      .from(toolProfiles)
      .where(
        and(
          eq(toolProfiles.companyId, connection.companyId),
          eq(toolProfiles.profileKey, profileKey),
        ),
      )
      .limit(1);
    if (!profile) {
      const [sameName] = await dbClient
        .select({ id: toolProfiles.id })
        .from(toolProfiles)
        .where(
          and(
            eq(toolProfiles.companyId, connection.companyId),
            eq(toolProfiles.name, connection.name),
          ),
        )
        .limit(1);
      const profileName = sameName
        ? `${connection.name} (${connection.id.replace(/-/g, "").slice(0, 8)})`
        : connection.name;
      [profile] = await dbClient
        .insert(toolProfiles)
        .values({
          companyId: connection.companyId,
          profileKey,
          name: profileName,
          description: `Access profile for ${connection.name}.`,
          status: "active",
          defaultAction: "deny",
          metadata: {
            source: "tool_connection_install",
            connectionId: connection.id,
          },
        })
        .returning();
    }
    // Installation controls where a connection is exposed, not which actions
    // it grants. The app wizard's catalog-entry includes are the authority for
    // action selection, so remove the legacy connection-wide include that used
    // to silently turn every installed action on.
    await dbClient
      .delete(toolProfileEntries)
      .where(
        and(
          eq(toolProfileEntries.companyId, connection.companyId),
          eq(toolProfileEntries.profileId, profile.id),
          eq(toolProfileEntries.selectorType, "connection"),
          eq(toolProfileEntries.effect, "include"),
          eq(toolProfileEntries.connectionId, connection.id),
        ),
      );
    return profile;
  }

  async function enableCatalogEntriesByDefault(input: {
    connection: typeof toolConnections.$inferSelect;
    newCatalogEntryIds: string[];
    activeCatalogEntryIds: string[];
    restoreDraftDefaults?: boolean;
    actor?: ActorInfo;
  }, dbClient: ToolAccessMutationDb = db) {
    // Catalog discovery also runs while the setup wizard is still a draft.
    // Access is not granted until the operator finishes that wizard, so a
    // draft refresh must never manufacture a profile or company-wide binding.
    // Active legacy connections may still need the managed profile created on
    // their first refresh. A reconnect is the one draft exception: removal
    // deliberately clears the old selections, so reconnecting restores the
    // documented defaults without activating the connection itself.
    if (input.connection.status !== "active" && !input.restoreDraftDefaults)
      return;
    const profileKey = `app:${input.connection.id}`;
    let [profile] = await dbClient
      .select()
      .from(toolProfiles)
      .where(
        and(
          eq(toolProfiles.companyId, input.connection.companyId),
          eq(toolProfiles.profileKey, profileKey),
        ),
      )
      .limit(1).for("no key update");
    await lockManagedAppPolicies(dbClient, input.connection.companyId, input.connection.id);
    const createdProfile = !profile;
    const resetToRecommendedDefaults = !profile || profile.status !== "active";
    if (resetToRecommendedDefaults) await lockToolAssignmentAgents(dbClient, input.connection.companyId, [{ targetType: "company", targetId: input.connection.companyId }]);
    if (!profile) {
      const [sameName] = await dbClient
        .select({ id: toolProfiles.id })
        .from(toolProfiles)
        .where(
          and(
            eq(toolProfiles.companyId, input.connection.companyId),
            eq(toolProfiles.name, input.connection.name),
          ),
        )
        .limit(1);
      const profileName = sameName
        ? `${input.connection.name} (${input.connection.id.replace(/-/g, "").slice(0, 8)})`
        : input.connection.name;
      [profile] = await dbClient
        .insert(toolProfiles)
        .values({
          companyId: input.connection.companyId,
          profileKey,
          name: profileName,
          description: `Access profile for ${input.connection.name}.`,
          status: "active",
          defaultAction: "deny",
          metadata: {
            source: "app_gallery_finish",
            connectionId: input.connection.id,
          },
        })
        .returning();
      await dbClient.insert(toolProfileBindings).values({
        companyId: input.connection.companyId,
        profileId: profile.id,
        targetType: "company",
        targetId: input.connection.companyId,
        priority: 100,
        metadata: { source: "app_gallery_finish" },
        createdByAgentId:
          input.actor?.actorType === "agent"
            ? (input.actor.actorId ?? null)
            : null,
        createdByUserId:
          input.actor?.actorType === "user"
            ? (input.actor.actorId ?? null)
            : null,
      });
    } else if (resetToRecommendedDefaults) {
      // Removing an app may retain its profile row when another record still
      // references it (for example, an MCP gateway). Reconnecting revives the
      // same connection id, so restore that retained profile as a fresh
      // all-agents assignment instead of leaving every read action Off.
      [profile] = await dbClient
        .update(toolProfiles)
        .set({
          name: input.connection.name,
          description: `Access profile for ${input.connection.name}.`,
          status: "active",
          defaultAction: "deny",
          metadata: {
            source: "app_gallery_finish",
            connectionId: input.connection.id,
          },
          updatedAt: new Date(),
        })
        .where(eq(toolProfiles.id, profile.id))
        .returning();
      await dbClient
        .delete(toolProfileBindings)
        .where(
          and(
            eq(toolProfileBindings.companyId, input.connection.companyId),
            eq(toolProfileBindings.profileId, profile.id),
          ),
        );
      await dbClient
        .delete(toolProfileEntries)
        .where(
          and(
            eq(toolProfileEntries.companyId, input.connection.companyId),
            eq(toolProfileEntries.profileId, profile.id),
          ),
        );
      await dbClient.insert(toolProfileBindings).values({
        companyId: input.connection.companyId,
        profileId: profile.id,
        targetType: "company",
        targetId: input.connection.companyId,
        priority: 100,
        metadata: { source: "app_gallery_finish" },
        createdByAgentId:
          input.actor?.actorType === "agent"
            ? (input.actor.actorId ?? null)
            : null,
        createdByUserId:
          input.actor?.actorType === "user"
            ? (input.actor.actorId ?? null)
            : null,
      });
    }

    if (resetToRecommendedDefaults) {
      // Old setup defaults created app-scoped Ask first policies for writes.
      // They outrank profile allows, so a revived connection must explicitly
      // retire them to make every action Allowed. Policies outside this app's
      // managed profile are intentionally untouched.
      await upsertAskFirstPolicies({
        companyId: input.connection.companyId,
        connection: input.connection,
        askFirstEntries: [],
        actor: input.actor,
      }, dbClient);
    }

    // A new or revived connection starts with every discovered action enabled.
    // Later refreshes extend an active managed profile only for genuinely new
    // actions, so an action the operator deliberately turned off remains off.
    const candidateIds = [
      ...new Set(
        createdProfile || resetToRecommendedDefaults
          ? input.activeCatalogEntryIds
          : input.newCatalogEntryIds,
      ),
    ];
    if (candidateIds.length === 0) return;
    const existingEntries = await dbClient
      .select({ catalogEntryId: toolProfileEntries.catalogEntryId })
      .from(toolProfileEntries)
      .where(
        and(
          eq(toolProfileEntries.companyId, input.connection.companyId),
          eq(toolProfileEntries.profileId, profile.id),
          inArray(toolProfileEntries.catalogEntryId, candidateIds),
        ),
      );
    const configuredIds = new Set(
      existingEntries.flatMap((entry) =>
        entry.catalogEntryId ? [entry.catalogEntryId] : [],
      ),
    );
    const entryIds = candidateIds.filter((id) => !configuredIds.has(id));
    if (entryIds.length === 0) return;
    await dbClient.insert(toolProfileEntries).values(
      entryIds.map((catalogEntryId) => ({
        companyId: input.connection.companyId,
        profileId: profile.id,
        selectorType: "catalog_entry" as const,
        effect: "include" as const,
        applicationId: input.connection.applicationId,
        connectionId: input.connection.id,
        catalogEntryId,
      })),
    );
  }

  async function listConnectionInstalls(
    connectionId: string,
    companyId?: string,
  ): Promise<ToolConnectionInstall[]> {
    const connection = await getConnectionRow(connectionId, companyId);
    const rows = await db
      .select()
      .from(toolConnectionInstalls)
      .where(
        and(
          eq(toolConnectionInstalls.companyId, connection.companyId),
          eq(toolConnectionInstalls.connectionId, connection.id),
        ),
      )
      .orderBy(
        asc(toolConnectionInstalls.targetType),
        asc(toolConnectionInstalls.targetId),
      );
    return rows.map(toConnectionInstall);
  }

  async function resolveInstalledConnectionsForAgent(
    companyId: string,
    agentId: string,
  ): Promise<ToolConnection[]> {
    await assertOptionalAgent(
      companyId,
      agentId,
      "Tool connection install agent",
    );
    const installRows = await db
      .select()
      .from(toolConnectionInstalls)
      .where(
        and(
          eq(toolConnectionInstalls.companyId, companyId),
          sql`((${toolConnectionInstalls.targetType} = 'company' and ${toolConnectionInstalls.targetId} = ${companyId}) or (${toolConnectionInstalls.targetType} = 'agent' and ${toolConnectionInstalls.targetId} = ${agentId}))`,
        ),
      );
    if (installRows.length === 0) return [];
    const connectionIds = [
      ...new Set(installRows.map((install) => install.connectionId)),
    ];
    const rows = await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.companyId, companyId),
          inArray(toolConnections.id, connectionIds),
        ),
      )
      .orderBy(asc(toolConnections.name));
    return rows.map((row) => ({
      ...toConnection(row),
      installs: installRows
        .filter((install) => install.connectionId === row.id)
        .map(toConnectionInstall),
    }));
  }

  async function getConnectionRow(idOrUid: string, companyId?: string) {
    const identifier =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrUid,
      )
        ? eq(toolConnections.id, idOrUid)
        : eq(toolConnections.uid, idOrUid);
    const where = companyId
      ? and(identifier, eq(toolConnections.companyId, companyId))
      : identifier;
    const [row] = await db.select().from(toolConnections).where(where);
    if (!row) throw notFound("Tool connection not found");
    return row;
  }

  async function ensureDefaultOrganizationGrant(
    connection: typeof toolConnections.$inferSelect,
    dbClient: ToolAccessMutationDb = db,
    onMutation?: (mutation: {
      previous: typeof connectionGrants.$inferSelect | null;
      current: typeof connectionGrants.$inferSelect;
    }) => void,
    /**
     * Scope provenance from the authorization that just completed, for the callers that have
     * one. The default organization grant is created before OAuth has issued any credentials,
     * so without this the grants API reads back a shared identity whose scope has no source
     * and no over-grant warning — while the connection record carries both.
     *
     * Deliberately scope fields only. The shared grant takes its credential lifecycle from the
     * connection, and writing `accessTokenExpiresAt` here would make an expired connection
     * look fresh to the refresh-due check and skip the reconnect prompt.
     */
    oauthProvenance?: {
      scopes: string[];
      scopeSource: "provider" | "requested_fallback";
      unrequestedScopes: string[];
      requestedScopes: string[];
    },
  ) {
    const providerTenantWithOauth = (
      current: (typeof connectionGrants.$inferSelect)["providerTenant"],
    ) =>
      oauthProvenance
        ? {
            ...(current ?? {}),
            oauth: {
              ...(current?.oauth ?? {}),
              scopes: oauthProvenance.scopes,
              scopeSource: oauthProvenance.scopeSource,
              unrequestedScopes: oauthProvenance.unrequestedScopes,
              requestedScopes: oauthProvenance.requestedScopes,
            },
          }
        : current;
    const [existing] = await dbClient
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "organization"),
          eq(connectionGrants.isDefault, true),
        ),
      )
      .limit(1);
    if (existing) {
      // OAuth connections create their organization grant before the browser
      // callback has issued any credentials. Reconnects can rotate those
      // credentials later as well. Keep the execution grant synchronized with
      // the connection so the gateway projects the current secrets instead of
      // sending an unauthenticated request after an apparently successful
      // setup. Reconnecting is also the explicit recovery path for a revoked
      // shared identity, so it is correct to reactivate that default grant here.
      const [updated] = await dbClient
        .update(connectionGrants)
        .set({
          credentialSecretRefs: isRailwayConnection(connection)
            ? [...connection.credentialSecretRefs, ...existing.credentialSecretRefs.filter((ref) => ref.configPath === RAILWAY_SSH_SECRET_PATH && !connection.credentialSecretRefs.some((candidate) => candidate.configPath === ref.configPath))]
            : connection.credentialSecretRefs,
          ...(oauthProvenance
            ? { providerTenant: providerTenantWithOauth(existing.providerTenant) }
            : {}),
          status: "active",
          revokedAt: null,
          revokedByAgentId: null,
          revokedByUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(connectionGrants.id, existing.id))
        .returning();
      if (!updated)
        throw new Error("Failed to update default connection grant");
      onMutation?.({ previous: existing, current: updated });
      return updated;
    }
    const [created] = await dbClient
      .insert(connectionGrants)
      .values({
        companyId: connection.companyId,
        connectionId: connection.id,
        kind: "organization",
        credentialSecretRefs: connection.credentialSecretRefs,
        ...(oauthProvenance
          ? { providerTenant: providerTenantWithOauth(null) }
          : {}),
        status: "active",
        isDefault: true,
      })
      .returning();
    if (!created) throw new Error("Failed to create default connection grant");
    onMutation?.({ previous: null, current: created });
    return created;
  }

  /**
   * @param grantSecretRefs Secret refs held by a grant rather than the connection
   *   row. A personal credential lives only on its user grant (PAP-17835), so it
   *   would otherwise have no `company_secret_bindings` row and drop out of
   *   secret projection and removal teardown.
   */
  async function syncCredentialBindings(
    connection: typeof toolConnections.$inferSelect,
    grantSecretRefs: ToolCredentialSecretRef[] = [],
    dbClient: ToolAccessMutationDb = db,
  ) {
    await syncConnectionCredentialBindings(db, connection, grantSecretRefs, dbClient);
  }

  /**
   * Split the secrets a connection points at into the ones it owns outright and
   * the ones another consumer still depends on.
   *
   * Removing an app is a credential revocation boundary (PAP-17119), but it must
   * never destroy a secret the operator manages by hand or shares with another
   * target. Two independent tests have to agree before a secret is destroyed:
   *
   * 1. Provenance — the key sits in the `tool_app.` namespace only the
   *    connect/reconnect/OAuth paths mint, or its user-secret definition does.
   *    Personal definitions must also have no declarations on other targets.
   * 2. Exclusivity — nothing outside this connection references it: no
   *    `company_secret_bindings` row from another target, and no other
   *    connection or connection grant naming the same secret id.
   *
   * A secret failing either test is reported as retained; removal still drops
   * this connection's binding and ref, so the connection loses the credential
   * either way. Retaining a secret nobody can reach is a leak of an unused row;
   * deleting one another target still resolves is an outage, so the ambiguous
   * case fails towards retention.
   */
  async function classifyConnectionSecrets(
    connection: typeof toolConnections.$inferSelect,
    secretIds: string[],
  ): Promise<{ owned: string[]; retained: string[] }> {
    const unique = [
      ...new Set(
        secretIds.filter((id) => typeof id === "string" && id.length > 0),
      ),
    ];
    if (unique.length === 0) return { owned: [], retained: [] };

    const secretRows = await db
      .select({
        id: companySecrets.id,
        key: companySecrets.key,
        scope: companySecrets.scope,
        userSecretDefinitionId: companySecrets.userSecretDefinitionId,
      })
      .from(companySecrets)
      .where(
        and(
          eq(companySecrets.companyId, connection.companyId),
          inArray(companySecrets.id, unique),
        ),
      );
    const byId = new Map(secretRows.map((row) => [row.id, row]));

    const referencedElsewhere = await connectionSecretsUsedByOtherConsumers(db, unique);
    const foreignBindings = await db
      .select({ secretId: companySecretBindings.secretId })
      .from(companySecretBindings)
      .where(
        and(
          eq(companySecretBindings.companyId, connection.companyId),
          inArray(companySecretBindings.secretId, unique),
          sql`not (${companySecretBindings.targetType} = 'tool_connection' and ${companySecretBindings.targetId} = ${connection.id})`,
        ),
      );
    for (const row of foreignBindings) referencedElsewhere.add(row.secretId);

    // Bindings are the authority, but read the sibling refs too: a row written
    // before `syncCredentialBindings` existed — or by hand — can reference a
    // secret with no binding to prove it.
    const siblingConnections = await db
      .select({
        credentialRefs: toolConnections.credentialRefs,
        credentialSecretRefs: toolConnections.credentialSecretRefs,
      })
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.companyId, connection.companyId),
          ne(toolConnections.id, connection.id),
        ),
      );
    for (const row of siblingConnections) {
      for (const ref of row.credentialRefs ?? [])
        referencedElsewhere.add(ref.secretId);
      for (const ref of row.credentialSecretRefs ?? [])
        referencedElsewhere.add(ref.secretId);
    }
    const siblingGrants = await db
      .select({ credentialSecretRefs: connectionGrants.credentialSecretRefs })
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          ne(connectionGrants.connectionId, connection.id),
        ),
      );
    for (const row of siblingGrants) {
      for (const ref of row.credentialSecretRefs ?? [])
        referencedElsewhere.add(ref.secretId);
    }

    const definitionIds = secretRows.flatMap((row) => row.userSecretDefinitionId ? [row.userSecretDefinitionId] : []);
    const definitions = definitionIds.length ? await db.select().from(userSecretDefinitions)
      .where(and(eq(userSecretDefinitions.companyId, connection.companyId), inArray(userSecretDefinitions.id, definitionIds))) : [];
    const dedicatedDefinitions = new Set(definitions.filter((row) => row.key.startsWith(CONNECTION_OWNED_SECRET_KEY_PREFIX) || row.key.startsWith(`tool_oauth.${connection.id}.`)).map((row) => row.id));
    const foreignDeclarations = definitionIds.length ? await db.select().from(userSecretDeclarations).where(and(
      inArray(userSecretDeclarations.userSecretDefinitionId, definitionIds),
      sql`not (${userSecretDeclarations.targetType} = 'tool_connection' and ${userSecretDeclarations.targetId} = ${connection.id})`,
    )) : [];
    const sharedDefinitions = new Set(foreignDeclarations.map((row) => row.userSecretDefinitionId));
    const owned: string[] = [];
    const retained: string[] = [];
    for (const secretId of unique) {
      const row = byId.get(secretId);
      // No row means an earlier pass of this same removal already deleted it.
      // Hand it back as owned so a retry re-runs the (idempotent) revocation
      // instead of reporting a credential this connection never shared.
      if (!row) {
        owned.push(secretId);
        continue;
      }
      const dedicated = row.scope === "user" && row.userSecretDefinitionId
        ? dedicatedDefinitions.has(row.userSecretDefinitionId) && !sharedDefinitions.has(row.userSecretDefinitionId)
        : row.scope === "company" && row.userSecretDefinitionId === null
          && row.key.startsWith(CONNECTION_OWNED_SECRET_KEY_PREFIX);
      if (dedicated && !referencedElsewhere.has(secretId)) owned.push(secretId);
      else retained.push(secretId);
    }
    return { owned, retained };
  }

  /**
   * Remove an app: a credential-revoking teardown, not a status flip (PAP-17119).
   *
   * Order is the security property. Every database-side access path closes
   * first — grants, installs, the app-managed profile, gateway tokens minted
   * against it, outstanding OAuth state, the catalog, and the connection itself
   * — so the app is already undispatchable before the first call out to a secret
   * provider. Secret revocation runs last, and each secret's ref survives until
   * that secret is gone, so a provider that errors leaves the operation failed
   * closed and resumable: the credential is already unresolvable (its row is
   * marked deleted first), and retrying the same removal finishes the job.
   *
   * What stays behind is deliberate: the connection and application rows, their
   * ids, names and activity keep working so a later reconnect reuses the same
   * identity — but with no credential, no install and no profile, so
   * reconnecting has to ask for fresh authentication and rebuild access.
   */
  async function removeConnection(
    connectionId: string,
    companyId?: string,
    actor?: ActorInfo,
  ): Promise<ToolConnectionRemovalResult> {
    const connection = await getConnectionRow(connectionId, companyId);
    const [endpoint] = await db.select().from(chatEndpoints).where(and(eq(chatEndpoints.connectionId, connection.id), eq(chatEndpoints.companyId, connection.companyId), eq(chatEndpoints.provider, "slack")));
    if (!endpoint) return removeConnectionUnlocked(connectionId, companyId, actor);
    return chatCredentialMutationLease(db)(endpoint, async lease => {
      await db.transaction(async tx => {
        await lease.assertOwned(tx);
        await tx.update(chatEndpoints).set({ status: "archived", updatedAt: new Date() }).where(eq(chatEndpoints.id, endpoint.id));
        await tx.update(toolConnections).set({ status: "archived", enabled: false, updatedAt: new Date() }).where(eq(toolConnections.id, connection.id));
      });
      await removeSlackRegistration(db, endpoint.id, lease);
      return removeConnectionUnlocked(connectionId, companyId, actor);
    });
  }

  async function removeConnectionUnlocked(connectionId: string, companyId?: string, actor?: ActorInfo): Promise<ToolConnectionRemovalResult> {
    const connection = await getConnectionRow(connectionId, companyId);
    forgetMcpHttpSessions(connection.id);
    const now = new Date();
    const binding = actorBinding(actor);

    // Grants are read before they are revoked: a retried removal must still see
    // the credential refs of a grant an earlier pass already marked revoked.
    const grantRows = await db
      .select({
        id: connectionGrants.id,
        status: connectionGrants.status,
        kind: connectionGrants.kind,
        subjectUserId: connectionGrants.subjectUserId,
        credentialSecretRefs: connectionGrants.credentialSecretRefs,
        externalCredential: connectionGrants.externalCredential,
      })
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
        ),
      );
    const grantsToRevoke = grantRows.filter((row) => row.status !== "revoked");
    if (grantsToRevoke.length > 0) {
      await db
        .update(connectionGrants)
        .set({
          status: "revoked",
          isDefault: false,
          revokedAt: now,
          revokedByAgentId:
            binding.actorType === "agent" ? binding.actorId : null,
          revokedByUserId:
            binding.actorType === "user" ? binding.actorId : null,
          updatedAt: now,
        })
        .where(
          inArray(
            connectionGrants.id,
            grantsToRevoke.map((row) => row.id),
          ),
        );
    }
    let externalCredentialCleanup: ToolConnectionRemovalSummary["externalCredentialCleanup"] =
      null;
    if (
      connection.credentialSource === "vercel_connect" &&
      connection.externalCredential
    ) {
      let attempted = 0;
      let revoked = 0;
      let failures = 0;
      let appSubjectCleanup: "not_applicable" | "manage_in_vercel" =
        "not_applicable";
      for (const grant of grantRows) {
        const request = vercelTokenRequest({
          credential: connection.externalCredential,
          grant,
          connectionId: connection.id,
          companyId: connection.companyId,
          resources: vercelConnectResourcesFor(connection),
        });
        vercelConnect?.evict(request);
        if (grant.externalCredential?.subjectType === "app") {
          appSubjectCleanup = "manage_in_vercel";
          continue;
        }
        if (grant.externalCredential?.subjectType !== "user") continue;
        attempted += 1;
        try {
          if (!vercelConnect) throw new Error("Vercel Connect unavailable");
          await vercelConnect.revoke(request);
          revoked += 1;
        } catch {
          failures += 1;
        }
      }
      externalCredentialCleanup = {
        provider: "vercel_connect",
        userSubjectsAttempted: attempted,
        userSubjectsRevoked: revoked,
        userSubjectFailures: failures,
        appSubjectCleanup,
        manageUrl: vercelConnectIntegrationStatus().manageUrl,
      };
    }

    // Bindings are how a credential reaches a runtime, so they go before the
    // provider round-trip rather than after it. They are also not needed to
    // finish the job: the refs on the connection row are what a resumed removal
    // reads to find the secrets it still owes a revocation.
    const removedSecretBindings = await db
      .delete(companySecretBindings)
      .where(
        and(
          eq(companySecretBindings.companyId, connection.companyId),
          eq(companySecretBindings.targetType, "tool_connection"),
          eq(companySecretBindings.targetId, connection.id),
        ),
      )
      .returning({ id: companySecretBindings.id });

    const removedInstalls = await db
      .delete(toolConnectionInstalls)
      .where(
        and(
          eq(toolConnectionInstalls.companyId, connection.companyId),
          eq(toolConnectionInstalls.connectionId, connection.id),
        ),
      )
      .returning({ id: toolConnectionInstalls.id });

    // The app-managed profile exists only to carry this connection's action
    // selection, so it goes with the connection. Operator-authored profiles that
    // happen to mention the connection are left alone — the archived connection
    // is denied by the policy engine regardless.
    const [appProfile] = await db
      .select({ id: toolProfiles.id })
      .from(toolProfiles)
      .where(
        and(
          eq(toolProfiles.companyId, connection.companyId),
          eq(toolProfiles.profileKey, `app:${connection.id}`),
        ),
      )
      .limit(1);
    let appProfileOutcome: ToolConnectionRemovalSummary["appProfile"] =
      "absent";
    let appProfileEntriesRemoved = 0;
    let appProfileBindingsRemoved = 0;
    let gatewayTokensRevoked = 0;
    let gatewaySessionsRevoked = 0;
    if (appProfile) {
      appProfileEntriesRemoved = await db.transaction(async tx => {
        await tx.select({ id: toolProfiles.id }).from(toolProfiles)
          .where(and(eq(toolProfiles.companyId, connection.companyId), eq(toolProfiles.id, appProfile.id)))
          .for("no key update");
        return (await tx.delete(toolProfileEntries)
          .where(and(eq(toolProfileEntries.companyId, connection.companyId), eq(toolProfileEntries.profileId, appProfile.id)))
          .returning({ id: toolProfileEntries.id })).length;
      });
      appProfileBindingsRemoved = (
        await db
          .delete(toolProfileBindings)
          .where(
            and(
              eq(toolProfileBindings.companyId, connection.companyId),
              eq(toolProfileBindings.profileId, appProfile.id),
            ),
          )
          .returning({ id: toolProfileBindings.id })
      ).length;

      const gatewayRows = await db
        .select({ id: toolMcpGateways.id })
        .from(toolMcpGateways)
        .where(
          and(
            eq(toolMcpGateways.companyId, connection.companyId),
            eq(toolMcpGateways.profileId, appProfile.id),
          ),
        );
      if (gatewayRows.length === 0) {
        await db.delete(toolProfiles).where(eq(toolProfiles.id, appProfile.id));
        appProfileOutcome = "deleted";
      } else {
        // `tool_mcp_gateways.profile_id` is ON DELETE RESTRICT, so a gateway
        // pointing here keeps the row alive. Archive it instead — the policy
        // engine only consults `active` profiles, and it has no entries left —
        // and revoke the tokens those gateways already handed out, which are the
        // one credential a caller could still present.
        await db
          .update(toolProfiles)
          .set({ status: "archived", defaultAction: "deny", updatedAt: now })
          .where(eq(toolProfiles.id, appProfile.id));
        appProfileOutcome = "archived";
        const revokedTokens = await db
          .update(toolMcpGatewayTokens)
          .set({ revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(toolMcpGatewayTokens.companyId, connection.companyId),
              inArray(
                toolMcpGatewayTokens.gatewayId,
                gatewayRows.map((row) => row.id),
              ),
              isNull(toolMcpGatewayTokens.revokedAt),
            ),
          )
          .returning({ id: toolMcpGatewayTokens.id });
        gatewayTokensRevoked = revokedTokens.length;
        if (revokedTokens.length > 0) {
          gatewaySessionsRevoked = (
            await db
              .update(toolGatewaySessions)
              .set({ revokedAt: now, updatedAt: now })
              .where(
                and(
                  eq(toolGatewaySessions.companyId, connection.companyId),
                  inArray(
                    toolGatewaySessions.gatewayTokenId,
                    revokedTokens.map((row) => row.id),
                  ),
                  isNull(toolGatewaySessions.revokedAt),
                ),
              )
              .returning({ id: toolGatewaySessions.id })
          ).length;
        }
      }
    }

    // A local runtime already holds the injected credential inside a live child
    // process, so archiving rows is not enough — the process itself is an access
    // path. Stopping is best effort on purpose: if the supervisor cannot be
    // reached, revoking the credential anyway (so nothing can start again) beats
    // abandoning the teardown, and the warning says which slot was left running.
    let runtimeSlotsStopped = 0;
    const runtimeSlotRows = await db
      .select({ id: toolRuntimeSlots.id, status: toolRuntimeSlots.status })
      .from(toolRuntimeSlots)
      .where(
        and(
          eq(toolRuntimeSlots.companyId, connection.companyId),
          eq(toolRuntimeSlots.connectionId, connection.id),
        ),
      );
    for (const slot of runtimeSlotRows) {
      if (slot.status === "stopped") continue;
      try {
        await runtimeSupervisor.stopSlot({
          companyId: connection.companyId,
          slotId: slot.id,
          reason: "connection_removed",
        });
        runtimeSlotsStopped += 1;
      } catch (error) {
        logger.warn(
          {
            err: error,
            companyId: connection.companyId,
            connectionId: connection.id,
            slotId: slot.id,
          },
          "tool connection removal could not stop a runtime slot",
        );
      }
    }

    // The catalog stays as history, but `removed` is the status that stops a
    // standing trust rule from auto-allowing one of these actions again.
    const removedCatalogEntries = await db
      .update(toolCatalogEntries)
      .set({ status: "removed", updatedAt: now })
      .where(
        and(
          eq(toolCatalogEntries.companyId, connection.companyId),
          eq(toolCatalogEntries.connectionId, connection.id),
          ne(toolCatalogEntries.status, "removed"),
        ),
      )
      .returning({ id: toolCatalogEntries.id });

    // An authorization already in flight would otherwise come back and mint a
    // fresh token for an app the operator just removed.
    const discardedOAuthStates = await db
      .delete(toolOauthStates)
      .where(
        and(
          eq(toolOauthStates.companyId, connection.companyId),
          eq(toolOauthStates.connectionId, connection.id),
        ),
      )
      .returning({ state: toolOauthStates.state });

    // Token-derived material in the issuance ledger is not an access path —
    // nothing validates against it — but there is no reason to keep a hash of a
    // credential the operator asked us to revoke. Path, outcome, actor and time
    // stay, so the usage history survives.
    const clearedIssuanceHashes = await db
      .update(connectionTokenIssuances)
      .set({ tokenHash: null })
      .where(
        and(
          eq(connectionTokenIssuances.companyId, connection.companyId),
          eq(connectionTokenIssuances.connectionId, connection.id),
          sql`${connectionTokenIssuances.tokenHash} is not null`,
        ),
      )
      .returning({ id: connectionTokenIssuances.id });

    const archived = await db.transaction(async (tx) => {
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, connection.companyId)))
        .for("update");
      const [updatedConnection] = await tx
        .update(toolConnections)
        .set({ status: "archived", enabled: false, updatedAt: now })
        .where(eq(toolConnections.id, connection.id))
        .returning();
      if (!updatedConnection) throw notFound("Tool connection not found");

      const remainingConnections = await tx
        .select({ id: toolConnections.id })
        .from(toolConnections)
        .where(
          and(
            eq(toolConnections.applicationId, updatedConnection.applicationId),
            ne(toolConnections.status, "archived"),
          ),
        )
        .limit(1);

      let applicationArchived = false;
      if (remainingConnections.length === 0) {
        const [application] = await tx
          .update(toolApplications)
          .set({ status: "archived", archivedAt: now, updatedAt: now })
          .where(
            and(
              eq(toolApplications.id, updatedConnection.applicationId),
              ne(toolApplications.status, "archived"),
            ),
          )
          .returning({ id: toolApplications.id });
        applicationArchived = Boolean(application);
      }

      return { connection: updatedConnection, applicationArchived };
    });
    emitConnectionUpdated(archived.connection, connection, "archive");

    // Hosted work needs its credential to stop. Agent/viewer access is already
    // revoked above; retain cleanup authority until provider shutdown confirms.
    if (isBrowserUseConnection(connection)) {
      await browserUseService(db, options.remoteHttpRequest).stopBeforeCredentialRemoval(connection.companyId, connection.id);
    }

    // Only now, with every access path closed, revoke the credentials. Each
    // `secrets.remove` marks the row deleted before it calls the provider, so a
    // provider error leaves an unresolvable secret and a resumable removal
    // rather than a half-open app.
    const candidateSecretIds = [
      ...Object.values(asRecord(connection.config.aggregatorDiscovery)).flatMap(value => typeof asRecord(value).secretId === "string" ? [asRecord(value).secretId as string] : []),
      ...connection.credentialRefs.map((ref) => ref.secretId),
      ...connection.credentialSecretRefs.map((ref) => ref.secretId),
      ...grantRows.flatMap((grant) =>
        (grant.credentialSecretRefs ?? []).map((ref) => ref.secretId),
      ),
    ];
    const { owned, retained } = await classifyConnectionSecrets(
      connection,
      candidateSecretIds,
    );
    let secretsRevoked = 0;
    for (const secretId of owned) {
      const removed = await secrets.remove(secretId);
      if (removed) secretsRevoked += 1;
    }

    const credentialRefsCleared =
      connection.credentialRefs.length + connection.credentialSecretRefs.length;
    const [cleared] = await db
      .update(toolConnections)
      .set({
        credentialRefs: [],
        credentialSecretRefs: [],
        config: withoutInlineOAuthTokens(connection.config),
        transportConfig: withoutInlineOAuthTokens(connection.transportConfig),
        updatedAt: now,
      })
      .where(eq(toolConnections.id, connection.id))
      .returning();
    if (
      grantRows.some((grant) => (grant.credentialSecretRefs ?? []).length > 0)
    ) {
      await db
        .update(connectionGrants)
        .set({ credentialSecretRefs: [], updatedAt: now })
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
          ),
        );
    }

    return {
      connection: toConnection(cleared ?? archived.connection),
      removal: {
        secretsRevoked,
        secretsRetainedShared: retained.length,
        credentialRefsCleared,
        secretBindingsRemoved: removedSecretBindings.length,
        grantsRevoked: grantsToRevoke.length,
        installsRemoved: removedInstalls.length,
        appProfile: appProfileOutcome,
        appProfileEntriesRemoved,
        appProfileBindingsRemoved,
        catalogEntriesMarkedRemoved: removedCatalogEntries.length,
        oauthStatesDiscarded: discardedOAuthStates.length,
        tokenIssuanceHashesCleared: clearedIssuanceHashes.length,
        runtimeSlotsStopped,
        gatewayTokensRevoked,
        gatewaySessionsRevoked,
        applicationArchived: archived.applicationArchived,
        externalCredentialCleanup,
      },
    };
  }

  async function ensureRuntimeSlot(
    connection: typeof toolConnections.$inferSelect,
  ): Promise<ToolRuntimeSlot | null> {
    if (connection.transport !== "local_stdio" || connection.config.templateId === "paperclip.cognee-cloud") return null;
    const slotKey = `mcp:${connection.companyId}:${connection.id}`;
    const [existing] = await db
      .select()
      .from(toolRuntimeSlots)
      .where(
        and(
          eq(toolRuntimeSlots.companyId, connection.companyId),
          eq(toolRuntimeSlots.slotKey, slotKey),
        ),
      );
    if (existing) return toRuntimeSlot(existing);
    const [created] = await db
      .insert(toolRuntimeSlots)
      .values({
        companyId: connection.companyId,
        applicationId: connection.applicationId,
        connectionId: connection.id,
        slotKey,
        ownerScopeType: "connection",
        ownerScopeId: connection.id,
        runtimeKind: "local_stdio",
        status: "stopped",
        provider: "paperclip",
        providerRef: `template:${String(connection.config.templateId)}`,
        commandTemplateKey: String(connection.config.templateId),
        healthStatus: "unchecked",
        metadata: { templateId: connection.config.templateId },
      })
      .returning();
    return toRuntimeSlot(created);
  }

  async function vaultGrantForConnection(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
  ): Promise<typeof connectionGrants.$inferSelect | null> {
    const actorUserId =
      actor?.actorType === "user" ? (actor.actorId ?? null) : null;
    if (actorUserId) {
      const [personal] = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, "user"),
            eq(connectionGrants.subjectUserId, actorUserId),
          ),
        )
        .limit(1);
      if (personal) {
        if (personal.status !== "active") {
          throw unprocessable("OAuth authorization must be reconnected", {
            code: "oauth_reauthorization_required",
            setupUrl: connectionSetupUrl(connection),
            reconnectUrl: connectionReconnectUrl(connection),
          });
        }
        return personal;
      }
    }
    if (!actorUserId && connection.credentialPolicy === "per_user") {
      // A personal-only connection is intentionally fixed to one identity.
      // Background health/catalog checks have no acting user, but may safely
      // exercise that sole owner-bound grant without turning it into a shared
      // credential or making it available to a different caller.
      const personalGrants = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, "user"),
            eq(connectionGrants.status, "active"),
          ),
        )
        .limit(2);
      if (personalGrants.length === 1) return personalGrants[0]!;
    }
    if (connection.credentialPolicy === "per_user") {
      throw unprocessable(
        "This connection needs the current user's authorization",
        {
          code: "user_authorization_required",
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
        },
      );
    }
    const [organization] = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "organization"),
          eq(connectionGrants.isDefault, true),
        ),
      )
      .limit(1);
    if (organization?.status === "active") return organization;
    return null;
  }

  async function resolveCredentialHeaders(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
    options: { forceRefresh?: boolean } = {},
  ): Promise<Record<string, string>> {
    if (connection.credentialSource === "vercel_connect") {
      const grant = await vercelGrantForConnection(connection, actor);
      return resolveVercelCredentialHeaders(connection, grant, options);
    }
    let grant: typeof connectionGrants.$inferSelect | null = null;
    try {
      if (
        connection.authKind === "oauth" ||
        connection.credentialPolicy !== "shared"
      ) {
        grant = await vaultGrantForConnection(connection, actor);
      }
      if (connection.authKind === "oauth" && grant) {
        grant = await refreshOAuthGrantCredentials({
          companyId: connection.companyId,
          connectionId: connection.id,
          grantId: grant.id,
          forceRefresh: options.forceRefresh,
          actor,
        });
      } else {
        connection = await maybeRefreshOAuthCredentials(connection, actor);
      }
    } catch (error) {
      const scope = credentialScope(connection);
      await audit({
        companyId: connection.companyId,
        connectionId: connection.id,
        action: "tool_connection.credential_resolution",
        outcome: "failure",
        reasonCode:
          error instanceof HttpError
            ? String(asRecord(error.details).code ?? "oauth_refresh_failed")
            : "oauth_refresh_failed",
        details: {
          credentialCount: connection.credentialRefs.length,
          credentialSecretRefCount: connection.credentialSecretRefs.length,
          credentialScopeType: scope.type,
          credentialScopeHash: scope.hash,
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
        },
      });
      throw error;
    }
    const headers: Record<string, string> = {};
    const scope = credentialScope(connection);
    for (const ref of connection.credentialRefs) {
      if (ref.placement !== "header") continue;
      let value: string;
      const configPath = credentialRefConfigPath(ref);
      try {
        const grantRef = grant ? connectionGrantCredentialRef(grant, ref) : undefined;
        if (grant && !grantRef) throw unprocessable("Your credential is missing. Reconnect this connection.", {
          code: "grant_credential_invalid", connectionId: connection.id, grantId: grant.id, credential: configPath,
        });
        value =
          grantRef && grant
            ? (
                await resolveOAuthGrantSecret(
                  connection,
                  grant,
                  grantRef,
                  actor,
                  undefined,
                )
              ).value
            : await secrets.resolveSecretValue(
                connection.companyId,
                ref.secretId,
                ref.version ?? "latest",
                {
                  consumerType: "tool_connection",
                  consumerId: connection.id,
                  configPath,
                  actorType: "system",
                },
              );
      } catch (error) {
        await audit({
          companyId: connection.companyId,
          connectionId: connection.id,
          action: "tool_connection.credential_resolution",
          outcome: "failure",
          reasonCode:
            error instanceof HttpError
              ? String(
                  asRecord(error.details).code ?? "secret_resolution_failed",
                )
              : "secret_resolution_failed",
          details: {
            credentialCount: connection.credentialRefs.length,
            credentialScopeType: scope.type,
            credentialScopeHash: scope.hash,
          },
        });
        throw error;
      }
      if (ref.placement === "header") {
        headers[ref.key] = `${ref.prefix ?? ""}${value}`;
      }
    }
    const oauthAccessRef = grant?.credentialSecretRefs.find(
      (ref) => ref.configPath === "oauth.access_token",
    );
    if (oauthAccessRef && headers.Authorization === undefined) {
      headers.Authorization = `Bearer ${
        (
          await resolveOAuthGrantSecret(
            connection,
            grant!,
            oauthAccessRef,
            actor,
            undefined,
          )
        ).value
      }`;
    }
    if (
      connection.credentialRefs.length > 0 ||
      connection.credentialSecretRefs.length > 0 ||
      Object.keys(oauthConfig(connection)).length > 0
    ) {
      await audit({
        companyId: connection.companyId,
        connectionId: connection.id,
        action: "tool_connection.credential_resolution",
        outcome: "success",
        details: {
          credentialCount: connection.credentialRefs.length,
          credentialSecretRefCount: connection.credentialSecretRefs.length,
          credentialScopeType: scope.type,
          credentialScopeHash: scope.hash,
        },
      });
    }
    return headers;
  }

  async function remoteTools(
    connection: typeof toolConnections.$inferSelect,
    credentialHeaders?: Record<string, string>,
    actor?: ActorInfo,
    workspaceEndpoint?: string,
    unavailableServices: string[] = [],
  ): Promise<McpToolDescriptor[]> {
    assertSupportedConnection(connection);
    await assertConnectorConnectionSetupEnabled(connection);
    let headers = credentialHeaders ?? {
      ...projectedConnectionHeaders(connection),
      ...(await resolveCredentialHeaders(connection, actor)),
    };
    if (connection.config.sourceTemplateKey === "google-workspace" && !workspaceEndpoint) {
      const grant = await vaultGrantForConnection(connection, actor);
      const scopes = googleWorkspaceGrantedScopes(grant);
      const services = (Object.keys(GOOGLE_WORKSPACE_SERVICES) as GoogleWorkspaceService[])
        .filter((service) => googleWorkspaceServiceGranted(service, scopes));
      // One credential authority, no child connections or implied service grants.
      const catalogs = await Promise.allSettled(services.map(async (service) => {
        const profile = GOOGLE_WORKSPACE_CONNECTOR_PROFILES[GOOGLE_WORKSPACE_SERVICES[service]];
        const tools = await remoteTools(connection, headers, actor, profile.serverUrl);
        return tools.map((tool) => ({ ...tool, name: googleWorkspaceToolName(service, tool.name) }))
          .filter((tool) => isGoogleWorkspaceToolGranted(tool.name, scopes));
      }));
      for (const [index, catalog] of catalogs.entries()) {
        if (catalog.status === "fulfilled") continue;
        const service = services[index]!;
        unavailableServices.push(service);
        await audit({ companyId: connection.companyId, connectionId: connection.id,
          action: "tool_connection.catalog_refresh", outcome: "failure", actor,
          reasonCode: "google_workspace_service_unavailable", details: { service } });
      }
      const currentGrant = await vaultGrantForConnection(connection, actor);
      if (!currentGrant) throw unprocessable("OAuth authorization must be reconnected", { code: "oauth_reauthorization_required" });
      if (catalogs.length > 0 && catalogs.every((catalog) => catalog.status === "rejected")) {
        throw new HttpError(502, `Google services unavailable: ${unavailableServices.join(", ")}. Retry refreshing actions.`,
          { code: "google_workspace_services_unavailable" });
      }
      // A service's authentication retry may have refreshed into a narrower
      // grant. Never publish actions using the pre-refresh permission snapshot.
      const currentScopes = googleWorkspaceGrantedScopes(currentGrant);
      return catalogs.flatMap((catalog) => catalog.status === "fulfilled" ? catalog.value : [])
        .filter((tool) => isGoogleWorkspaceToolGranted(tool.name, currentScopes));
    }
    const endpoint = workspaceEndpoint ?? await resolvedRemoteEndpoint(connection, actor);
    // Pinned to the address the guard approved: `config.url` is operator-supplied,
    // so a second DNS resolution here would reopen the rebinding window that
    // PAP-17098 closed for the OAuth endpoints.
    let listRequestId = "paperclip-catalog-refresh";
    let sessionHeaders = headers;
    const sendRemote = (init: RequestInit) => withMcpConnectionFailure(() => requestRemoteHttpEndpoint(new URL(endpoint), init));
    const sendToolsList = (requestHeaders: Record<string, string>, cursor?: string) => {
      sessionHeaders = requestHeaders;
      return sendRemote({ method: "POST", headers: mcpHttpRequestHeaders(requestHeaders),
        body: JSON.stringify({ jsonrpc: "2.0", id: listRequestId, method: "tools/list", params: cursor ? { cursor } : {} }) });
    };
    const connectionConfig = asRecord(connection.config);
    const sourceTemplateKey = typeof connectionConfig?.sourceTemplateKey === "string"
      ? connectionConfig.sourceTemplateKey
      : null;
    const connectionMethodKey = typeof connectionConfig?.connectionMethodKey === "string"
      ? connectionConfig.connectionMethodKey
      : null;
    const curatedMethodRequiresMcpSession = Boolean(
      sourceTemplateKey && connectionMethodKey &&
      getConnectableAppDefinition(sourceTemplateKey)?.methods.some((method) =>
        method.key === connectionMethodKey && method.defaults?.mcpSessionRequired === true
      ),
    );
    let usedInitializedSession = connectionConfig?.mcpSessionRequired === true || curatedMethodRequiresMcpSession;
    let response: Response;
    if (usedInitializedSession) {
      try {
        sessionHeaders = await getMcpHttpSession({ send: sendRemote, headers,
          scope: `${connection.id}:catalog:${actor?.actorType}:${actor?.actorId}:${endpoint}`,
          requestId: listRequestId });
        response = await sendToolsList(sessionHeaders);
      } catch (error) {
        if (!(error instanceof McpHttpInitializationError) || !error.response) throw error;
        response = error.response;
      }
    } else {
      response = await sendToolsList(headers);
      // `tools/list` is read-only, so a 400 can safely be retried after the MCP
      // initialize handshake. Stateful servers such as Supabase require the
      // returned Mcp-Session-Id on every non-initialization request.
      if (response.status === 400) {
        try {
          const sessionHeaders = await initializeMcpHttpSession({
            send: sendRemote,
            headers,
            requestId: "paperclip-catalog-refresh",
          });
          response = await sendToolsList(sessionHeaders);
          usedInitializedSession = response.ok;
        } catch {
          // Preserve the original HTTP failure below when this was not an MCP
          // session requirement after all.
        }
      }
    }
    if (response.status === 404 && new Headers(sessionHeaders).has("mcp-session-id")) {
      // MCP uses 404 for an expired server session. Discovery is read-only, so
      // discard the stale session and retry it once with a new handshake.
      forgetMcpHttpSessions(connection.id);
      await response.body?.cancel().catch(() => undefined);
      sessionHeaders = await getMcpHttpSession({ send: sendRemote, headers,
        scope: `${connection.id}:catalog:${actor?.actorType}:${actor?.actorId}:${endpoint}`,
        requestId: listRequestId });
      response = await sendToolsList(sessionHeaders);
      if (response.status === 404) forgetMcpHttpSessions(connection.id);
    }
    if (
      usedInitializedSession &&
      connectionConfig?.mcpSessionRequired !== true
    ) {
      const nextConfig = { ...connection.config, mcpSessionRequired: true };
      await db
        .update(toolConnections)
        .set({
          config: nextConfig,
          transportConfig: nextConfig,
          updatedAt: now(),
        })
        .where(
          and(
            eq(toolConnections.id, connection.id),
            eq(toolConnections.companyId, connection.companyId),
          ),
        );
    }
    if (isInsufficientConnectionScope(response)) {
      await response.body?.cancel().catch(() => undefined);
      throw unprocessable(INSUFFICIENT_CONNECTION_SCOPE_MESSAGE, { code: "oauth_insufficient_scope", connectionId: connection.id });
    }
    if (
      response.status === 401 &&
      connection.credentialSource === "vercel_connect"
    ) {
      const grant = await vercelGrantForConnection(connection, actor);
      const credential = vercelCredentialFor(connection);
      const request = vercelTokenRequest({
        credential,
        grant,
        connectionId: connection.id,
        companyId: connection.companyId,
        resources: vercelConnectResourcesFor(connection),
      });
      vercelConnect?.evict(request);
      headers = {
        ...projectedConnectionHeaders(connection),
        ...(await resolveVercelCredentialHeaders(connection, grant, {
          forceRefresh: true,
        })),
      };
      response = await sendToolsList(headers);
    }
    if (
      response.status === 401 &&
      connection.authKind === "oauth" &&
      connection.credentialSource === "paperclip_vault"
    ) {
      headers = {
        ...projectedConnectionHeaders(connection),
        ...(await resolveCredentialHeaders(connection, actor, {
          forceRefresh: true,
        })),
      };
      response = await sendToolsList(headers);
      if (
        response.status === 401 &&
        isPaperclipCloudConnectorStrategy(oauthConfig(connection).strategy)
      ) {
        const grant = await vaultGrantForConnection(connection, actor);
        if (grant) {
          await db
            .update(connectionGrants)
            .set({ status: "needs_reauthorization", updatedAt: now() })
            .where(
              and(
                eq(connectionGrants.id, grant.id),
                eq(connectionGrants.companyId, connection.companyId),
              ),
            );
        }
      }
    }
    if (!response.ok) {
      if ((response.status === 401 || response.status === 403)
        && connection.authKind === "api_key" && isMemoryConnectorId(connection.config.sourceTemplateKey)) {
        throw unprocessable("The provider rejected this API key. Check the key and its account access, then try again.", { code: "memory_api_key_rejected" });
      }
      if (await isSlackMcpAccessDisabledResponse(endpoint, response)) {
        throw unprocessable(
          "Slack MCP access is disabled for this app. Ask the Slack app owner to enable MCP access, then refresh this connection.",
          { code: "slack_mcp_access_disabled", setupUrl: connectionSetupUrl(connection) },
        );
      }
      const authenticate = response.headers.get("www-authenticate") ?? "";
      if (
        response.status === 401 &&
        /bearer|oauth|authorization/i.test(authenticate)
      ) {
        const endpoints = await discoverOAuthEndpoints(
          connection,
          authenticate,
        );
        if (endpoints) {
          const nextConfig = {
            ...connection.config,
            oauth: {
              ...oauthConfig(connection),
              provider: endpoints.provider,
              authorizationUrl: endpoints.authorizationUrl,
              tokenUrl: endpoints.tokenUrl,
              registrationUrl: endpoints.registrationUrl ?? null,
              metadataUrl: endpoints.metadataUrl ?? null,
              scopes: endpoints.scopes,
              codeChallengeMethodsSupported:
                endpoints.codeChallengeMethodsSupported ?? [],
              tokenEndpointAuthMethodsSupported:
                endpoints.tokenEndpointAuthMethodsSupported ?? [],
              grantType: endpoints.grantType ?? "authorization_code",
              issuer: endpoints.issuer ?? null,
              resource: endpoints.resource ?? null,
              clientIdMetadataDocumentSupported:
                endpoints.clientIdMetadataDocumentSupported === true,
              discoveredAt: new Date().toISOString(),
            },
          };
          await db
            .update(toolConnections)
            .set({
              // Record the discovered auth kind now, so a URL-only connection that
              // is waiting on sign-in reads as OAuth everywhere rather than
              // falling back to `authKind: none` semantics.
              authKind: "oauth",
              config: nextConfig,
              transportConfig: nextConfig,
              updatedAt: new Date(),
            })
            .where(eq(toolConnections.id, connection.id));
        }
        throw unprocessable("This app needs you to sign in.", {
          code: "oauth_challenge",
          status: response.status,
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
          oauthSupported: Boolean(endpoints),
        });
      }
      throw mcpDiscoveryHttpFailure(response, `Remote app returned HTTP ${response.status}`);
    }
    const descriptors: McpToolDescriptor[] = [];
    const seenCursors = new Set<string>();
    for (let page = 0; ; page += 1) {
      const payload = await withMcpConnectionFailure(() => readMcpHttpResponse(response, listRequestId));
      const record = asRecord(payload);
      if (record.error) throw new HttpError(502, "Remote MCP tool discovery failed", { code: "mcp_catalog_error" });
      const result = asRecord(record.result);
      if (!Array.isArray(result.tools)) throw new HttpError(502, "Remote MCP returned an invalid tool catalog", { code: "mcp_catalog_invalid" });
      descriptors.push(...result.tools.map((tool) => normalizeToolDescriptor(tool)).filter((tool): tool is McpToolDescriptor => Boolean(tool)));
      const cursor = typeof result.nextCursor === "string" ? result.nextCursor : null;
      if (!cursor) break;
      if (seenCursors.has(cursor) || page >= 99 || descriptors.length > 20_000) throw new HttpError(502, "Remote MCP tool catalog pagination did not finish", { code: "mcp_catalog_pagination" });
      seenCursors.add(cursor);
      listRequestId = `paperclip-catalog-refresh-${page + 1}`;
      response = await sendToolsList(sessionHeaders, cursor);
      if (!response.ok) throw mcpDiscoveryHttpFailure(response, "Remote MCP catalog page could not be read");
    }
    if (!isRailwayConnection(connection)) return descriptors;
    if (descriptors.some((tool) => normalizeRailwayToolName(tool.name).startsWith(RAILWAY_TOOL_PREFIX))) {
      throw unprocessable("Railway advertised a reserved Paperclip action name. Refresh is blocked pending review.", { code: "railway_tool_name_collision" });
    }
    let apiStatus = "available";
    let apiMessage = "Direct Railway service, log, and deployment tools are available.";
    try {
      const railwayOptions = {
        authorization: headers.Authorization ?? "",
        request: (url: string, init: RequestInit) => requestRemoteHttpEndpoint(new URL(url), init),
        signal: AbortSignal.timeout(15_000),
      };
      const workspaceId = await discoverRailwayWorkspace(railwayOptions);
      await createRailwayClient(railwayOptions).probe(workspaceId);
    } catch (error) {
      apiStatus = "unavailable";
      apiMessage = error instanceof RailwayError ? error.message : "Railway API access could not be verified. Refresh actions or reconnect Railway.";
    }
    // API interoperability is verified with the actual credential; the presence
    // of an OAuth token alone never enables the additional capability surface.
    const nextConfig = { ...connection.config, railwayApiStatus: apiStatus, railwayApiMessage: apiMessage };
    await db.update(toolConnections).set({ config: nextConfig, transportConfig: nextConfig, updatedAt: now() }).where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, connection.companyId)));
    connection.config = nextConfig;
    connection.transportConfig = nextConfig;
    return apiStatus === "available" ? [...descriptors, ...RAILWAY_TOOLS] : descriptors;
  }

  async function validateCogneeConnection(connection: typeof toolConnections.$inferSelect, actor?: ActorInfo, probe = true) {
    if (connection.config.templateId !== "paperclip.cognee-cloud") return;
    const grant = await vaultGrantForConnection(connection, actor);
    const refs = grant?.credentialSecretRefs ?? connection.credentialSecretRefs;
    const values: Record<string, string> = {};
    for (const key of COGNEE_STDIO_TEMPLATE.envKeys) {
      const ref = refs.find((candidate) => candidate.configPath === `env.${key}`);
      if (!ref) throw unprocessable("Reconnect Cognee to restore its Cloud credentials", { code: "missing_secret" });
      values[key] = grant
        ? (await resolveOAuthGrantSecret(connection, grant, ref, actor, undefined)).value
        : await secrets.resolveSecretValue(connection.companyId, ref.secretId, ref.versionSelector ?? "latest", {
            consumerType: "tool_connection", consumerId: connection.id, configPath: ref.configPath,
            actorType: "system", actorId: null,
          });
    }
    let base: URL;
    try { base = cogneeCloudUrl(values.COGNEE_BASE_URL!); }
    catch { throw badRequest("Copy the tenant API Base URL from Cognee’s API Keys page."); }
    // Scheduled health checks validate configuration and vault access. A transient
    // Cloud probe must not withdraw an already assigned local tool catalog.
    if (!probe) return;
    const response = await requestRemoteHttpEndpoint(new URL("/api/v1/datasets/", base), {
      method: "GET", headers: { "X-Api-Key": values.COGNEE_API_KEY! }, signal: AbortSignal.timeout(15_000),
    });
    await response.body?.cancel();
    if (!response.ok) throw unprocessable("Cognee Cloud could not verify access. Check the tenant URL, API key, and workspace subscription.", { code: "cognee_access_unverified" });
  }

  async function localTools(
    connection: typeof toolConnections.$inferSelect,
  ): Promise<McpToolDescriptor[]> {
    const template = await resolveStdioTemplate(
      connection.companyId,
      connection.config,
    );
    return template.tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? null,
      description: tool.description ?? null,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      annotations: tool.annotations ?? {},
    }));
  }

  function isAgentMailConnection(connection: typeof toolConnections.$inferSelect) {
    return connection.transport === "rest_api" && connection.config.provider === "agentmail";
  }

  async function validateAgentMailConnection(
    connection: typeof toolConnections.$inferSelect,
  ) {
    const configPath = connection.config.emailCredential
      ? "credentials.controlKey"
      : "credentials.apiKey";
    const ref = connection.credentialSecretRefs.find(
      (candidate) => candidate.configPath === configPath,
    );
    if (!ref) {
      throw unprocessable("Reconnect AgentMail to restore its API key", {
        code: "missing_secret",
      });
    }
    const key = await secrets.resolveSecretValue(
      connection.companyId,
      ref.secretId,
      ref.versionSelector ?? "latest",
      {
        consumerType: "tool_connection",
        consumerId: connection.id,
        configPath,
        actorType: "system",
        actorId: null,
      },
    );
    await agentmailApi(key).whoami();
  }

  function assertSupportedConnection(connection: typeof toolConnections.$inferSelect) {
    if (isRetiredComposioConnection(connection)) {
      throw unprocessable(RETIRED_COMPOSIO_MESSAGE, { code: "composio_broker_retired" });
    }
  }

  async function discoverTools(
    connection: typeof toolConnections.$inferSelect,
    credentialHeaders?: Record<string, string>,
    actor?: ActorInfo,
    unavailableServices: string[] = [],
  ): Promise<McpToolDescriptor[]> {
    assertSupportedConnection(connection);
    await assertConnectorConnectionSetupEnabled(connection);
    if (connection.connectionPurpose === "ai") throw unprocessable("AI connections provide runtime authentication, not tool actions");
    if (isDaytonaConnection(connection)) {
      const headers = credentialHeaders ?? await resolveCredentialHeaders(connection, actor);
      await daytonaClient(headers, (url, init) => requestRemoteHttpEndpoint(new URL(url), init), asRecord(connection.config.methodConfig).organizationId).probe();
      return DAYTONA_TOOLS;
    }
    if (isBrowserUseConnection(connection)) {
      const headers = credentialHeaders ?? await resolveCredentialHeaders(connection, actor);
      await browserUseClient(headers, (url, init) => requestRemoteHttpEndpoint(new URL(url), init), connection.id).probe();
      return BROWSER_USE_TOOLS;
    }
    if (isAgentMailConnection(connection)) {
      await validateAgentMailConnection(connection);
      return [];
    }
    if (connection.transport === "mcp_remote")
      return remoteTools(connection, credentialHeaders, actor, undefined, unavailableServices);
    if (connection.transport !== "local_stdio") {
      throw unsupportedToolConnectionTransport();
    }
    await resolveCredentialHeaders(connection);
    await validateCogneeConnection(connection, actor);
    return localTools(connection);
  }

  async function annotateAiGrantHealth(connections: ToolConnection[]) {
    const aiConnections = connections.filter(connection => connection.connectionPurpose === "ai");
    if (!aiConnections.length) return;
    const grants = await db.select({ connectionId: connectionGrants.connectionId, status: connectionGrants.status })
      .from(connectionGrants).where(and(eq(connectionGrants.companyId, aiConnections[0].companyId),
        inArray(connectionGrants.connectionId, aiConnections.map(connection => connection.id))));
    for (const connection of aiConnections) {
      const identities = grants.filter(grant => grant.connectionId === connection.id);
      if (identities.length && identities.every(grant => grant.status === "revoked")) {
        connection.healthStatus = "missing_secret";
        connection.healthMessage = "This credential was revoked. Reconnect the account to restore access.";
        connection.requiresReauthorization = true;
      }
    }
  }

  async function annotateGitHubAuthorization(
    connections: ToolConnection[],
    viewerUserId?: string,
  ) {
    const github = connections.filter(
      (connection) =>
        asRecord(connection.config).sourceTemplateKey === "github",
    );
    if (!github.length) return;
    const grants = await db
      .select({
        connectionId: connectionGrants.connectionId,
        status: connectionGrants.status,
        kind: connectionGrants.kind,
        subjectUserId: connectionGrants.subjectUserId,
      })
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, github[0].companyId),
          inArray(
            connectionGrants.connectionId,
            github.map((connection) => connection.id),
          ),
        ),
      );
    for (const connection of github) {
      const userId = viewerUserId ?? connection.createdByUserId;
      const eligible = grants.filter(
        (grant) =>
          grant.connectionId === connection.id &&
          (connection.credentialPolicy !== "per_user" ||
            (grant.kind === "user" && grant.subjectUserId === userId)),
      );
      connection.requiresReauthorization = !eligible.some(
        (grant) => grant.status === "active",
      );
    }
  }

  async function updateConnectionHealth(
    connection: typeof toolConnections.$inferSelect,
    status: ToolConnectionHealthStatus,
    message: string | null,
  ) {
    const now = new Date();
    const [updated] = await db
      .update(toolConnections)
      .set({
        healthStatus: status,
        healthMessage: message,
        healthCheckedAt: now,
        lastHealthAt: now,
        lastError: status === "ok" ? null : message,
        updatedAt: now,
      })
      .where(eq(toolConnections.id, connection.id))
      .returning();
    if (connection.transport === "local_stdio") {
      await db
        .update(toolRuntimeSlots)
        .set({
          healthStatus: status,
          healthMessage: message,
          lastHealthCheckAt: now,
          updatedAt: now,
        })
        .where(eq(toolRuntimeSlots.connectionId, connection.id));
    }
    return updated;
  }

  async function checkConnectionHealth(
    connectionId: string,
    actor?: ActorInfo,
    options: { allowUnauthenticatedProbe?: boolean } = {},
  ): Promise<ToolConnectionHealthCheckResult> {
    const connection = await getConnectionRow(connectionId);
    if (connection.connectionPurpose === "ai") return { connection: toConnection(connection), runtimeSlot: null };
    await assertConnectorConnectionSetupEnabled(connection);
    const unavailableServices: string[] = [];
    try {
      assertSupportedConnection(connection);
      const config = asRecord(connection.config);
      const oauth = asRecord(config.oauth);
      if (
        config.sourceTemplateKey === "github" &&
        oauth.connectorProfile === "github.code"
      ) {
        const activeGrants = await db
          .select()
          .from(connectionGrants)
          .where(
            and(
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
              eq(connectionGrants.status, "active"),
            ),
          );
        const actorGrant =
          actor?.actorType === "user"
            ? activeGrants.find(
                (grant) =>
                  grant.kind === "user" &&
                  grant.subjectUserId === actor.actorId,
              )
            : null;
        const grantsToCheck =
          connection.credentialPolicy === "per_user" &&
          actor?.actorType === "user"
            ? actorGrant
              ? [actorGrant]
              : []
            : actorGrant
              ? [actorGrant]
              : activeGrants;
        if (grantsToCheck.length === 0)
          throw unprocessable("GitHub authorization must be connected", {
            code: "oauth_reauthorization_required",
          });
        for (const grant of grantsToCheck)
          await refreshManagedGitHubGrantAccess(connection, grant, actor);
      } else if (isBrowserUseConnection(connection) || isDaytonaConnection(connection)) {
        await discoverTools(connection, undefined, actor);
      } else if (isAgentMailConnection(connection)) {
        await validateAgentMailConnection(connection);
      } else if (connection.transport === "mcp_remote") {
        const canProbeWithoutAuthorization =
          options.allowUnauthenticatedProbe === true &&
          connection.status === "draft" &&
          connection.authKind === "none" &&
          connection.credentialPolicy === "per_user" &&
          actor?.actorType === "user" &&
          actor.actorId === connection.createdByUserId;
        const credentialHeaders =
          connection.credentialSource === "vercel_connect"
            ? await resolveCredentialHeaders(connection, actor, {
                forceRefresh: true,
              })
            : canProbeWithoutAuthorization
              ? {}
              : undefined;
        await remoteTools(connection, credentialHeaders, actor, undefined, unavailableServices);
      } else if (connection.transport === "local_stdio") {
        await resolveCredentialHeaders(connection);
        await stdioTemplateId(connection.companyId, connection.config);
        await validateCogneeConnection(connection, actor, false);
      } else {
        throw unsupportedToolConnectionTransport();
      }
      const updated = await updateConnectionHealth(
        connection,
        "ok",
        unavailableServices.length > 0
          ? `Connected. Google services unavailable: ${unavailableServices.join(", ")}. Other services remain available; retry refreshing actions.`
          : config.sourceTemplateKey === "github" &&
          oauth.connectorProfile === "github.code"
          ? "GitHub account, installation, and repository access are available."
          : isDaytonaConnection(connection)
            ? "Daytona API access is connected."
          : isBrowserUseConnection(connection)
            ? "Browser Use API key is connected."
          : isAgentMailConnection(connection)
            ? "AgentMail API key is connected."
            : connection.transport === "local_stdio"
              ? "Approved stdio template is ready."
              : "Remote MCP server responded to tools/list.",
      );
      const runtimeSlot = await ensureRuntimeSlot(updated);
      await audit({
        companyId: connection.companyId,
        connectionId: connection.id,
        action: "tool_connection.health_check",
        outcome: "success",
        actor,
        details: { transport: connection.transport },
      });
      return { connection: toConnection(updated), runtimeSlot };
    } catch (error) {
      if (
        error instanceof HttpError &&
        asRecord(error.details).code === "github_access_changed"
      )
        throw error;
      const failure = sanitizeHttpFailure(error);
      const updated = await updateConnectionHealth(
        connection,
        failure.status,
        failure.message,
      );
      const runtimeSlot =
        connection.transport === "local_stdio"
          ? await ensureRuntimeSlot(updated)
          : null;
      await audit({
        companyId: connection.companyId,
        connectionId: connection.id,
        action: "tool_connection.health_check",
        outcome: "failure",
        reasonCode: failure.code,
        actor,
        details: { status: failure.status, transport: connection.transport },
      });
      throw retainMcpConnectionFailure(error, new HttpError(healthFailureHttpStatus(failure), failure.message, {
        code: failure.code,
        connection: toConnection(updated),
        runtimeSlot,
        setupUrl: connectionSetupUrl(connection),
        reconnectUrl: connectionReconnectUrl(connection),
      }));
    }
  }

  async function refreshCatalog(
    connectionId: string,
    actor?: ActorInfo,
    refreshOptions: {
      enableAllByDefault?: boolean;
      restoreDraftDefaults?: boolean;
      /** Keep first managed OAuth discovery quarantined without changing generic draft refresh semantics. */
      quarantineManagedOAuthDraft?: boolean;
      skipDefaultProfileSync?: boolean;
      credentialHeaders?: Record<string, string>;
    } = {},
  ): Promise<ToolCatalogRefreshResult> {
    const connection = await getConnectionRow(connectionId);
    if (connection.connectionPurpose === "ai") throw unprocessable("AI connections do not have a tool catalog");
    await assertConnectorConnectionSetupEnabled(connection);
    const refreshedAt = now();
    const unavailableServices: string[] = [];
    let descriptors: McpToolDescriptor[];
    try {
      descriptors = await discoverTools(
        connection,
        refreshOptions.credentialHeaders,
        actor,
        unavailableServices,
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        asRecord(error.details).code === "github_access_changed"
      )
        throw error;
      const failure = sanitizeHttpFailure(error);
      const updated = await updateConnectionHealth(
        connection,
        failure.status,
        failure.message,
      );
      await audit({
        companyId: connection.companyId,
        connectionId: connection.id,
        action: "tool_connection.catalog_refresh",
        outcome: "failure",
        reasonCode: failure.code,
        details: { status: failure.status },
        actor,
      });
      throw retainMcpConnectionFailure(error, new HttpError(healthFailureHttpStatus(failure), failure.message, {
        code: failure.code,
        setupUrl: connectionSetupUrl(connection),
        reconnectUrl: connectionReconnectUrl(connection),
      }));
    }

    const publish = <T>(write: (client: ToolAccessMutationDb) => Promise<T>): Promise<T> => db.transaction(async tx => {
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, connection.companyId)))
        .for("update");
      await tx.select({ id: toolConnections.id }).from(toolConnections)
        .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, connection.companyId)))
        .for("update");
      return write(tx);
    });
    descriptors = [...new Map(descriptors.map(descriptor => [descriptor.name, descriptor])).values()];
    const existingRows = await db
      .select()
      .from(toolCatalogEntries)
      .where(eq(toolCatalogEntries.connectionId, connection.id));
    const existingByName = new Map(
      existingRows.map((entry) => [entry.toolName, entry]),
    );
    const nativeDaytona = isDaytonaConnection(connection);
    if (connection.config.sourceTemplateKey === "google-workspace"
      || nativeDaytona || isRemoteMcpConnectorMethod(connection.config.sourceTemplateKey, connection.config.connectionMethodKey)) {
      const discoveredNames = new Set(descriptors.map((descriptor) => descriptor.name));
      // The catalog is shared, but discovery uses only the caller's grant. A
      // narrower personal consent must not remove actions another active grant
      // still supports. Never combine scopes from different grants into authority.
      let otherWorkspaceGrants: string[][] = [];
      let selectedWorkspaceScopes: string[] = [];
      if (connection.config.sourceTemplateKey === "google-workspace") {
        const selected = await vaultGrantForConnection(connection, actor);
        selectedWorkspaceScopes = googleWorkspaceGrantedScopes(selected);
        const grants = await db.select().from(connectionGrants).where(and(
          eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.status, "active"),
        ));
        otherWorkspaceGrants = grants.filter((grant) => grant.id !== selected?.id).map(googleWorkspaceGrantedScopes);
      }
      // Preserve only consent-filtered actions, not failed-service catalogs or
      // tools a successful, sufficiently authorized discovery actually removed.
      const removedStatus = nativeDaytona ? "removed" : "disabled";
      const removedIds = existingRows.filter((entry) => !discoveredNames.has(entry.toolName) && entry.status !== removedStatus
        && !(otherWorkspaceGrants.some((scopes) => isGoogleWorkspaceToolGranted(entry.toolName, scopes))
          && !isGoogleWorkspaceToolGranted(entry.toolName, selectedWorkspaceScopes)
          && !unavailableServices.includes(googleWorkspaceToolTarget(entry.toolName)?.service ?? ""))).map((entry) => entry.id);
      if (removedIds.length) await publish(tx => tx.update(toolCatalogEntries)
        .set({ status: removedStatus, quarantineReason: nativeDaytona ? "provider_tool_removed" : "mcp_tool_removed", updatedAt: refreshedAt })
        .where(and(eq(toolCatalogEntries.companyId, connection.companyId), eq(toolCatalogEntries.connectionId, connection.id), inArray(toolCatalogEntries.id, removedIds))));
    }
    // Retired native actions are absent from discovery, but old catalog rows
    // still need to show as disabled. Gateway denial also applies before refresh.
    const blockedRailwayEntryIds = isRailwayEndpoint(connection.config.url)
      ? existingRows.filter((entry) => isRailwayToolBlocked(entry.toolName)).map((entry) => entry.id)
      : [];
    if (blockedRailwayEntryIds.length > 0) {
      await publish(tx => tx.update(toolCatalogEntries).set({ status: "disabled", updatedAt: refreshedAt })
        .where(and(eq(toolCatalogEntries.connectionId, connection.id), inArray(toolCatalogEntries.id, blockedRailwayEntryIds))));
    }
    const catalogValues: Array<typeof toolCatalogEntries.$inferInsert> = [];
    let quarantinedCount = 0;
    const sourceTemplateKey =
      typeof asRecord(connection.config).sourceTemplateKey === "string"
        ? String(asRecord(connection.config).sourceTemplateKey)
        : null;
    const sourceApp = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    const sourceMethod = sourceApp
      ? connectionMethodForConnection(sourceApp, connection)
      : null;
    const sourceCapabilityKey = sourceMethod?.capabilityProfile?.key;
    const googleProfileValue =
      sourceMethod?.connectorProfile ??
      sourceApp?.methods.find(
        (candidate) =>
          candidate.connectorProfile &&
          candidate.capabilityProfile?.key === sourceCapabilityKey,
      )?.connectorProfile;
    const googleProfile =
      googleProfileValue &&
      isGoogleWorkspaceConnectorProfileId(googleProfileValue)
        ? googleProfileValue
        : null;
    const preserveReviewedCatalog =
      (isRailwayEndpoint(connection.config.url) || sourceTemplateKey === "enterpret" || isDaytonaConnection(connection)) &&
      existingRows.length > 0;
    const quarantineOnRefresh =
      (!refreshOptions.enableAllByDefault || preserveReviewedCatalog) &&
      shouldQuarantineNewEntries(connection) &&
      (connection.status === "active" ||
        preserveReviewedCatalog ||
        sourceTemplateKey === "posthog" ||
        refreshOptions.quarantineManagedOAuthDraft === true);
    const safeDefault = asRecord(connection.config).safeDefault === true;
    for (const descriptor of descriptors) {
      const riskLevel = classifyRisk(descriptor, isRailwayEndpoint(connection.config.url) ? "railway" : sourceTemplateKey);
      const hash = descriptorHash(descriptor, riskLevel);
      const schemaHash = stableHash(descriptor.inputSchema ?? {});
      const existing = existingByName.get(descriptor.name);
      const changed =
        existing &&
        (existing.versionHash !== hash || existing.schemaHash !== schemaHash);
      const shouldQuarantine =
        quarantineOnRefresh &&
        (!existing || changed) &&
        existing?.status !== "disabled" &&
        (!safeDefault || riskLevel !== "read" || nativeDaytona);
      const providerPermanentlyBlocked = Boolean(
        googleProfile &&
        !isGoogleWorkspaceToolAllowed(googleProfile, descriptor),
      ) || (isRailwayEndpoint(connection.config.url) && isRailwayToolBlocked(descriptor.name));
      const status = providerPermanentlyBlocked
        ? "disabled"
        : shouldQuarantine
          ? "quarantined"
          : existing?.status === "disabled" && existing.quarantineReason !== "mcp_tool_removed"
            ? "disabled"
            : quarantineOnRefresh && existing?.status === "quarantined"
              ? "quarantined"
              : "active";
      if (shouldQuarantine && !providerPermanentlyBlocked) quarantinedCount += 1;

      catalogValues.push({
        id: existing?.id, companyId: connection.companyId, applicationId: connection.applicationId,
        connectionId: connection.id, name: existing?.name ?? descriptor.name, toolName: descriptor.name, entryKind: "tool",
        title: descriptor.title ?? null, description: descriptor.description ?? null,
        inputSchema: descriptor.inputSchema ?? {}, annotations: descriptor.annotations ?? {}, riskLevel,
        isReadOnly: riskLevel === "read", isWrite: riskLevel === "write", isDestructive: riskLevel === "destructive",
        status, versionHash: hash, schemaHash, firstSeenAt: existing?.firstSeenAt ?? refreshedAt, lastSeenAt: refreshedAt,
        quarantinedAt: existing
          ? status === "quarantined" ? shouldQuarantine ? refreshedAt : existing.quarantinedAt : null
          : shouldQuarantine ? refreshedAt : null,
        quarantineReason: existing
          ? status === "quarantined" ? shouldQuarantine ? "pending_review" : existing.quarantineReason : null
          : shouldQuarantine ? "pending_review" : null,
        updatedAt: existing ? refreshedAt : new Date(),
      });
    }
    const catalogRows: Array<typeof toolCatalogEntries.$inferSelect> = [];
    const newCatalogEntryIds = new Set<string>();
    for (let index = 0; index < catalogValues.length; index += 500) {
      const chunk = catalogValues.slice(index, index + 500);
      catalogRows.push(...await publish(async tx => {
        const current = await tx.select({ name: toolCatalogEntries.name, status: toolCatalogEntries.status })
          .from(toolCatalogEntries).where(and(eq(toolCatalogEntries.connectionId, connection.id), inArray(toolCatalogEntries.name, chunk.map(entry => entry.name))));
        const existingNonQuarantinedNames = new Set(current.filter(entry => entry.status !== "quarantined").map(entry => entry.name));
        const rows = await tx.insert(toolCatalogEntries).values(chunk)
          .onConflictDoUpdate({ target: [toolCatalogEntries.connectionId, toolCatalogEntries.name], set: {
            title: sql`excluded.title`, description: sql`excluded.description`, inputSchema: sql`excluded.input_schema`,
            annotations: sql`excluded.annotations`, riskLevel: sql`excluded.risk_level`, isReadOnly: sql`excluded.is_read_only`,
            isWrite: sql`excluded.is_write`, isDestructive: sql`excluded.is_destructive`,
            status: sql`CASE WHEN ${toolCatalogEntries.status} = 'disabled' AND ${toolCatalogEntries.quarantineReason} IS DISTINCT FROM 'mcp_tool_removed' THEN 'disabled' ELSE excluded.status END`,
            versionHash: sql`excluded.version_hash`, schemaHash: sql`excluded.schema_hash`, lastSeenAt: sql`excluded.last_seen_at`,
            quarantinedAt: sql`excluded.quarantined_at`, quarantineReason: sql`excluded.quarantine_reason`, updatedAt: sql`excluded.updated_at`,
          } }).returning();
        for (const row of rows) if (!existingNonQuarantinedNames.has(row.name)) newCatalogEntryIds.add(row.id);
        return rows;
      }));
    }
    const catalogByName = new Map(catalogRows.map(row => [row.toolName, row]));
    const updatedEntries = descriptors.map(descriptor => toCatalogEntry(catalogByName.get(descriptor.name)!));

    const preserveQuarantine =
      isRailwayEndpoint(connection.config.url) || sourceTemplateKey === "enterpret" || isDaytonaConnection(connection);
    const normalizedConfig = preserveQuarantine
      ? { ...connection.config, quarantineNewEntries: true }
      : refreshOptions.enableAllByDefault
      ? { ...connection.config, quarantineNewEntries: false }
      : connection.config;
    const normalizedTransportConfig = preserveQuarantine
      ? { ...connection.transportConfig, quarantineNewEntries: true }
      : refreshOptions.enableAllByDefault
      ? { ...connection.transportConfig, quarantineNewEntries: false }
      : connection.transportConfig;
    const [updatedConnection] = await db
      .update(toolConnections)
      .set({
        config: normalizedConfig,
        transportConfig: normalizedTransportConfig,
        healthStatus: "ok",
        healthMessage: unavailableServices.length > 0
          ? `Actions refreshed. Google services unavailable: ${unavailableServices.join(", ")}. Other services remain available; retry refreshing actions.`
          : isAgentMailConnection(connection)
          ? "AgentMail API key is connected."
          : "Tool catalog refreshed.",
        healthCheckedAt: refreshedAt,
        lastHealthAt: refreshedAt,
        lastCatalogRefreshAt: refreshedAt,
        lastError: null,
        updatedAt: refreshedAt,
      })
      .where(eq(toolConnections.id, connection.id))
      .returning();

    if (connection.transport === "local_stdio") {
      await ensureRuntimeSlot(updatedConnection);
      await db
        .update(toolRuntimeSlots)
        .set({
          healthStatus: "ok",
          healthMessage: "Approved stdio template is ready.",
          lastHealthCheckAt: refreshedAt,
          updatedAt: refreshedAt,
        })
        .where(eq(toolRuntimeSlots.connectionId, connection.id));
    }

    const activeEntries = updatedEntries.filter(
      (entry) => entry.status === "active",
    );
    const preserveMcpAccess = connection.config.mcpPreserveAccess === true
      && isRemoteMcpConnectorMethod(connection.config.sourceTemplateKey, connection.config.connectionMethodKey);
    if (!refreshOptions.skipDefaultProfileSync || preserveMcpAccess) {
      await publish(tx => enableCatalogEntriesByDefault({
        connection: updatedConnection,
        // Discovery must not re-enable actions the operator turned Off,
        // including curated MCP connections during API-key replacement.
        newCatalogEntryIds: activeEntries
          .filter((entry) => newCatalogEntryIds.has(entry.id))
          .map((entry) => entry.id),
        activeCatalogEntryIds: activeEntries.map((entry) => entry.id),
        restoreDraftDefaults: refreshOptions.restoreDraftDefaults || preserveMcpAccess,
        actor,
      }, tx));
    }
    await audit({
      companyId: connection.companyId,
      connectionId: connection.id,
      action: "tool_connection.catalog_refresh",
      outcome: "success",
      details: { discoveredCount: descriptors.length, quarantinedCount },
      actor,
    });

    return {
      connection: toConnection(updatedConnection),
      catalog: updatedEntries,
      discoveredCount: descriptors.length,
      quarantinedCount,
    };
  }

  async function listAppsNeedingAttention(
    companyId: string,
  ): Promise<ToolAppsAttentionResponse> {
    const generatedAt = now();
    const [
      connections,
      quarantinedEntries,
      pendingActionRequests,
      invocations,
      profiles,
      profileEntries,
      activeCatalog,
    ] = await Promise.all([
      db
        .select()
        .from(toolConnections)
        .where(
          and(
            eq(toolConnections.companyId, companyId),
            ne(toolConnections.status, "archived"),
          ),
        ),
      db
        .select({ connectionId: toolCatalogEntries.connectionId })
        .from(toolCatalogEntries)
        .where(
          and(
            eq(toolCatalogEntries.companyId, companyId),
            eq(toolCatalogEntries.status, "quarantined"),
          ),
        ),
      db
        .select({ invocationId: toolActionRequests.invocationId })
        .from(toolActionRequests)
        .where(
          and(
            eq(toolActionRequests.companyId, companyId),
            eq(toolActionRequests.status, "pending"),
            isNotNull(toolActionRequests.signedArguments),
          ),
        ),
      db
        .select({ id: toolInvocations.id, connectionId: toolInvocations.connectionId })
        .from(toolInvocations)
        .where(eq(toolInvocations.companyId, companyId)),
      db
        .select()
        .from(toolProfiles)
        .where(eq(toolProfiles.companyId, companyId)),
      db
        .select()
        .from(toolProfileEntries)
        .where(eq(toolProfileEntries.companyId, companyId)),
      db
        .select(profileCatalogColumns)
        .from(toolCatalogEntries)
        .where(
          and(
            eq(toolCatalogEntries.companyId, companyId),
            eq(toolCatalogEntries.status, "active"),
          ),
        ),
    ]);
    const quarantinedCountByConnection = new Map<string, number>();
    for (const entry of quarantinedEntries) {
      quarantinedCountByConnection.set(
        entry.connectionId,
        (quarantinedCountByConnection.get(entry.connectionId) ?? 0) + 1,
      );
    }
    const invocationConnectionById = new Map(
      invocations.map((invocation) => [invocation.id, invocation.connectionId]),
    );
    const pendingActionRequestCountByConnection = new Map<string, number>();
    for (const request of pendingActionRequests) {
      const connectionId = invocationConnectionById.get(request.invocationId);
      if (!connectionId) continue;
      pendingActionRequestCountByConnection.set(
        connectionId,
        (pendingActionRequestCountByConnection.get(connectionId) ?? 0) + 1,
      );
    }
    const entriesByProfile = new Map<
      string,
      Array<typeof toolProfileEntries.$inferSelect>
    >();
    for (const entry of profileEntries) {
      const list = entriesByProfile.get(entry.profileId) ?? [];
      list.push(entry);
      entriesByProfile.set(entry.profileId, list);
    }
    const connectionsById = new Map(
      connections.map((connection) => [connection.id, connection]),
    );
    const pendingProfilesByConnection = new Map<
      string,
      Map<
        string,
        { profileId: string; profileName: string; pendingCount: number }
      >
    >();
    for (const profile of profiles) {
      const tools = pendingNewToolsForProfile({
        profile,
        entries: entriesByProfile.get(profile.id) ?? [],
        catalog: activeCatalog,
        connectionsById,
      });
      for (const tool of tools) {
        const profileCounts =
          pendingProfilesByConnection.get(tool.connectionId) ?? new Map();
        const existing = profileCounts.get(profile.id) ?? {
          profileId: profile.id,
          profileName: profile.name,
          pendingCount: 0,
        };
        existing.pendingCount += 1;
        profileCounts.set(profile.id, existing);
        pendingProfilesByConnection.set(tool.connectionId, profileCounts);
      }
    }
    const apps = connections.flatMap((connection) => {
      const healthNeedsAttention = isAttentionHealthStatus(
        connection.healthStatus,
      );
      const quarantinedCatalogEntryCount =
        quarantinedCountByConnection.get(connection.id) ?? 0;
      const pendingActionRequestCount =
        pendingActionRequestCountByConnection.get(connection.id) ?? 0;
      const newToolsPendingProfiles = [
        ...(pendingProfilesByConnection.get(connection.id)?.values() ?? []),
      ].sort(
        (a, b) =>
          b.pendingCount - a.pendingCount ||
          a.profileName.localeCompare(b.profileName),
      );
      const newToolsPendingReviewCount = newToolsPendingProfiles.reduce(
        (sum, profile) => sum + profile.pendingCount,
        0,
      );
      const reasons = [
        ...(healthNeedsAttention ? ["health" as const] : []),
        ...(quarantinedCatalogEntryCount > 0
          ? ["quarantined_catalog_entries" as const]
          : []),
        ...(pendingActionRequestCount > 0
          ? ["pending_action_requests" as const]
          : []),
        ...(newToolsPendingReviewCount > 0
          ? ["profile_new_tools" as const]
          : []),
      ];
      return reasons.length > 0
        ? [
            {
              connection: toConnection(connection),
              healthNeedsAttention,
              quarantinedCatalogEntryCount,
              pendingActionRequestCount,
              newToolsPendingReviewCount,
              newToolsPendingProfiles,
              reasons,
            },
          ]
        : [];
    });
    return {
      generatedAt,
      apps,
      totals: {
        connections: apps.length,
        health: apps.filter((app) => app.healthNeedsAttention).length,
        quarantinedCatalogEntries: apps.reduce(
          (sum, app) => sum + app.quarantinedCatalogEntryCount,
          0,
        ),
        pendingActionRequests: apps.reduce(
          (sum, app) => sum + app.pendingActionRequestCount,
          0,
        ),
        newToolsPendingReview: apps.reduce(
          (sum, app) => sum + app.newToolsPendingReviewCount,
          0,
        ),
        newToolsPendingProfiles: apps.reduce(
          (sum, app) => sum + app.newToolsPendingProfiles.length,
          0,
        ),
      },
    };
  }

  async function sweepConnectionHealth(
    input: { staleAfterMs?: number; limit?: number } = {},
  ) {
    const generatedAt = now();
    const staleAfterMs = input.staleAfterMs ?? 15 * 60 * 1000;
    const limit = input.limit ?? 25;
    const cutoff = new Date(generatedAt.getTime() - staleAfterMs);
    // Legacy plugin backfills use a remote transport as a placeholder, but
    // their tools run in the plugin worker and have no remote MCP endpoint.
    // Select only due IDs in SQL so each scheduler tick does not decode every
    // active connection's config and credential metadata.
    const due = await db
      .select({ id: toolConnections.id })
      .from(toolConnections)
      .innerJoin(toolApplications, and(
        eq(toolApplications.id, toolConnections.applicationId),
        eq(toolApplications.companyId, toolConnections.companyId),
      ))
      .where(
        and(
          eq(toolConnections.enabled, true),
          eq(toolConnections.status, "active"),
          ne(toolConnections.transport, "chat_sdk"),
          ne(toolConnections.transport, "runtime_auth"),
          ne(toolApplications.type, "paperclip_plugin"),
          or(isNull(toolConnections.healthCheckedAt), lte(toolConnections.healthCheckedAt, cutoff)),
        ),
      )
      .orderBy(
        sql`${toolConnections.healthCheckedAt} asc nulls first`,
        asc(toolConnections.createdAt),
        asc(toolConnections.id),
      )
      .limit(limit);
    let healthy = 0;
    let failed = 0;
    const failedConnectionIds: string[] = [];
    for (const connection of due) {
      try {
        await checkConnectionHealth(connection.id, {
          actorType: "system",
          actorId: "tool_health_sweep",
        });
        healthy += 1;
      } catch {
        failed += 1;
        failedConnectionIds.push(connection.id);
      }
    }
    return {
      checked: due.length,
      healthy,
      failed,
      failedConnectionIds,
    };
  }

  function findExample(exampleId: string): ToolExampleDefinition {
    const definition = TOOL_EXAMPLES.find(
      (example) => example.id === exampleId,
    );
    if (!definition) throw notFound("Tool example not found");
    return definition;
  }

  function localStdioInstallBlocker(): string | null {
    return options.deploymentMode === "authenticated" &&
      options.deploymentExposure === "public" &&
      !trustedRuntimeHost()
      ? "Local stdio examples require a trusted MCP runtime host in authenticated public deployments."
      : null;
  }

  function exampleToolSummaries(
    definition: ToolExampleDefinition,
  ): ToolExampleSummary["fixture"]["tools"] {
    return APPROVED_STDIO_TEMPLATES[definition.templateId].tools.map((tool) => {
      const riskLevel = classifyRisk(tool);
      return {
        name: tool.name,
        description: tool.description ?? null,
        riskLevel,
        readOnly: riskLevel === "read",
      };
    });
  }

  async function exampleRows(
    companyId: string,
    definition: ToolExampleDefinition,
  ) {
    const [application] = await db
      .select()
      .from(toolApplications)
      .where(
        and(
          eq(toolApplications.companyId, companyId),
          eq(toolApplications.applicationKey, definition.applicationKey),
        ),
      );
    const [connection] = await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.companyId, companyId),
          eq(toolConnections.name, definition.connectionName),
        ),
      );
    const [profile] = await db
      .select()
      .from(toolProfiles)
      .where(
        and(
          eq(toolProfiles.companyId, companyId),
          eq(toolProfiles.profileKey, definition.profileKey),
        ),
      );
    const [profileBinding] = profile
      ? await db
          .select()
          .from(toolProfileBindings)
          .where(
            and(
              eq(toolProfileBindings.companyId, companyId),
              eq(toolProfileBindings.profileId, profile.id),
              eq(toolProfileBindings.targetType, "company"),
              eq(toolProfileBindings.targetId, companyId),
            ),
          )
      : [];
    const catalog = connection
      ? await db
          .select()
          .from(toolCatalogEntries)
          .where(
            and(
              eq(toolCatalogEntries.companyId, companyId),
              eq(toolCatalogEntries.connectionId, connection.id),
            ),
          )
          .orderBy(asc(toolCatalogEntries.toolName))
      : [];
    return {
      application: application ?? null,
      connection: connection ?? null,
      profile: profile ?? null,
      profileBinding: profileBinding ?? null,
      catalog,
    };
  }

  function exampleSummary(
    definition: ToolExampleDefinition,
    rows: Awaited<ReturnType<typeof exampleRows>>,
  ): ToolExampleSummary {
    const blocker = localStdioInstallBlocker();
    const tools = exampleToolSummaries(definition);
    const installed = Boolean(
      rows.application &&
      rows.connection &&
      rows.profile &&
      rows.profileBinding &&
      rows.connection.status !== "archived" &&
      rows.profile.status !== "archived",
    );
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      fixture: {
        transport: "local_stdio",
        templateId: definition.templateId,
        available: Boolean(APPROVED_STDIO_TEMPLATES[definition.templateId]),
        tools,
      },
      safeDefaultProfile: {
        profileKey: definition.profileKey,
        name: definition.profileName,
        defaultAction: "deny",
        allowedToolNames: tools
          .filter((tool) => tool.readOnly)
          .map((tool) => tool.name),
      },
      install: {
        installed,
        canInstall: !blocker,
        reason: blocker,
        applicationId: rows.application?.id ?? null,
        connectionId: rows.connection?.id ?? null,
        profileId: rows.profile?.id ?? null,
        profileBindingId: rows.profileBinding?.id ?? null,
      },
    };
  }

  async function upsertExampleApplication(
    companyId: string,
    definition: ToolExampleDefinition,
    existing: typeof toolApplications.$inferSelect | null,
  ) {
    const metadata = {
      ...(existing?.metadata ?? {}),
      source: "paperclip_example",
      exampleId: definition.id,
      safeDefault: true,
    };
    if (existing) {
      const [updated] = await db
        .update(toolApplications)
        .set({
          name: definition.applicationName,
          description: definition.applicationDescription,
          type: "mcp_stdio",
          status: "active",
          metadata,
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(toolApplications.id, existing.id))
        .returning();
      return { row: updated, created: false };
    }
    const [created] = await db
      .insert(toolApplications)
      .values({
        companyId,
        applicationKey: definition.applicationKey,
        name: definition.applicationName,
        description: definition.applicationDescription,
        type: "mcp_stdio",
        status: "active",
        metadata,
      })
      .returning();
    return { row: created, created: true };
  }

  async function upsertExampleConnection(
    companyId: string,
    definition: ToolExampleDefinition,
    applicationId: string,
    existing: typeof toolConnections.$inferSelect | null,
  ) {
    const config = {
      templateId: definition.templateId,
      exampleId: definition.id,
      safeDefault: true,
      quarantineNewEntries: true,
    };
    if (existing) {
      const [updated] = await db
        .update(toolConnections)
        .set({
          applicationId,
          name: definition.connectionName,
          transport: "local_stdio",
          status: "active",
          enabled: true,
          config,
          transportConfig: config,
          credentialRefs: [],
          credentialSecretRefs: [],
          updatedAt: new Date(),
        })
        .where(eq(toolConnections.id, existing.id))
        .returning();
      await ensureDefaultOrganizationGrant(updated);
      await syncCredentialBindings(updated);
      await ensureRuntimeSlot(updated);
      emitConnectionUpdated(updated, existing, "example");
      return { row: updated, created: false };
    }
    const connectionId = randomUUID();
    const [created] = await db
      .insert(toolConnections)
      .values({
        id: connectionId,
        companyId,
        applicationId,
        name: definition.connectionName,
        uid: connectionUid(
          "paperclip",
          definition.connectionName,
          connectionId,
        ),
        connectionKind: "managed",
        transport: "local_stdio",
        status: "active",
        enabled: true,
        config,
        transportConfig: config,
        credentialRefs: [],
        credentialSecretRefs: [],
      })
      .returning();
    await ensureDefaultOrganizationGrant(created);
    await syncCredentialBindings(created);
    await ensureRuntimeSlot(created);
    emitConnectionCreated(created, "example");
    return { row: created, created: true };
  }

  async function upsertExampleProfile(
    companyId: string,
    definition: ToolExampleDefinition,
    existing: typeof toolProfiles.$inferSelect | null,
  ) {
    const metadata = {
      ...(existing?.metadata ?? {}),
      source: "paperclip_example",
      exampleId: definition.id,
      safeDefault: true,
    };
    if (existing) {
      const [updated] = await db
        .update(toolProfiles)
        .set({
          name: definition.profileName,
          description: definition.profileDescription,
          status: "active",
          defaultAction: "deny",
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(toolProfiles.id, existing.id))
        .returning();
      return { row: updated, created: false };
    }
    const [created] = await db
      .insert(toolProfiles)
      .values({
        companyId,
        profileKey: definition.profileKey,
        name: definition.profileName,
        description: definition.profileDescription,
        status: "active",
        defaultAction: "deny",
        metadata,
      })
      .returning();
    return { row: created, created: true };
  }

  async function syncExampleProfileEntries(
    companyId: string,
    profileId: string,
    catalog: ToolCatalogEntry[],
  ): Promise<ToolProfileEntry[]> {
    await db
      .delete(toolProfileEntries)
      .where(
        and(
          eq(toolProfileEntries.companyId, companyId),
          eq(toolProfileEntries.profileId, profileId),
        ),
      );
    const readEntries = catalog.filter(
      (entry) => entry.riskLevel === "read" && entry.status === "active",
    );
    if (readEntries.length === 0) return [];
    const rows = await db
      .insert(toolProfileEntries)
      .values(
        readEntries.map((entry) => ({
          companyId,
          profileId,
          selectorType: "catalog_entry" as const,
          effect: "include" as const,
          applicationId: entry.applicationId,
          connectionId: entry.connectionId,
          catalogEntryId: entry.id,
          toolName: entry.toolName,
          riskLevel: entry.riskLevel,
          conditions: { source: "paperclip_example" },
        })),
      )
      .returning();
    return rows.map(toProfileEntry);
  }

  async function upsertExampleProfileBinding(
    companyId: string,
    profileId: string,
    existing: typeof toolProfileBindings.$inferSelect | null,
    actor?: ActorInfo,
  ): Promise<ToolProfileBinding> {
    const metadata = {
      ...(existing?.metadata ?? {}),
      source: "paperclip_example",
      safeDefault: true,
    };
    if (existing) {
      const [updated] = await db
        .update(toolProfileBindings)
        .set({ priority: 100, metadata, updatedAt: new Date() })
        .where(eq(toolProfileBindings.id, existing.id))
        .returning();
      return toProfileBinding(updated);
    }
    const [created] = await db
      .insert(toolProfileBindings)
      .values({
        companyId,
        profileId,
        targetType: "company",
        targetId: companyId,
        priority: 100,
        metadata,
        createdByAgentId:
          actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
        createdByUserId:
          actor?.actorType === "user" ? (actor.actorId ?? null) : null,
      })
      .returning();
    return toProfileBinding(created);
  }

  async function exampleSmokeActor(companyId: string, actor?: ActorInfo) {
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.companyId, companyId))
      .limit(1);
    if (agent) {
      return {
        actorType: "agent" as const,
        actorId: agent.id,
        agentId: agent.id,
      };
    }
    const actorType =
      actor?.actorType === "user" ? ("user" as const) : ("system" as const);
    return {
      actorType,
      actorId: actor?.actorId ?? "example-smoke",
      agentId: null,
    };
  }

  function sampleArguments(toolName: string): Record<string, unknown> {
    if (toolName === "get_value") return { key: "project" };
    if (toolName === "set_value") return { key: "project", value: "paperclip" };
    if (toolName === "create_item") return { title: "Smoke test item" };
    if (toolName === "mark_done" || toolName === "delete_item")
      return { id: "todo-1" };
    return {};
  }

  async function runSmokeDecisionCheck(input: {
    companyId: string;
    actor: Awaited<ReturnType<typeof exampleSmokeActor>>;
    connection: ToolConnection;
    catalogEntry: ToolCatalogEntry;
    expectedDecision: ToolPolicyDecision;
    name: string;
  }): Promise<ToolExampleSmokeCheck> {
    const decisionInput = {
      companyId: input.companyId,
      actor: input.actor,
      request: {
        applicationId: input.connection.applicationId,
        connectionId: input.connection.id,
        catalogEntryId: input.catalogEntry.id,
        toolName: input.catalogEntry.toolName,
        arguments: sampleArguments(input.catalogEntry.toolName),
      },
    };
    const decision = await policySvc.decide(decisionInput);
    const auditResult = await policySvc.writeAudit(
      decisionInput,
      decision,
      "policy_decision",
    );
    return {
      name: input.name,
      ok: decision.decision === input.expectedDecision,
      toolName: input.catalogEntry.toolName,
      expectedDecision: input.expectedDecision,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      explanation: decision.explanation,
      auditEventId: auditResult.legacyAuditEvent.id,
      toolCallEventId: auditResult.toolCallEvent.id,
    };
  }

  function actionSummary(
    entry: ToolCatalogEntry,
  ): ToolAppConnectionActionSummary {
    return {
      catalogEntryId: entry.id,
      toolName: entry.toolName,
      title: entry.title,
      description: entry.description,
      riskLevel: entry.riskLevel,
      isReadOnly: entry.isReadOnly,
      isWrite: entry.isWrite,
      isDestructive: entry.isDestructive,
      status: entry.status,
    };
  }

  function groupedActions(
    catalog: ToolCatalogEntry[],
  ): ConnectToolAppResult["actions"] {
    const readOnly: ToolAppConnectionActionSummary[] = [];
    const canMakeChanges: ToolAppConnectionActionSummary[] = [];
    for (const entry of catalog) {
      const summary = actionSummary(entry);
      if (
        entry.isReadOnly &&
        entry.riskLevel === "read" &&
        !entry.isWrite &&
        !entry.isDestructive
      ) {
        readOnly.push(summary);
      } else {
        canMakeChanges.push(summary);
      }
    }
    return { readOnly, canMakeChanges };
  }

  function defaultLinkName(link: string): string {
    try {
      const url = new URL(link);
      const host = url.host.replace(/^www\./, "");
      const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
      return `${host}${path}`.slice(0, 160) || "MCP app";
    } catch {
      return "MCP app";
    }
  }

  function linkCredentialFields(credentialValues: Record<string, string>) {
    const fields: Array<{
      label: string;
      configPath: string;
      required: boolean;
      placement: "header";
      key: string;
      prefix: string | null;
    }> = [];
    if (credentialValues["credentials.authorization"]?.trim()) {
      fields.push({
        label: "App key",
        configPath: "credentials.authorization",
        required: false,
        placement: "header",
        key: "Authorization",
        prefix: "Bearer ",
      });
    }
    for (const configPath of Object.keys(credentialValues).sort()) {
      if (!configPath.startsWith("headers.")) continue;
      const headerName = mcpRemoteHeaderNameFromConfigPath(configPath);
      if (!headerName)
        throw badRequest("Header names cannot be blank.", {
          code: "mcp_header_rejected",
        });
      // The API schema already rejected unsafe headers, but this is the last
      // point before a name becomes a real outbound request header — and the
      // normalized paste-config path lands here too — so re-check rather than
      // trust the caller.
      const nameCheck = checkMcpRemoteHeaderName(headerName);
      if (!nameCheck.ok) {
        throw badRequest(
          mcpRemoteHeaderRejectionMessage(headerName, nameCheck.reason!),
          {
            code: "mcp_header_rejected",
            headerName,
          },
        );
      }
      const valueCheck = checkMcpRemoteHeaderValue(
        credentialValues[configPath] ?? "",
      );
      if (!valueCheck.ok) {
        throw badRequest(
          mcpRemoteHeaderRejectionMessage(headerName, valueCheck.reason!),
          {
            code: "mcp_header_rejected",
            headerName,
          },
        );
      }
      fields.push({
        label: headerName,
        configPath,
        required: true,
        placement: "header",
        key: headerName,
        prefix: null,
      });
    }
    return fields;
  }

  function actorForSecret(
    actor?: ActorInfo,
  ): { userId?: string | null; agentId?: string | null } | undefined {
    if (actor?.actorType === "user") return { userId: actor.actorId ?? null };
    if (actor?.actorType === "agent") return { agentId: actor.actorId ?? null };
    return undefined;
  }

  function oauthEnvName(
    provider: string,
    suffix: "CLIENT_ID" | "CLIENT_SECRET",
  ) {
    return `PAPERCLIP_TOOL_OAUTH_${provider.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_${suffix}`;
  }

  function oauthClientConfig(provider: string) {
    const clientIdEnv = oauthEnvName(provider, "CLIENT_ID");
    const clientSecretEnv = oauthEnvName(provider, "CLIENT_SECRET");
    return {
      clientIdEnv,
      clientSecretEnv,
      clientId:
        process.env[clientIdEnv] ??
        process.env.PAPERCLIP_TOOL_OAUTH_CLIENT_ID ??
        null,
      clientSecret:
        process.env[clientSecretEnv] ??
        process.env.PAPERCLIP_TOOL_OAUTH_CLIENT_SECRET ??
        null,
    };
  }

  function configuredOAuthClientForConnection(
    connection: typeof toolConnections.$inferSelect,
    provider: string,
  ) {
    if (isSmokeLabOAuthFixture(connection) && provider === "smoke_lab") {
      return {
        clientIdEnv: "SMOKE_LAB_FIXED_CLIENT_ID",
        clientSecretEnv: "SMOKE_LAB_FIXED_CLIENT_SECRET",
        clientId: "paperclip-smoke-lab",
        clientSecret: null,
      };
    }
    return oauthClientConfig(provider);
  }

  async function annotateSavedOAuthClientSecret(connections: ToolConnection[], viewerUserId?: string) {
    const personal = connections.filter((connection) => connection.authKind === "oauth" && connection.credentialPolicy === "per_user");
    const grants = viewerUserId && personal.length > 0
      ? await db.select({ connectionId: connectionGrants.connectionId, refs: connectionGrants.credentialSecretRefs })
        .from(connectionGrants)
        .where(and(
          inArray(connectionGrants.companyId, [...new Set(personal.map((connection) => connection.companyId))]),
          inArray(connectionGrants.connectionId, personal.map((connection) => connection.id)),
          eq(connectionGrants.kind, "user"),
          eq(connectionGrants.subjectUserId, viewerUserId),
          eq(connectionGrants.status, "active"),
        ))
      : [];
    const savedPersonal = new Set(grants.filter((grant) => grant.refs.some((ref) => ref.configPath === "oauth.client_secret")).map((grant) => grant.connectionId));
    for (const connection of connections) {
      connection.hasSavedOAuthClientSecret = connection.credentialPolicy === "per_user"
        ? savedPersonal.has(connection.id)
        : connection.credentialSecretRefs.some((ref) => ref.configPath === "oauth.client_secret");
    }
  }

  async function oauthClientForConnection(
    connection: typeof toolConnections.$inferSelect,
    provider: string,
    actor?: ActorInfo,
  ) {
    const configured = configuredOAuthClientForConnection(connection, provider);
    if (configured.clientId) return configured;
    const oauth = oauthConfig(connection);
    const clientId =
      typeof oauth.clientId === "string" && oauth.clientId.trim()
        ? oauth.clientId.trim()
        : null;
    if (!clientId) return configured;
    // CIMD clients and public DCR clients have no token-endpoint secret. A DCR
    // authorization server may instead issue a confidential client (for
    // example, `client_secret_basic`); in that case the registration secret is
    // encrypted like every other provider credential and resolved only for the
    // token endpoint.
    const registrationSource = oauth.clientRegistrationSource;
    const publicRegisteredClient =
      registrationSource === "cimd" ||
      (registrationSource === "dcr" &&
        oauth.clientTokenEndpointAuthMethod === "none");
    let credentialSecretRefs = connection.credentialSecretRefs;
    if (
      connection.credentialPolicy === "per_user" &&
      actor?.actorType === "user" &&
      actor.actorId &&
      !credentialSecretRefs.some(
        (ref) => ref.configPath === "oauth.client_secret",
      )
    ) {
      const [personalGrant] = await db
        .select({
          credentialSecretRefs: connectionGrants.credentialSecretRefs,
        })
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, "user"),
            eq(connectionGrants.subjectUserId, actor.actorId),
            eq(connectionGrants.status, "active"),
          ),
        )
        .limit(1);
      credentialSecretRefs =
        personalGrant?.credentialSecretRefs ?? credentialSecretRefs;
    }
    const clientSecretRef = publicRegisteredClient
      ? undefined
      : credentialSecretRefs.find(
          (ref) => ref.configPath === "oauth.client_secret",
        );
    const clientSecret = clientSecretRef
      ? await secrets.resolveSecretValue(
          connection.companyId,
          clientSecretRef.secretId,
          clientSecretRef.versionSelector ?? "latest",
          {
            consumerType: "tool_connection",
            consumerId: connection.id,
            configPath: "oauth.client_secret",
            actorType: actor?.actorType ?? "system",
            actorId: actor?.actorId ?? null,
          },
        )
      : null;
    return {
      clientIdEnv: null,
      clientSecretEnv: null,
      clientId,
      clientSecret,
    };
  }

  function base64UrlSha256(input: string) {
    return createHash("sha256").update(input).digest("base64url");
  }

  function randomOauthToken(bytes = 32) {
    return randomBytes(bytes).toString("base64url");
  }

  function connectionSetupUrl(connection: typeof toolConnections.$inferSelect) {
    return `/apps/${connection.id}/permissions`;
  }

  function connectionReconnectUrl(
    connection: typeof toolConnections.$inferSelect,
  ) {
    return `/apps/${connection.id}/permissions`;
  }

  function credentialScope(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
  ) {
    const configured = asRecord(oauthConfig(connection).credentialScope);
    const type =
      typeof configured.type === "string"
        ? configured.type
        : typeof configured.targetType === "string"
          ? configured.targetType
          : actor?.actorType === "agent"
            ? "agent"
            : actor?.actorType === "user"
              ? "user"
              : "company";
    const id =
      typeof configured.id === "string"
        ? configured.id
        : typeof configured.targetId === "string"
          ? configured.targetId
          : (actor?.actorId ?? connection.companyId);
    return {
      type,
      id,
      hash: stableHash({
        companyId: connection.companyId,
        connectionId: connection.id,
        type,
        id,
      }),
    };
  }

  function oauthSecretRef(
    connection: typeof toolConnections.$inferSelect,
    configPath:
      "oauth.access_token" | "oauth.refresh_token" | "oauth.client_secret" | "railway.ssh_private_key",
  ) {
    return (
      connection.credentialSecretRefs.find(
        (ref) => ref.configPath === configPath,
      ) ?? null
    );
  }

  function oauthExpiresAtMs(
    connection: typeof toolConnections.$inferSelect,
  ): number | null {
    const expiresAt = oauthConfig(connection).expiresAt;
    if (typeof expiresAt !== "string") return null;
    const ms = Date.parse(expiresAt);
    return Number.isFinite(ms) ? ms : null;
  }

  async function oauthGalleryEntryForConnection(
    connection: typeof toolConnections.$inferSelect,
  ) {
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    if (!sourceTemplateKey)
      throw unprocessable(
        "This app connection was not created from the app gallery",
      );
    const galleryEntry = getConnectableAppDefinition(sourceTemplateKey);
    if (
      !galleryEntry ||
      connectionMethodForConnection(galleryEntry, connection).auth !== "oauth"
    ) {
      throw unprocessable("This app connection does not use sign in");
    }
    return galleryEntry;
  }

  async function createOrRotateOAuthSecret(
    input: {
      companyId: string;
      connection: typeof toolConnections.$inferSelect;
      configPath:
        "oauth.access_token" | "oauth.refresh_token" | "oauth.client_secret" | "railway.ssh_private_key";
      label: string;
      value: string;
      actor?: ActorInfo;
      existingRefs?: typeof connectionGrants.$inferSelect.credentialSecretRefs;
      ownerUserId?: string;
    },
    context?: {
      dbClient: Db | DbTransaction;
      secretClient: ReturnType<typeof secretService>;
    },
  ) {
    const existing = input.existingRefs === undefined
      ? oauthSecretRef(input.connection, input.configPath)
      : input.existingRefs.find((ref) => ref.configPath === input.configPath);
    const write = (client: Db | DbTransaction) => writeConnectionCredential(client, {
      companyId: input.companyId, connectionName: input.connection.name, configPath: input.configPath,
      label: input.label, value: input.value, existingRef: existing ?? undefined, actor: actorForSecret(input.actor),
      // Registration authenticates the OAuth client, never the person invoking tools.
      ownerUserId: input.configPath === "oauth.client_secret" ? undefined : input.ownerUserId,
      definitionKey: input.ownerUserId ? `tool_oauth.${input.connection.id}.${input.configPath.replace(/[^a-z0-9_:-]+/gi, "_")}` : undefined,
    });
    const { secret } = context ? await write(context.dbClient) : await db.transaction(write);
    return {
      secretId: secret.id, versionSelector: "latest" as const, configPath: input.configPath,
      required: input.configPath === "oauth.access_token", label: input.label,
    };
  }

  function assertOAuthRedirectConstraints(
    app: AppDefinition | null,
    redirectUri: string,
  ) {
    if (app?.redirectConstraints !== "https-or-loopback-http") return;
    let redirect: URL;
    try {
      redirect = new URL(redirectUri);
    } catch {
      throw unprocessable("OAuth callback URL is invalid", {
        code: "oauth_redirect_uri_invalid",
      });
    }
    const hostname = redirect.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const isLoopback =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "::1" ||
      /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (
      redirect.protocol === "https:" ||
      (redirect.protocol === "http:" && isLoopback)
    )
      return;
    throw unprocessable(
      "This provider requires an HTTPS or loopback origin. Configure TLS before connecting.",
      {
        code: "oauth_redirect_origin_unsupported",
        redirectConstraints: app.redirectConstraints,
        docsPath: "docs/deploy",
      },
    );
  }

  /**
   * Validate RFC 9207 `iss` on the authorization callback.
   *
   * When an authorization server returns `iss`, it must name the same issuer the
   * authorization request was bound to. A mismatch means the code came back from a
   * different server than the one we sent the user to — the mix-up attack RFC 9207
   * exists to stop — so the code is refused rather than exchanged. An absent `iss`
   * is tolerated: it is optional, and many deployed servers omit it.
   */
  function assertOAuthCallbackIssuer(
    connection: typeof toolConnections.$inferSelect,
    endpoints: OAuthProviderEndpoints,
    iss: string | null | undefined,
  ) {
    const returnedIssuer = typeof iss === "string" ? iss.trim() : "";
    if (!returnedIssuer) return;
    const oauth = oauthConfig(connection);
    const expectedIssuer =
      typeof oauth.expectedIssuer === "string" && oauth.expectedIssuer.trim()
        ? oauth.expectedIssuer.trim()
        : (endpoints.issuer ?? null);
    if (!expectedIssuer) return;
    if (sameOAuthIssuer(returnedIssuer, expectedIssuer)) return;
    throw badRequest(
      "Sign-in came back from an unexpected server. Start the connection again.",
      {
        code: "oauth_issuer_mismatch",
      },
    );
  }

  async function registerOAuthClient(input: {
    connection: typeof toolConnections.$inferSelect;
    endpoints: OAuthProviderEndpoints;
    redirectUri: string;
    actor?: ActorInfo;
  }) {
    const { clientId, clientSecret, tokenEndpointAuthMethod, clientIdIssuedAt, clientSecretExpiresAt } = await requestOAuthClientRegistration({
      endpoints: input.endpoints,
      redirectUri: input.redirectUri,
    });
    const existingClientSecretRef = oauthSecretRef(
      input.connection,
      "oauth.client_secret",
    );
    const nextCredentialSecretRefs =
      input.connection.credentialSecretRefs.filter(
        (ref) => ref.configPath !== "oauth.client_secret",
      );
    if (clientSecret) {
      const clientSecretRef = await createOrRotateOAuthSecret({
        companyId: input.connection.companyId,
        connection: input.connection,
        configPath: "oauth.client_secret",
        label: "OAuth client secret",
        value: clientSecret,
        actor: input.actor,
      });
      nextCredentialSecretRefs.push(clientSecretRef);
    } else if (
      existingClientSecretRef &&
      oauthConfig(input.connection).clientId === clientId
    ) {
      nextCredentialSecretRefs.push(existingClientSecretRef);
    }

    const oauth = oauthConfig(input.connection);
    const nextConfig = {
      ...input.connection.config,
      oauth: {
        ...oauth,
        provider: input.endpoints.provider,
        authorizationUrl: input.endpoints.authorizationUrl,
        tokenUrl: input.endpoints.tokenUrl,
        registrationUrl: input.endpoints.registrationUrl,
        metadataUrl: input.endpoints.metadataUrl ?? null,
        scopes: input.endpoints.scopes,
        offlineAccessSupported: input.endpoints.offlineAccessSupported,
        grantTypesSupported: input.endpoints.grantTypesSupported ?? [],
        codeChallengeMethodsSupported:
          input.endpoints.codeChallengeMethodsSupported ?? [],
        tokenEndpointAuthMethodsSupported:
          input.endpoints.tokenEndpointAuthMethodsSupported ?? [],
        issuer: input.endpoints.issuer ?? oauth.issuer ?? null,
        resource: input.endpoints.resource ?? oauth.resource ?? null,
        clientId,
        clientRegistrationSource: "dcr" satisfies OAuthClientRegistrationSource,
        clientTokenEndpointAuthMethod: tokenEndpointAuthMethod,
        clientRedirectUri: input.redirectUri,
        // Registered client material is only valid for the issuer/resource pair
        // it was minted against. `assertOAuthClientBinding` re-registers when any
        // of these move, so a re-pointed endpoint can never silently reuse a
        // client another authorization server issued.
        clientIssuer: input.endpoints.issuer ?? null,
        clientResource: input.endpoints.resource ?? null,
        clientCompanyId: input.connection.companyId,
        clientIdIssuedAt,
        clientSecretExpiresAt,
      },
    };
    const [updated] = await db
      .update(toolConnections)
      .set({
        ownership: "dcr",
        config: nextConfig,
        transportConfig: nextConfig,
        credentialSecretRefs: nextCredentialSecretRefs,
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, input.connection.id),
          eq(toolConnections.companyId, input.connection.companyId),
        ),
      )
      .returning();
    if (!updated) throw notFound("Tool connection not found");
    await syncCredentialBindings(updated);
    return updated;
  }

  /**
   * Adopt a Client ID Metadata Document as this connection's client: the
   * `client_id` *is* the https URL of Paperclip's published client metadata, so
   * there is nothing to register with the authorization server. Still recorded on
   * the connection so the issuer/resource/callback binding is enforced on reuse
   * exactly like a dynamically registered client.
   */
  async function adoptClientIdMetadataDocument(input: {
    connection: typeof toolConnections.$inferSelect;
    endpoints: OAuthProviderEndpoints;
    redirectUri: string;
    clientId: string;
  }) {
    const oauth = oauthConfig(input.connection);
    const nextConfig = {
      ...input.connection.config,
      oauth: {
        ...oauth,
        provider: input.endpoints.provider,
        authorizationUrl: input.endpoints.authorizationUrl,
        tokenUrl: input.endpoints.tokenUrl,
        registrationUrl: input.endpoints.registrationUrl ?? null,
        metadataUrl: input.endpoints.metadataUrl ?? null,
        scopes: input.endpoints.scopes,
        offlineAccessSupported: input.endpoints.offlineAccessSupported,
        grantTypesSupported: input.endpoints.grantTypesSupported ?? [],
        codeChallengeMethodsSupported:
          input.endpoints.codeChallengeMethodsSupported ?? [],
        tokenEndpointAuthMethodsSupported:
          input.endpoints.tokenEndpointAuthMethodsSupported ?? [],
        clientIdMetadataDocumentSupported: true,
        issuer: input.endpoints.issuer ?? oauth.issuer ?? null,
        resource: input.endpoints.resource ?? oauth.resource ?? null,
        clientId: input.clientId,
        clientRegistrationSource:
          "cimd" satisfies OAuthClientRegistrationSource,
        clientTokenEndpointAuthMethod: "none",
        clientRedirectUri: input.redirectUri,
        clientIssuer: input.endpoints.issuer ?? null,
        clientResource: input.endpoints.resource ?? null,
        clientCompanyId: input.connection.companyId,
      },
    };
    // A CIMD client has no secret. Drop any leftover one so a stale credential
    // from an earlier registration can never be replayed against a new issuer.
    const nextCredentialSecretRefs =
      input.connection.credentialSecretRefs.filter(
        (ref) => ref.configPath !== "oauth.client_secret",
      );
    const [updated] = await db
      .update(toolConnections)
      .set({
        authKind: "oauth",
        config: nextConfig,
        transportConfig: nextConfig,
        credentialSecretRefs: nextCredentialSecretRefs,
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, input.connection.id),
          eq(toolConnections.companyId, input.connection.companyId),
        ),
      )
      .returning();
    if (!updated) throw notFound("Tool connection not found");
    await syncCredentialBindings(updated);
    return updated;
  }

  /**
   * How the client already stored on this connection was obtained. Anything
   * unrecognised (including connections written before this field existed) reads
   * as `manual`, which is the conservative answer: Paperclip will not silently
   * re-register over client material it cannot prove it minted.
   */
  function storedOAuthClientRegistrationSource(
    connection: typeof toolConnections.$inferSelect,
  ): OAuthClientRegistrationSource {
    const source = oauthConfig(connection).clientRegistrationSource;
    return source === "cimd" || source === "dcr" || source === "preconfigured"
      ? source
      : "manual";
  }

  /**
   * Is the client material already stored on this connection still valid for the
   * authorization server, MCP resource, callback URI and company we are about to
   * use it with? Client credentials are minted against exactly one such tuple;
   * reusing them across a moved binding would let a re-pointed endpoint borrow
   * another server's registration.
   */
  function reviewedOAuthClientBinding(connection: typeof toolConnections.$inferSelect, endpoints: OAuthProviderEndpoints) {
    const oauth = oauthConfig(connection);
    // Only repair the known Asana v1 discovery mistake. Retain company and
    // callback checks, and never carry a secret to an arbitrary new issuer.
    if (connection.config.sourceTemplateKey === "asana"
      && connection.config.connectionMethodKey === "mcp-own-oauth"
      && connection.config.url === "https://mcp.asana.com/v2/mcp"
      && oauth.clientRegistrationSource === "manual"
      && connection.ownership !== "dcr"
      && endpoints.issuer === "https://app.asana.com"
      && endpoints.authorizationUrl === "https://app.asana.com/-/oauth_authorize"
      && endpoints.tokenUrl === "https://app.asana.com/-/oauth_token"
      && endpoints.resource === "https://mcp.asana.com/v2/mcp"
      && [undefined, null, "https://mcp.asana.com", "https://app.asana.com"].includes(oauth.clientIssuer as string | null | undefined)
      && [undefined, null, "https://mcp.asana.com", "https://mcp.asana.com/v2/mcp"].includes(oauth.clientResource as string | null | undefined)
      && (oauth.clientIssuer === "https://mcp.asana.com" || oauth.clientResource === "https://mcp.asana.com")) {
      return { ...oauth, clientIssuer: endpoints.issuer, clientResource: endpoints.resource };
    }
    return oauth;
  }

  function oauthClientBindingMatches(
    connection: typeof toolConnections.$inferSelect,
    endpoints: OAuthProviderEndpoints,
    redirectUri: string,
    clientIdMetadataDocumentUrl: string | null,
  ): boolean {
    const oauth = reviewedOAuthClientBinding(connection, endpoints);
    if (typeof oauth.clientId !== "string" || !oauth.clientId.trim())
      return false;
    const source =
      typeof oauth.clientRegistrationSource === "string"
        ? oauth.clientRegistrationSource
        : null;
    // Older interrupted setup flows could accidentally round-trip a DCR client
    // through the customer-client form and relabel it `manual`. Ownership is the
    // durable proof that Paperclip minted that client. Force a fresh registration
    // instead of preserving the damaged binding forever.
    if (source === "manual" && connection.ownership === "dcr") return false;
    // A URL client id that now resolves only to a private network is unusable by
    // an external authorization server. Treat the stored binding as stale so a
    // retry can replace it with a dynamically registered client.
    if (source === "cimd" && oauth.clientId !== clientIdMetadataDocumentUrl)
      return false;
    // A manually preregistered client was registered by the operator against
    // Paperclip's callback, so it has no recorded callback until first use.
    const redirectMatches =
      source === "manual"
        ? oauth.clientRedirectUri === undefined ||
          oauth.clientRedirectUri === null ||
          oauth.clientRedirectUri === redirectUri
        : oauth.clientRedirectUri === redirectUri;
    if (!redirectMatches) return false;
    if (
      typeof oauth.clientCompanyId === "string" &&
      oauth.clientCompanyId !== connection.companyId
    )
      return false;
    if (
      endpoints.issuer &&
      typeof oauth.clientIssuer === "string" &&
      oauth.clientIssuer &&
      !sameOAuthIssuer(oauth.clientIssuer, endpoints.issuer)
    ) {
      return false;
    }
    if (
      endpoints.resource &&
      typeof oauth.clientResource === "string" &&
      oauth.clientResource &&
      oauth.clientResource !== endpoints.resource
    ) {
      return false;
    }
    return true;
  }

  /**
   * Record the issuer/resource/callback/company a client is bound to, the first
   * time that client is actually used.
   *
   * A dynamically registered or CIMD client is stamped at registration. A client
   * the operator pasted in has no binding until now — without this, its
   * `clientRedirectUri` would stay unset forever and `oauthClientBindingMatches`
   * would keep accepting it for *any* callback, which is exactly the drift the
   * binding check exists to catch.
   */
  async function stampOAuthClientBinding(
    connection: typeof toolConnections.$inferSelect,
    endpoints: OAuthProviderEndpoints,
    redirectUri: string,
  ): Promise<typeof toolConnections.$inferSelect> {
    const originalOAuth = oauthConfig(connection);
    const oauth = reviewedOAuthClientBinding(connection, endpoints);
    const nextBinding = {
      clientRedirectUri: redirectUri,
      clientIssuer:
        typeof oauth.clientIssuer === "string" && oauth.clientIssuer
          ? oauth.clientIssuer
          : (endpoints.issuer ?? null),
      clientResource:
        typeof oauth.clientResource === "string" && oauth.clientResource
          ? oauth.clientResource
          : (endpoints.resource ?? null),
      clientCompanyId:
        typeof oauth.clientCompanyId === "string" && oauth.clientCompanyId
          ? oauth.clientCompanyId
          : connection.companyId,
    };
    const unchanged = Object.entries(nextBinding).every(
      ([key, value]) => originalOAuth[key] === value,
    );
    if (unchanged) return connection;
    const nextConfig = {
      ...connection.config,
      oauth: { ...oauth, ...nextBinding },
    };
    const [updated] = await db
      .update(toolConnections)
      .set({
        config: nextConfig,
        transportConfig: nextConfig,
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, connection.id),
          eq(toolConnections.companyId, connection.companyId),
        ),
      )
      .returning();
    return updated ?? connection;
  }

  /**
   * May Paperclip mint client material for this connection without an operator
   * pasting client credentials?
   *
   * A curated app opts in through its `ownershipModes`. A generic remote MCP
   * connection may register once — and only once — protected-resource and
   * authorization-server discovery actually produced a metadata document; an
   * endpoint that merely returned a 401 does not earn a registration.
   *
   * A curated method pinned to customer-owned clients still earns a registration
   * when the provider's own metadata advertises one. `ownershipModes` is a
   * point-in-time research snapshot, and providers add dynamic registration
   * without telling us; live discovery is the better evidence of the two, so a
   * stale catalog entry costs the operator a console detour rather than silently
   * outranking what the server just said about itself.
   */
  function canRegisterOAuthClientDynamically(
    connection: typeof toolConnections.$inferSelect,
    endpoints: OAuthProviderEndpoints,
    galleryEntry: AppDefinition | null,
  ): boolean {
    if (galleryEntry) {
      const method = connectionMethodForConnection(galleryEntry, connection);
      if (method.ownershipModes.includes("dcr")) return true;
      return method.auth === "oauth" && Boolean(endpoints.registrationUrl);
    }
    return (
      connection.transport === "mcp_remote" && Boolean(endpoints.metadataUrl)
    );
  }

  async function ensureOAuthClient(input: {
    connection: typeof toolConnections.$inferSelect;
    endpoints: OAuthProviderEndpoints;
    redirectUri: string;
    galleryEntry: AppDefinition | null;
    actor?: ActorInfo;
  }) {
    // 1. A client the deployment preconfigured for this issuer wins outright.
    const configured = configuredOAuthClientForConnection(
      input.connection,
      input.endpoints.provider,
    );
    if (configured.clientId) {
      return {
        connection: input.connection,
        client: configured,
        source: "preconfigured" as const,
      };
    }
    const method = input.galleryEntry
      ? connectionMethodForConnection(input.galleryEntry, input.connection)
      : null;
    const dcrRequired = method?.oauthClientRegistration === "dcr";
    // A reviewed provider compatibility choice may require DCR even when the
    // server also advertises CIMD. Do not resolve/adopt a metadata URL for that
    // method; the default for every other method remains CIMD-first.
    const metadataDocumentUrl = !dcrRequired && input.endpoints
      .clientIdMetadataDocumentSupported
      ? await resolveOAuthClientIdMetadataDocumentUrl(
          input.redirectUri,
          options.oauthClientMetadataLookup,
        )
      : null;
    // 2. Client material already bound to this issuer/resource/callback/company.
    if (
      oauthClientBindingMatches(
        input.connection,
        input.endpoints,
        input.redirectUri,
        metadataDocumentUrl,
      )
    ) {
      const bound = await stampOAuthClientBinding(
        input.connection,
        input.endpoints,
        input.redirectUri,
      );
      return {
        connection: bound,
        client: await oauthClientForConnection(
          bound,
          input.endpoints.provider,
          input.actor,
        ),
        source: storedOAuthClientRegistrationSource(bound),
      };
    }
    const oauth = oauthConfig(input.connection);
    if (
      oauth.clientRegistrationSource === "manual" &&
      input.connection.ownership !== "dcr" &&
      typeof oauth.clientId === "string" &&
      oauth.clientId.trim()
    ) {
      // Paperclip cannot re-register on the operator's behalf: the credentials
      // came from a console this deployment does not control.
      throw unprocessable(
        "This connection's sign-in details no longer match the server it points at. Re-enter the client ID and secret to continue.",
        { code: "oauth_manual_client_rebinding_required" },
      );
    }
    if (
      !canRegisterOAuthClientDynamically(
        input.connection,
        input.endpoints,
        input.galleryEntry,
      )
    ) {
      throw unprocessable(
        `OAuth client id is not configured for ${input.endpoints.provider}`,
        {
          code: "oauth_client_registration_unavailable",
        },
      );
    }
    if (dcrRequired && !input.endpoints.registrationUrl) {
      throw unprocessable(
        "This provider requires dynamic client registration, but its authorization server did not advertise a registration endpoint.",
        { code: "oauth_dcr_not_supported" },
      );
    }

    const key = `${input.connection.id}:${input.redirectUri}`;
    return singleFlight(oauthRegistrationFlights, key, async () => {
      const latest = await getConnectionRow(
        input.connection.id,
        input.connection.companyId,
      );
      const latestConfigured = configuredOAuthClientForConnection(
        latest,
        input.endpoints.provider,
      );
      if (latestConfigured.clientId) {
        return {
          connection: latest,
          client: latestConfigured,
          source: "preconfigured" as const,
        };
      }
      if (
        oauthClientBindingMatches(
          latest,
          input.endpoints,
          input.redirectUri,
          metadataDocumentUrl,
        )
      ) {
        const bound = await stampOAuthClientBinding(
          latest,
          input.endpoints,
          input.redirectUri,
        );
        return {
          connection: bound,
          client: await oauthClientForConnection(
            bound,
            input.endpoints.provider,
            input.actor,
          ),
          source: storedOAuthClientRegistrationSource(bound),
        };
      }
      // 3. By default, Client ID Metadata Documents need no registration call,
      //    so prefer them over DCR when the authorization server advertises
      //    support. Curated DCR opt-ins leave metadataDocumentUrl null above.
      if (metadataDocumentUrl) {
        const adopted = await adoptClientIdMetadataDocument({
          connection: latest,
          endpoints: input.endpoints,
          redirectUri: input.redirectUri,
          clientId: metadataDocumentUrl,
        });
        return {
          connection: adopted,
          client: await oauthClientForConnection(
            adopted,
            input.endpoints.provider,
            input.actor,
          ),
          source: "cimd" as const,
        };
      }
      // 4. Dynamic client registration.
      if (!input.endpoints.registrationUrl) {
        throw unprocessable(
          "This server needs sign-in details you create yourself. Add a client ID and secret under Advanced authentication.",
          { code: "oauth_manual_client_required" },
        );
      }
      const registered = await registerOAuthClient({
        connection: latest,
        endpoints: input.endpoints,
        redirectUri: input.redirectUri,
        actor: input.actor,
      });
      return {
        connection: registered,
        client: await oauthClientForConnection(
          registered,
          input.endpoints.provider,
          input.actor,
        ),
        source: "dcr" as const,
      };
    });
  }

  function withoutOAuthRefreshLease(oauth: Record<string, unknown>) {
    const { refreshLease: _refreshLease, ...rest } = oauth;
    return rest;
  }

  function oauthRefreshLeaseId(
    connection: typeof toolConnections.$inferSelect,
  ): string | null {
    const lease = asRecord(oauthConfig(connection).refreshLease);
    return typeof lease.id === "string" && lease.id ? lease.id : null;
  }

  async function clearOAuthRefreshLease(
    connection: typeof toolConnections.$inferSelect,
    leaseId: string,
  ) {
    const latest = await getConnectionRow(connection.id, connection.companyId);
    if (oauthRefreshLeaseId(latest) !== leaseId) return latest;
    const nextConfig = {
      ...latest.config,
      oauth: withoutOAuthRefreshLease(oauthConfig(latest)),
    };
    const [updated] = await db
      .update(toolConnections)
      .set({
        config: nextConfig,
        transportConfig: nextConfig,
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, latest.id),
          eq(toolConnections.companyId, latest.companyId),
          sql`${toolConnections.config} -> 'oauth' -> 'refreshLease' ->> 'id' = ${leaseId}`,
        ),
      )
      .returning();
    return updated ?? getConnectionRow(connection.id, connection.companyId);
  }

  async function acquireOAuthRefreshLease(
    connection: typeof toolConnections.$inferSelect,
  ): Promise<{
    connection: typeof toolConnections.$inferSelect;
    leaseId: string | null;
  }> {
    const waitDeadline = Date.now() + OAUTH_REFRESH_LEASE_WAIT_MS;
    while (true) {
      const latest = await getConnectionRow(
        connection.id,
        connection.companyId,
      );
      const latestExpiresAtMs = oauthExpiresAtMs(latest);
      if (latestExpiresAtMs && latestExpiresAtMs > Date.now() + 60_000) {
        return { connection: latest, leaseId: null };
      }

      const oauth = oauthConfig(latest);
      const currentLease = asRecord(oauth.refreshLease);
      const currentLeaseExpiresAt =
        typeof currentLease.expiresAt === "string"
          ? Date.parse(currentLease.expiresAt)
          : Number.NaN;
      const currentLeaseId =
        typeof currentLease.id === "string" && currentLease.id
          ? currentLease.id
          : null;
      const leaseIsActive =
        currentLeaseId !== null &&
        Number.isFinite(currentLeaseExpiresAt) &&
        currentLeaseExpiresAt > Date.now();
      if (!currentLeaseId) {
        const leaseId = randomUUID();
        const claimedAt = now();
        const nextConfig = {
          ...latest.config,
          oauth: {
            ...withoutOAuthRefreshLease(oauth),
            refreshLease: {
              id: leaseId,
              expiresAt: new Date(
                Date.now() + OAUTH_REFRESH_LEASE_MS,
              ).toISOString(),
            },
          },
        };
        const [claimed] = await db
          .update(toolConnections)
          .set({
            config: nextConfig,
            transportConfig: nextConfig,
            updatedAt: claimedAt,
          })
          .where(
            and(
              eq(toolConnections.id, latest.id),
              eq(toolConnections.companyId, latest.companyId),
              sql`${toolConnections.config} = ${JSON.stringify(latest.config)}::jsonb`,
              sql`${toolConnections.config} #>> '{oauth,refreshLease,id}' is null`,
            ),
          )
          .returning();
        if (claimed) return { connection: claimed, leaseId };
      }

      if (currentLeaseId && !leaseIsActive) {
        throw new HttpError(
          422,
          "The previous OAuth refresh did not finish. Reconnect this app before retrying.",
          {
            code: "oauth_refresh_outcome_unknown",
            setupUrl: connectionSetupUrl(latest),
            reconnectUrl: connectionReconnectUrl(latest),
          },
        );
      }

      if (Date.now() >= waitDeadline) {
        throw conflict("OAuth credential refresh is already in progress", {
          code: "oauth_refresh_in_progress",
          retryable: true,
        });
      }
      await new Promise((resolve) =>
        setTimeout(resolve, OAUTH_REFRESH_LEASE_POLL_MS),
      );
    }
  }

  async function markOAuthReauthorizationRequired(
    connection: typeof toolConnections.$inferSelect,
    guard: {
      leaseId: string;
      refreshSecretId: string;
      refreshTokenVersion: number;
    },
  ) {
    const oauth = oauthConfig(connection);
    const nextCredentialSecretRefs = connection.credentialSecretRefs.filter(
      (ref) =>
        ref.configPath !== "oauth.access_token" &&
        ref.configPath !== "oauth.refresh_token",
    );
    const nextCredentialRefs = connection.credentialRefs.filter(
      (ref) => ref.name !== "oauth.access_token",
    );
    const nextConfig = {
      ...connection.config,
      oauth: {
        ...withoutOAuthRefreshLease(oauth),
        expiresAt: null,
        reauthorizationRequiredAt: now().toISOString(),
      },
    };
    const [updated] = await db
      .update(toolConnections)
      .set({
        status: "draft",
        enabled: false,
        healthStatus: "error",
        healthMessage:
          "OAuth authorization expired. Reconnect this app to continue.",
        lastError: "oauth_reauthorization_required",
        config: nextConfig,
        transportConfig: nextConfig,
        credentialSecretRefs: nextCredentialSecretRefs,
        credentialRefs: nextCredentialRefs,
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, connection.id),
          eq(toolConnections.companyId, connection.companyId),
          sql`${toolConnections.config} -> 'oauth' -> 'refreshLease' ->> 'id' = ${guard.leaseId}`,
          sql`exists (
          select 1 from ${companySecrets}
          where ${companySecrets.id} = ${guard.refreshSecretId}
            and ${companySecrets.companyId} = ${connection.companyId}
            and ${companySecrets.latestVersion} = ${guard.refreshTokenVersion}
        )`,
        ),
      )
      .returning();
    if (updated) {
      await syncCredentialBindings(updated);
      emitConnectionUpdated(updated, connection, "credential_refresh");
    }
    return updated ?? null;
  }

  async function refreshOAuthCredentials(
    connection: typeof toolConnections.$inferSelect,
    leaseId: string,
    actor?: ActorInfo,
    accessContext?: {
      actorSource?:
        | "local_implicit"
        | "session"
        | "board_key"
        | "agent_key"
        | "agent_jwt"
        | "mcp_oauth"
        | "cloud_tenant";
      issueId?: string | null;
      heartbeatRunId?: string | null;
    },
  ): Promise<typeof toolConnections.$inferSelect> {
    const oauth = oauthConfig(connection);
    if (
      typeof oauth.tokenUrl !== "string" ||
      typeof oauth.provider !== "string"
    )
      return connection;
    const expiresAtMs = oauthExpiresAtMs(connection);
    if (expiresAtMs && expiresAtMs > Date.now() + 60_000) return connection;
    const grantType =
      oauth.grantType === "client_credentials" ||
      oauth.clientCredentials === true
        ? ("client_credentials" as const)
        : ("refresh_token" as const);
    const refreshRef = oauthSecretRef(connection, "oauth.refresh_token");
    if (grantType !== "client_credentials" && !refreshRef) {
      throw new HttpError(
        422,
        "OAuth credentials have expired and no refresh token is available",
        {
          code: "oauth_refresh_missing",
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
        },
      );
    }
    const client = await oauthClientForConnection(
      connection,
      oauth.provider,
      actor,
    );
    if (!client.clientId)
      throw unprocessable(
        `OAuth client id is not configured for ${oauth.provider}`,
      );
    const [refreshSecret] = refreshRef
      ? await db
          .select({ latestVersion: companySecrets.latestVersion })
          .from(companySecrets)
          .where(
            and(
              eq(companySecrets.id, refreshRef.secretId),
              eq(companySecrets.companyId, connection.companyId),
            ),
          )
          .limit(1)
      : [undefined];
    const refreshTokenVersion = refreshSecret?.latestVersion ?? null;
    const refreshToken =
      refreshRef && refreshTokenVersion !== null
        ? await secrets.resolveSecretValue(
            connection.companyId,
            refreshRef.secretId,
            refreshTokenVersion,
            {
              consumerType: "tool_connection",
              consumerId: connection.id,
              configPath: "oauth.refresh_token",
              actorType: actor?.actorType ?? "system",
              actorId: actor?.actorId ?? null,
              actorSource: accessContext?.actorSource,
              issueId: accessContext?.issueId,
              heartbeatRunId: accessContext?.heartbeatRunId,
            },
          )
        : null;
    let token: Awaited<ReturnType<typeof exchangeOAuthToken>>;
    try {
      token = await exchangeOAuthToken({
        tokenUrl: oauth.tokenUrl,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        tokenEndpointAuthMethod: storedOAuthTokenEndpointAuthMethod(
          oauth,
          client.clientSecret,
        ),
        grantType,
        scopes:
          normalizeOauthScopes(oauth.scopes).length > 0
            ? normalizeOauthScopes(oauth.scopes)
            : normalizeOauthScopes(oauth.scope),
        refreshToken,
        // Refreshing must stay bound to the same MCP server the original grant
        // named, or the authorization server may widen the token's audience.
        resource:
          typeof oauth.resource === "string" && oauth.resource
            ? oauth.resource
            : null,
      });
    } catch (error) {
      if (
        error instanceof HttpError &&
        asRecord(error.details).code === "oauth_reauthorization_required"
      ) {
        const marked =
          refreshRef && refreshTokenVersion !== null
            ? await markOAuthReauthorizationRequired(connection, {
                leaseId,
                refreshSecretId: refreshRef.secretId,
                refreshTokenVersion,
              })
            : null;
        if (!marked) {
          const latest = await getConnectionRow(
            connection.id,
            connection.companyId,
          );
          const latestExpiresAtMs = oauthExpiresAtMs(latest);
          if (latestExpiresAtMs && latestExpiresAtMs > Date.now() + 60_000)
            return latest;
          throw conflict(
            "OAuth credentials changed while refresh was in progress. Retry the request.",
            {
              code: "oauth_refresh_superseded",
              retryable: true,
            },
          );
        }
        throw new HttpError(error.status, error.message, {
          ...asRecord(error.details),
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
        });
      }
      throw error;
    }
    // Rotating providers invalidate the submitted refresh token immediately.
    // Persist its replacement before the new access token can be returned to a
    // caller, so a crash cannot leave the grant with only the consumed token.
    let nextRefreshRef: Awaited<
      ReturnType<typeof createOrRotateOAuthSecret>
    > | null = null;
    if (token.refreshToken) {
      nextRefreshRef = await createOrRotateOAuthSecret({
        companyId: connection.companyId,
        connection,
        configPath: "oauth.refresh_token",
        label: "OAuth refresh token",
        value: token.refreshToken,
        actor,
      });
    }
    const accessRef = await createOrRotateOAuthSecret({
      companyId: connection.companyId,
      connection,
      configPath: "oauth.access_token",
      label: "OAuth access token",
      value: token.accessToken,
      actor,
    });
    const nextCredentialSecretRefs = [
      ...connection.credentialSecretRefs.filter(
        (ref) =>
          ref.configPath !== "oauth.access_token" &&
          (!nextRefreshRef || ref.configPath !== "oauth.refresh_token"),
      ),
      accessRef,
      ...(nextRefreshRef ? [nextRefreshRef] : []),
    ];
    const expiresAt = token.expiresIn
      ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
      : null;
    const nextConfig = {
      ...connection.config,
      oauth: {
        ...withoutOAuthRefreshLease(oauth),
        grantType:
          grantType === "client_credentials"
            ? grantType
            : (oauth.grantType ?? "authorization_code"),
        expiresAt,
        scope: token.scope ?? oauth.scope ?? null,
        tokenType: token.tokenType,
        refreshedAt: new Date().toISOString(),
      },
      providerMetadata: {
        ...asRecord(connection.config.providerMetadata),
        oauth: {
          expiresAt,
          scope: token.scope ?? oauth.scope ?? null,
          tokenType: token.tokenType,
        },
      },
    };
    const [updated] = await db
      .update(toolConnections)
      .set({
        config: nextConfig,
        transportConfig: nextConfig,
        credentialSecretRefs: nextCredentialSecretRefs,
        credentialRefs: [
          ...connection.credentialRefs.filter(
            (ref) => ref.name !== "oauth.access_token",
          ),
          {
            name: "oauth.access_token",
            secretId: accessRef.secretId,
            version: "latest" as const,
            placement: "header" as const,
            key: "Authorization",
            prefix: "Bearer ",
          },
        ],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(toolConnections.id, connection.id),
          eq(toolConnections.companyId, connection.companyId),
          sql`${toolConnections.config} -> 'oauth' -> 'refreshLease' ->> 'id' = ${leaseId}`,
        ),
      )
      .returning();
    if (!updated) {
      throw conflict(
        "OAuth credentials changed while refresh was in progress. Retry the request.",
        {
          code: "oauth_refresh_superseded",
          retryable: true,
        },
      );
    }
    const previousBindingKeys = new Set(
      connection.credentialSecretRefs.map(
        (ref) => `${ref.secretId}:${ref.configPath}`,
      ),
    );
    const nextBindingKeys = new Set(
      nextCredentialSecretRefs.map(
        (ref) => `${ref.secretId}:${ref.configPath}`,
      ),
    );
    const bindingsChanged =
      previousBindingKeys.size !== nextBindingKeys.size ||
      [...previousBindingKeys].some((key) => !nextBindingKeys.has(key));
    if (bindingsChanged) await syncCredentialBindings(updated);
    return updated;
  }

  function oauthGrantConfig(grant: typeof connectionGrants.$inferSelect) {
    return asRecord(asRecord(grant.providerTenant).oauth);
  }

  function withoutOAuthGrantRefreshLease(oauth: Record<string, unknown>) {
    const { refreshLease: _refreshLease, ...rest } = oauth;
    return rest;
  }

  function oauthGrantExpiresAtMs(
    grant: typeof connectionGrants.$inferSelect,
    connection: typeof toolConnections.$inferSelect,
  ): number | null {
    const grantExpiresAt = oauthGrantConfig(grant).accessTokenExpiresAt;
    const value =
      typeof grantExpiresAt === "string"
        ? grantExpiresAt
        : oauthConfig(connection).expiresAt;
    if (typeof value !== "string") return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }

  async function getOAuthGrantRow(input: {
    companyId: string;
    connectionId: string;
    grantId: string;
  }) {
    const [grant] = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.id, input.grantId),
          eq(connectionGrants.companyId, input.companyId),
          eq(connectionGrants.connectionId, input.connectionId),
        ),
      )
      .limit(1);
    if (!grant) throw notFound("Connection authorization not found");
    return grant;
  }

  async function resolveOAuthGrantSecret(
    connection: typeof toolConnections.$inferSelect,
    grant: typeof connectionGrants.$inferSelect,
    ref: ToolCredentialSecretRef,
    actor: ActorInfo | undefined,
    accessContext:
      { issueId?: string | null; heartbeatRunId?: string | null } | undefined,
  ) {
    return resolveConnectionGrantSecret(db, connection, grant, ref, {
      consumerType: "tool_connection", consumerId: connection.id,
      actorType: actor?.actorType ?? "system", actorId: actor?.actorId ?? null,
      issueId: accessContext?.issueId, heartbeatRunId: accessContext?.heartbeatRunId,
    });
  }

  async function clearOAuthGrantRefreshLease(
    grant: typeof connectionGrants.$inferSelect,
    leaseId: string,
  ) {
    const latest = await getOAuthGrantRow({
      companyId: grant.companyId,
      connectionId: grant.connectionId,
      grantId: grant.id,
    });
    const oauth = oauthGrantConfig(latest);
    if (asRecord(oauth.refreshLease).id !== leaseId) return latest;
    const providerTenant = {
      ...(latest.providerTenant ?? {}),
      oauth: withoutOAuthGrantRefreshLease(oauth),
    };
    const [updated] = await db
      .update(connectionGrants)
      .set({
        providerTenant,
        updatedAt: now(),
      })
      .where(
        and(
          eq(connectionGrants.id, latest.id),
          eq(connectionGrants.companyId, latest.companyId),
          sql`${connectionGrants.providerTenant} -> 'oauth' -> 'refreshLease' ->> 'id' = ${leaseId}`,
        ),
      )
      .returning();
    return (
      updated ??
      getOAuthGrantRow({
        companyId: grant.companyId,
        connectionId: grant.connectionId,
        grantId: grant.id,
      })
    );
  }

  async function acquireOAuthGrantRefreshLease(
    connection: typeof toolConnections.$inferSelect,
    grant: typeof connectionGrants.$inferSelect,
    forceRefresh: boolean,
  ): Promise<{
    grant: typeof connectionGrants.$inferSelect;
    leaseId: string | null;
  }> {
    const waitDeadline = Date.now() + OAUTH_REFRESH_LEASE_WAIT_MS;
    const initialUpdatedAt = grant.updatedAt.getTime();
    while (true) {
      const latest = await getOAuthGrantRow({
        companyId: connection.companyId,
        connectionId: connection.id,
        grantId: grant.id,
      });
      if (latest.status !== "active") {
        throw unprocessable("OAuth authorization must be reconnected", {
          code: "oauth_reauthorization_required",
          setupUrl: connectionSetupUrl(connection),
          reconnectUrl: connectionReconnectUrl(connection),
        });
      }
      const expiresAtMs = oauthGrantExpiresAtMs(latest, connection);
      if (
        (!forceRefresh &&
          (expiresAtMs === null || expiresAtMs > Date.now() + 60_000)) ||
        (forceRefresh &&
          latest.updatedAt.getTime() > initialUpdatedAt &&
          !asRecord(oauthGrantConfig(latest).refreshLease).id)
      ) {
        return { grant: latest, leaseId: null };
      }

      const oauth = oauthGrantConfig(latest);
      const currentLease = asRecord(oauth.refreshLease);
      const currentLeaseId =
        typeof currentLease.id === "string" && currentLease.id
          ? currentLease.id
          : null;
      const currentLeaseExpiresAt =
        typeof currentLease.expiresAt === "string"
          ? Date.parse(currentLease.expiresAt)
          : Number.NaN;
      const leaseIsActive =
        currentLeaseId !== null &&
        Number.isFinite(currentLeaseExpiresAt) &&
        currentLeaseExpiresAt > Date.now();
      if (!currentLeaseId) {
        const leaseId = randomUUID();
        const providerTenant = {
          ...(latest.providerTenant ?? {}),
          oauth: {
            ...withoutOAuthGrantRefreshLease(oauth),
            refreshLease: {
              id: leaseId,
              expiresAt: new Date(
                Date.now() + OAUTH_REFRESH_LEASE_MS,
              ).toISOString(),
            },
          },
        };
        const [claimed] = await db
          .update(connectionGrants)
          .set({
            providerTenant,
            updatedAt: now(),
          })
          .where(
            and(
              eq(connectionGrants.id, latest.id),
              eq(connectionGrants.companyId, latest.companyId),
              eq(connectionGrants.status, "active"),
              sql`${connectionGrants.providerTenant} #>> '{oauth,refreshLease,id}' is null`,
            ),
          )
          .returning();
        if (claimed) return { grant: claimed, leaseId };
      }
      if (currentLeaseId && !leaseIsActive) {
        throw unprocessable(
          "The previous OAuth refresh did not finish. Reconnect this app before retrying.",
          {
            code: "oauth_refresh_outcome_unknown",
            setupUrl: connectionSetupUrl(connection),
            reconnectUrl: connectionReconnectUrl(connection),
          },
        );
      }
      if (Date.now() >= waitDeadline) {
        throw conflict("OAuth credential refresh is already in progress", {
          code: "oauth_refresh_in_progress",
          retryable: true,
        });
      }
      await new Promise((resolve) =>
        setTimeout(resolve, OAUTH_REFRESH_LEASE_POLL_MS),
      );
    }
  }

  async function refreshOAuthGrantCredentials(input: {
    companyId: string;
    connectionId: string;
    grantId: string;
    forceRefresh?: boolean;
    actor?: ActorInfo;
    issueId?: string | null;
    heartbeatRunId?: string | null;
  }): Promise<typeof connectionGrants.$inferSelect> {
    const connection = await getConnectionRow(
      input.connectionId,
      input.companyId,
    );
    const initialGrant = await getOAuthGrantRow(input);
    const oauth = oauthConfig(connection);
    const oauthProvider =
      typeof oauth.provider === "string" ? oauth.provider : null;
    const oauthTokenUrl =
      typeof oauth.tokenUrl === "string" ? oauth.tokenUrl : null;
    if (
      connection.authKind === "oauth" &&
      connection.credentialSource === "paperclip_vault" &&
      isPaperclipCloudConnectorStrategy(oauth.strategy)
    ) {
      const grantOauth = oauthGrantConfig(initialGrant);
      const expiresAt =
        typeof grantOauth.accessTokenExpiresAt === "string"
          ? Date.parse(grantOauth.accessTokenExpiresAt)
          : Number.NaN;
      const refreshedAt =
        typeof grantOauth.refreshedAt === "string"
          ? Date.parse(grantOauth.refreshedAt)
          : Number.NaN;
      const rotationDue =
        Number.isFinite(expiresAt) &&
        (!Number.isFinite(refreshedAt) ||
          refreshedAt <= Date.now() - 30 * 24 * 60 * 60_000);
      const refreshDue =
        Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60 * 60_000;
      // A GitHub App can deliberately issue a non-expiring ghu_ token. Its
      // continuity is checked against /user below; only an expiring token pair
      // enters this rotation path.
      if (!input.forceRefresh && !refreshDue && !rotationDue)
        return initialGrant;
      if (!Number.isFinite(expiresAt)) return initialGrant;

      return singleFlight(
        oauthGrantRefreshFlights,
        initialGrant.id,
        async () => {
          const lease = await acquireOAuthGrantRefreshLease(
            connection,
            initialGrant,
            true,
          );
          if (!lease.leaseId) return lease.grant;
          try {
            const grant = lease.grant;
            const profile = managedConnectorProfile(
              typeof oauth.connectorProfile === "string"
                ? oauth.connectorProfile
                : undefined,
            );
            const cloudConnector = currentCloudConnector();
            const connectorSubject =
              grant.kind === "agent" && grant.subjectAgentId
                ? `agent:${grant.subjectAgentId}`
                : grant.kind === "user" && grant.subjectUserId
                  ? grant.subjectUserId
                  : typeof oauth.connectorSubjectUserId === "string"
                    ? oauth.connectorSubjectUserId
                    : null;
            const accessRef = grant.credentialSecretRefs.find(
              (ref) => ref.configPath === "oauth.access_token",
            );
            const refreshRef = grant.credentialSecretRefs.find(
              (ref) => ref.configPath === "oauth.refresh_token",
            );
            if (
              !profile ||
              !cloudConnector ||
              !connectorSubject ||
              !accessRef ||
              !refreshRef
            ) {
              throw unprocessable("Managed authorization must be reconnected", {
                code: "oauth_reauthorization_required",
                setupUrl: connectionSetupUrl(connection),
                reconnectUrl: connectionReconnectUrl(connection),
              });
            }
            const refreshSecret = await resolveOAuthGrantSecret(
              connection,
              grant,
              refreshRef,
              input.actor,
              input,
            );
            let credentials;
            try {
              credentials = await cloudConnector.refresh({
                subject: connectorSubject,
                companyId: connection.companyId,
                profile: profile.id,
                refreshToken: refreshSecret.value,
              });
              if (profile.id === "workspace.all") {
                const requested = normalizeOauthScopes(oauthGrantConfig(grant).requestedScopes ?? oauthGrantConfig(grant).scopes);
                credentials.scopes = googleWorkspaceEffectiveScopes(requested, credentials.scopes);
              }
              if (profile.id === "workspace.all" && !isGoogleWorkspaceScopeGrant(credentials.scopes)) {
                throw new PaperclipCloudConnectorError("Google did not return verifiable permissions", "REAUTHORIZATION_REQUIRED");
              }
            } catch (error) {
              if (
                error instanceof PaperclipCloudConnectorError &&
                error.code === "REAUTHORIZATION_REQUIRED"
              ) {
                await db
                  .update(connectionGrants)
                  .set({ status: "needs_reauthorization", updatedAt: now() })
                  .where(
                    and(
                      eq(connectionGrants.id, grant.id),
                      eq(connectionGrants.companyId, grant.companyId),
                    ),
                  );
                throw unprocessable(
                  "Managed authorization must be reconnected",
                  {
                    code: "oauth_reauthorization_required",
                    setupUrl: connectionSetupUrl(connection),
                    reconnectUrl: connectionReconnectUrl(connection),
                  },
                );
              }
              throw error;
            }
            const credentialActor: ActorInfo | undefined =
              grant.kind === "user" && grant.subjectUserId
                ? { actorType: "user", actorId: grant.subjectUserId }
                : input.actor;
            const providerTenant = {
              ...(grant.providerTenant ?? {}),
              oauth: {
                ...withoutOAuthGrantRefreshLease(oauthGrantConfig(grant)),
                strategy: "paperclip_cloud_connector",
                accessTokenExpiresAt: credentials.accessTokenExpiresAt,
                scopes: credentials.scopes,
                tokenType: credentials.tokenType,
                refreshedAt: now().toISOString(),
                ...(credentials.refreshTokenExpiresAt
                  ? { refreshTokenExpiresAt: credentials.refreshTokenExpiresAt }
                  : {}),
              },
            };
            const updated = await db.transaction(async (tx) => {
              const [current] = await tx.select({ id: connectionGrants.id }).from(connectionGrants)
                .where(and(eq(connectionGrants.id, grant.id), eq(connectionGrants.companyId, grant.companyId),
                  eq(connectionGrants.status, "active"),
                  sql`${connectionGrants.providerTenant} -> 'oauth' -> 'refreshLease' ->> 'id' = ${lease.leaseId}`))
                .for("update");
              if (!current) throw conflict("OAuth credentials changed while refresh was in progress", {
                code: "oauth_refresh_superseded", retryable: true,
              });
              const txSecrets = secretService(tx);
              await txSecrets.rotate(
                accessRef.secretId,
                { value: credentials.accessToken },
                actorForSecret(credentialActor),
              );
              if (credentials.refreshToken) {
                await txSecrets.rotate(
                  refreshRef.secretId,
                  { value: credentials.refreshToken },
                  actorForSecret(credentialActor),
                );
              }
              const [committed] = await tx
                .update(connectionGrants)
                .set({
                  providerTenant,
                  status: "active",
                  updatedAt: now(),
                })
                .where(
                  and(
                    eq(connectionGrants.id, grant.id),
                    eq(connectionGrants.companyId, grant.companyId),
                    eq(connectionGrants.status, "active"),
                    sql`${connectionGrants.providerTenant} -> 'oauth' -> 'refreshLease' ->> 'id' = ${lease.leaseId}`,
                  ),
                )
                .returning();
              return committed;
            });
            if (!updated)
              throw conflict(
                "OAuth credentials changed while refresh was in progress",
                {
                  code: "oauth_refresh_superseded",
                  retryable: true,
                },
              );
            return updated;
          } finally {
            await clearOAuthGrantRefreshLease(lease.grant, lease.leaseId).catch(
              () => undefined,
            );
          }
        },
      );
    }
    if (
      connection.authKind !== "oauth" ||
      connection.credentialSource !== "paperclip_vault" ||
      !oauthTokenUrl ||
      !oauthProvider
    ) {
      return initialGrant;
    }
    const expiresAtMs = oauthGrantExpiresAtMs(initialGrant, connection);
    if (
      !input.forceRefresh &&
      (expiresAtMs === null || expiresAtMs > Date.now() + 60_000)
    ) {
      return initialGrant;
    }

    return singleFlight(oauthGrantRefreshFlights, initialGrant.id, async () => {
      const lease = await acquireOAuthGrantRefreshLease(
        connection,
        initialGrant,
        input.forceRefresh === true,
      );
      if (!lease.leaseId) return lease.grant;
      try {
        const grant = lease.grant;
        const refreshRef = grant.credentialSecretRefs.find(
          (ref) => ref.configPath === "oauth.refresh_token",
        );
        if (!refreshRef) {
          throw unprocessable(
            "OAuth credentials have expired and no refresh token is available",
            {
              code: "oauth_refresh_missing",
              setupUrl: connectionSetupUrl(connection),
              reconnectUrl: connectionReconnectUrl(connection),
            },
          );
        }
        const refreshSecret = await resolveOAuthGrantSecret(
          connection,
          grant,
          refreshRef,
          input.actor,
          input,
        );
        const credentialActor: ActorInfo | undefined =
          grant.kind === "user" && grant.subjectUserId
            ? { actorType: "user", actorId: grant.subjectUserId }
            : input.actor;
        const client = await oauthClientForConnection(
          connection,
          oauthProvider,
          credentialActor,
        );
        if (!client.clientId)
          throw unprocessable(
            `OAuth client id is not configured for ${oauthProvider}`,
          );
        const grantOauth = oauthGrantConfig(grant);
        let token: Awaited<ReturnType<typeof exchangeOAuthToken>>;
        try {
          token = await exchangeOAuthToken({
            tokenUrl: oauthTokenUrl,
            clientId: client.clientId,
            clientSecret: client.clientSecret,
            tokenEndpointAuthMethod: storedOAuthTokenEndpointAuthMethod(
              oauth,
              client.clientSecret,
            ),
            grantType: "refresh_token",
            scopes:
              normalizeOauthScopes(grantOauth.scopes).length > 0
                ? normalizeOauthScopes(grantOauth.scopes)
                : normalizeOauthScopes(oauth.scopes).length > 0
                  ? normalizeOauthScopes(oauth.scopes)
                  : normalizeOauthScopes(oauth.scope),
            refreshToken: refreshSecret.value,
            resource:
              typeof oauth.resource === "string" && oauth.resource
                ? oauth.resource
                : null,
          });
        } catch (error) {
          if (
            error instanceof HttpError &&
            asRecord(error.details).code === "oauth_reauthorization_required"
          ) {
            const retainedCredentialSecretRefs =
              grant.credentialSecretRefs.filter(
                (ref) =>
                  ref.configPath !== "oauth.access_token" &&
                  ref.configPath !== "oauth.refresh_token",
              );
            const providerTenant = {
              ...(grant.providerTenant ?? {}),
              oauth: {
                ...withoutOAuthGrantRefreshLease(grantOauth),
                accessTokenExpiresAt: undefined,
              },
            };
            const [marked] = await db
              .update(connectionGrants)
              .set({
                status: "needs_reauthorization",
                providerTenant,
                credentialSecretRefs: retainedCredentialSecretRefs,
                updatedAt: now(),
              })
              .where(
                and(
                  eq(connectionGrants.id, grant.id),
                  eq(connectionGrants.companyId, grant.companyId),
                  eq(connectionGrants.status, "active"),
                  sql`${connectionGrants.providerTenant} -> 'oauth' -> 'refreshLease' ->> 'id' = ${lease.leaseId}`,
                  sql`exists (
                select 1 from ${companySecrets}
                where ${companySecrets.id} = ${refreshRef.secretId}
                  and ${companySecrets.companyId} = ${connection.companyId}
                  and ${companySecrets.latestVersion} = ${refreshSecret.latestVersion}
              )`,
                ),
              )
              .returning();
            if (!marked) {
              const latest = await getOAuthGrantRow(input);
              const latestExpiresAt = oauthGrantExpiresAtMs(latest, connection);
              if (
                latest.status === "active" &&
                latestExpiresAt &&
                latestExpiresAt > Date.now() + 60_000
              )
                return latest;
              throw conflict(
                "OAuth credentials changed while refresh was in progress. Retry the request.",
                {
                  code: "oauth_refresh_superseded",
                  retryable: true,
                },
              );
            }
            if (marked.kind === "organization") {
              const latestConnection = await getConnectionRow(
                connection.id,
                connection.companyId,
              );
              const [reauthorizationRequired] = await db
                .update(toolConnections)
                .set({
                  status: "draft",
                  enabled: false,
                  credentialSecretRefs:
                    latestConnection.credentialSecretRefs.filter(
                      (ref) =>
                        ref.configPath !== "oauth.access_token" &&
                        ref.configPath !== "oauth.refresh_token",
                    ),
                  credentialRefs: latestConnection.credentialRefs.filter(
                    (ref) =>
                      ref.name !== "oauth.access_token" &&
                      ref.name !== "oauth.refresh_token",
                  ),
                  updatedAt: now(),
                })
                .where(
                  and(
                    eq(toolConnections.id, latestConnection.id),
                    eq(toolConnections.companyId, latestConnection.companyId),
                  ),
                )
                .returning();
              await syncCredentialBindings(reauthorizationRequired);
              emitConnectionUpdated(
                reauthorizationRequired,
                latestConnection,
                "credential_refresh",
              );
            } else {
              const activeGrantRefs = await db
                .select({
                  refs: connectionGrants.credentialSecretRefs,
                })
                .from(connectionGrants)
                .where(
                  and(
                    eq(connectionGrants.companyId, connection.companyId),
                    eq(connectionGrants.connectionId, connection.id),
                    eq(connectionGrants.status, "active"),
                  ),
                );
              await syncCredentialBindings(
                connection,
                activeGrantRefs.flatMap((row) => row.refs),
              );
            }
            throw new HttpError(error.status, error.message, {
              ...asRecord(error.details),
              setupUrl: connectionSetupUrl(connection),
              reconnectUrl: connectionReconnectUrl(connection),
            });
          }
          throw error;
        }

        if (connection.config.sourceTemplateKey === "google-workspace"
          && !isGoogleWorkspaceScopeGrant(normalizeOauthScopes(token.scope))) {
          await db.update(connectionGrants).set({ status: "needs_reauthorization", updatedAt: now() })
            .where(and(eq(connectionGrants.id, grant.id), eq(connectionGrants.companyId, connection.companyId)));
          throw unprocessable("Google did not return verifiable permissions. Reconnect Google Workspace.", { code: "oauth_reauthorization_required" });
        }
        let nextRefreshRef: ToolCredentialSecretRef | null = null;
        if (token.refreshToken) {
          nextRefreshRef = await createOrRotateOAuthSecret({
            companyId: connection.companyId,
            connection,
            configPath: "oauth.refresh_token",
            label: "OAuth refresh token",
            value: token.refreshToken,
            actor: credentialActor,
            existingRefs: grant.credentialSecretRefs,
            ownerUserId:
              grant.kind === "user"
                ? (grant.subjectUserId ?? undefined)
                : undefined,
          });
        }
        const accessRef = await createOrRotateOAuthSecret({
          companyId: connection.companyId,
          connection,
          configPath: "oauth.access_token",
          label: "OAuth access token",
          value: token.accessToken,
          actor: credentialActor,
          existingRefs: grant.credentialSecretRefs,
          ownerUserId:
            grant.kind === "user"
              ? (grant.subjectUserId ?? undefined)
              : undefined,
        });
        const nextCredentialSecretRefs = [
          ...grant.credentialSecretRefs.filter(
            (ref) =>
              ref.configPath !== "oauth.access_token" &&
              (!nextRefreshRef || ref.configPath !== "oauth.refresh_token"),
          ),
          accessRef,
          ...(nextRefreshRef ? [nextRefreshRef] : []),
        ];
        const expiresAt = token.expiresIn
          ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
          : null;
        // A refresh carries no fresh authorization request, so the baseline stays what
        // Paperclip asked for when *this* grant was authorized. Judging the response against
        // the grant's own scopes instead would let an over-grant that the provider re-asserts
        // on every refresh read back as clean, because the widened grant would have become
        // its own baseline. The connection-level list is only a fallback for grants created
        // before the per-grant baseline existed — it is whichever callback ran last, so on a
        // connection two users authorized with different scopes it is the wrong baseline for
        // at least one of them.
        const refreshed = resolveGrantedOauthScopes({
          tokenScope: token.scope,
          requestedScopes:
            grantOauth.requestedScopes ??
            oauth.scopes ??
            oauth.scope ??
            grantOauth.scopes,
          previous: {
            scopes: grantOauth.scopes,
            scopeSource: grantOauth.scopeSource,
            unrequestedScopes: grantOauth.unrequestedScopes,
          },
        });
        if (connection.config.sourceTemplateKey === "google-workspace") {
          refreshed.scopes = googleWorkspaceEffectiveScopes(normalizeOauthScopes(grantOauth.requestedScopes ?? grantOauth.scopes), refreshed.scopes);
        }
        const providerTenant = {
          ...(grant.providerTenant ?? {}),
          oauth: {
            ...withoutOAuthGrantRefreshLease(grantOauth),
            strategy:
              typeof grantOauth.strategy === "string"
                ? grantOauth.strategy
                : "direct_oauth",
            accessTokenExpiresAt: expiresAt ?? undefined,
            scopes: refreshed.scopes,
            scopeSource: refreshed.scopeSource,
            unrequestedScopes: refreshed.unrequestedScopes,
            tokenType: token.tokenType,
            refreshedAt: now().toISOString(),
          },
        };
        const [updated] = await db
          .update(connectionGrants)
          .set({
            providerTenant,
            credentialSecretRefs: nextCredentialSecretRefs,
            status: "active",
            updatedAt: now(),
          })
          .where(
            and(
              eq(connectionGrants.id, grant.id),
              eq(connectionGrants.companyId, grant.companyId),
              eq(connectionGrants.status, "active"),
              sql`${connectionGrants.providerTenant} -> 'oauth' -> 'refreshLease' ->> 'id' = ${lease.leaseId}`,
            ),
          )
          .returning();
        if (!updated) {
          throw conflict(
            "OAuth credentials changed while refresh was in progress. Retry the request.",
            {
              code: "oauth_refresh_superseded",
              retryable: true,
            },
          );
        }
        if (grant.kind === "organization") {
          const latestConnection = await getConnectionRow(
            connection.id,
            connection.companyId,
          );
          const latestOauth = oauthConfig(latestConnection);
          const nextConfig = {
            ...latestConnection.config,
            oauth: {
              ...withoutOAuthRefreshLease(latestOauth),
              expiresAt,
              scope: token.scope ?? latestOauth.scope ?? null,
              tokenType: token.tokenType,
              refreshedAt: now().toISOString(),
            },
            providerMetadata: {
              ...asRecord(latestConnection.config.providerMetadata),
              oauth: {
                expiresAt,
                scope: token.scope ?? latestOauth.scope ?? null,
                // Carry the same provenance the grant just recorded. Without it a connection
                // read reverts to a bare scope with no source and no over-grant warning after
                // the first ordinary refresh, while the grant read still has both.
                scopeSource: refreshed.scopeSource,
                unrequestedScopes: refreshed.unrequestedScopes,
                tokenType: token.tokenType,
              },
            },
          };
          await db
            .update(toolConnections)
            .set({
              config: nextConfig,
              transportConfig: nextConfig,
              updatedAt: now(),
            })
            .where(
              and(
                eq(toolConnections.id, latestConnection.id),
                eq(toolConnections.companyId, latestConnection.companyId),
              ),
            );
        }
        const previousKeys = new Set(
          grant.credentialSecretRefs.map(
            (ref) => `${ref.secretId}:${ref.configPath}`,
          ),
        );
        const nextKeys = new Set(
          nextCredentialSecretRefs.map(
            (ref) => `${ref.secretId}:${ref.configPath}`,
          ),
        );
        if (
          previousKeys.size !== nextKeys.size ||
          [...previousKeys].some((key) => !nextKeys.has(key))
        ) {
          const activeGrantRefs = await db
            .select({
              refs: connectionGrants.credentialSecretRefs,
            })
            .from(connectionGrants)
            .where(
              and(
                eq(connectionGrants.companyId, connection.companyId),
                eq(connectionGrants.connectionId, connection.id),
                eq(connectionGrants.status, "active"),
              ),
            );
          await syncCredentialBindings(
            connection,
            activeGrantRefs.flatMap((row) => row.refs),
          );
        }
        return updated;
      } finally {
        await clearOAuthGrantRefreshLease(lease.grant, lease.leaseId).catch(
          () => undefined,
        );
      }
    });
  }

  async function maybeRefreshOAuthCredentials(
    connection: typeof toolConnections.$inferSelect,
    actor?: ActorInfo,
    accessContext?: {
      actorSource?:
        | "local_implicit"
        | "session"
        | "board_key"
        | "agent_key"
        | "agent_jwt"
        | "mcp_oauth"
        | "cloud_tenant";
      issueId?: string | null;
      heartbeatRunId?: string | null;
    },
  ): Promise<typeof toolConnections.$inferSelect> {
    const oauth = oauthConfig(connection);
    if (
      typeof oauth.tokenUrl !== "string" ||
      typeof oauth.provider !== "string"
    )
      return connection;
    const expiresAtMs = oauthExpiresAtMs(connection);
    if (expiresAtMs && expiresAtMs > Date.now() + 60_000) return connection;
    return singleFlight(oauthRefreshFlights, connection.id, async () => {
      const lease = await acquireOAuthRefreshLease(connection);
      if (!lease.leaseId) return lease.connection;
      try {
        return await refreshOAuthCredentials(
          lease.connection,
          lease.leaseId,
          actor,
          accessContext,
        );
      } finally {
        await clearOAuthRefreshLease(lease.connection, lease.leaseId).catch(
          () => undefined,
        );
      }
    });
  }

  async function refreshManagedGitHubGrantAccess(
    connection: typeof toolConnections.$inferSelect,
    initialGrant: typeof connectionGrants.$inferSelect,
    actor?: ActorInfo,
  ) {
    return measureRunPhase("connectors.github.refresh", async () => {
      try {
        return await refreshManagedGitHubGrantAccessOnce(
          connection,
          initialGrant,
          actor,
        );
      } catch (error) {
        if (
          !(error instanceof HttpError) ||
          asRecord(error.details).code !== "github_access_changed"
        )
          throw error;
        const [current] = await measureRunPhase("connectors.github.grants", () => db
          .select()
          .from(connectionGrants)
          .where(
            and(
              eq(connectionGrants.id, initialGrant.id),
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
            ),
          ));
        if (!current || current.status !== "active") throw error;
        return refreshManagedGitHubGrantAccessOnce(connection, current, actor);
      }
    });
  }

  async function refreshManagedGitHubGrantAccessOnce(
    connection: typeof toolConnections.$inferSelect,
    initialGrant: typeof connectionGrants.$inferSelect,
    actor?: ActorInfo,
  ) {
    let grant = await measureRunPhase("connectors.github.credentials", () => refreshOAuthGrantCredentials({
      companyId: connection.companyId,
      connectionId: connection.id,
      grantId: initialGrant.id,
      actor,
    }));
    const resolveAccessToken = async () => measureRunPhase("connectors.github.credentials", async () => {
      const accessRef = grant.credentialSecretRefs.find(
        (ref) => ref.configPath === "oauth.access_token",
      );
      if (!accessRef)
        throw unprocessable("GitHub authorization must be reconnected", {
          code: "oauth_reauthorization_required",
        });
      return (
        await resolveOAuthGrantSecret(
          connection,
          grant,
          accessRef,
          actor,
          undefined,
        )
      ).value;
    });
    let metadata;
    let accessToken = await resolveAccessToken();
    try {
      metadata = await measureRunPhase("connectors.github.repositories", () => loadGitHubGrantMetadata(
        accessToken,
        fetch,
        grant.providerTenant?.github?.appSlug,
      ));
    } catch (error) {
      const providerCode =
        error instanceof HttpError ? asRecord(error.details).code : null;
      if (providerCode !== "oauth_reauthorization_required") throw error;
      // GitHub may invalidate an access token before its recorded expiry. If an
      // expiring token pair exists, rotate it once under the same durable lease
      // and CAS path, then repeat /user before surfacing reconnect-required.
      grant = await measureRunPhase("connectors.github.credentials", () => refreshOAuthGrantCredentials({
        companyId: connection.companyId,
        connectionId: connection.id,
        grantId: initialGrant.id,
        forceRefresh: true,
        actor,
      }));
      accessToken = await resolveAccessToken();
      try {
        metadata = await measureRunPhase("connectors.github.repositories", () => loadGitHubGrantMetadata(
          accessToken,
          fetch,
          grant.providerTenant?.github?.appSlug,
        ));
      } catch (retryError) {
        const retryCode =
          retryError instanceof HttpError
            ? asRecord(retryError.details).code
            : null;
        if (retryCode === "oauth_reauthorization_required") {
          await measureRunPhase("connectors.github.grant_write", () => db
            .update(connectionGrants)
            .set({ status: "needs_reauthorization", updatedAt: now() })
            .where(
              and(
                eq(connectionGrants.id, grant.id),
                eq(connectionGrants.companyId, grant.companyId),
              ),
            ));
        }
        throw retryError;
      }
    }
    const { updated, previousGitHub } = await measureRunTransaction(db, "connectors.github.refresh", async (tx) => {
      const [currentGrant] = await measureRunPhase("connectors.github.grant_lock", () => tx
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.id, grant.id),
            eq(connectionGrants.companyId, grant.companyId),
          ),
        )
        .for("update")
        .limit(1));
      if (!currentGrant || currentGrant.status === "revoked")
        throw notFound("GitHub authorization not found");
      const previousGitHub = currentGrant.providerTenant?.github;
      const initialGitHub = grant.providerTenant?.github;
      // No lock is held during provider requests. Reject a snapshot if another
      // refresh or webhook changed access while those requests were in flight.
      if (
        previousGitHub?.accessRevision !== initialGitHub?.accessRevision ||
        previousGitHub?.lastWebhookAt !== initialGitHub?.lastWebhookAt ||
        previousGitHub?.lastAccessRefreshAt !==
          initialGitHub?.lastAccessRefreshAt
      ) {
        throw conflict("GitHub access changed during refresh. Try again.", {
          code: "github_access_changed",
        });
      }
      const providerTenant = {
        ...(currentGrant.providerTenant ?? {}),
        github: {
          ...metadata,
          ...(previousGitHub?.lastWebhookAt
            ? { lastWebhookAt: previousGitHub.lastWebhookAt }
            : {}),
          webhookHealth:
            previousGitHub?.webhookHealth ?? metadata.webhookHealth,
        },
      };
      const [updated] = await measureRunPhase("connectors.github.grant_write", () => tx
        .update(connectionGrants)
        .set({
          providerTenant,
          status: "active",
          updatedAt: now(),
        })
        .where(
          and(
            eq(connectionGrants.id, grant.id),
            eq(connectionGrants.companyId, grant.companyId),
          ),
        )
        .returning());
      if (!updated) throw notFound("GitHub authorization not found");
      return { updated, previousGitHub };
    });

    const cloudConnector = currentCloudConnector();
    const subject =
      updated.kind === "agent" && updated.subjectAgentId
        ? `agent:${updated.subjectAgentId}`
        : updated.kind === "user" && updated.subjectUserId
          ? updated.subjectUserId
          : null;
    if (cloudConnector && subject) {
      const previous = new Set(previousGitHub?.installationIds ?? []);
      const current = new Set(metadata.installationIds);
      await measureRunPhase("connectors.github.webhooks", () => Promise.all([
        ...metadata.installationIds.map((installationId) =>
          cloudConnector.setWebhookBinding({
            subject,
            companyId: connection.companyId,
            id: `${updated.id}_${installationId}`,
            installationId,
            connectionId: connection.id,
            grantId: updated.id,
            active: true,
            accessToken,
          }),
        ),
        ...[...previous]
          .filter((installationId) => !current.has(installationId))
          .map((installationId) =>
            cloudConnector.setWebhookBinding({
              subject,
              companyId: connection.companyId,
              id: `${updated.id}_${installationId}`,
              installationId,
              connectionId: connection.id,
              grantId: updated.id,
              active: false,
            }),
          ),
      ]));
    }
    return updated;
  }

  async function sweepGitHubConnectionContinuity() {
    if (now().getTime() < nextGitHubContinuitySweepAt) {
      return { checked: 0, due: 0, refreshed: 0, failed: 0 };
    }
    nextGitHubContinuitySweepAt = now().getTime() + 60 * 60_000;
    const cutoff = now().getTime() - 30 * 24 * 60 * 60_000;
    const rows = await db
      .select({ grant: connectionGrants, connection: toolConnections })
      .from(connectionGrants)
      .innerJoin(
        toolConnections,
        and(
          eq(toolConnections.id, connectionGrants.connectionId),
          eq(toolConnections.companyId, connectionGrants.companyId),
        ),
      )
      .where(
        and(
          eq(connectionGrants.status, "active"),
          eq(toolConnections.status, "active"),
          eq(toolConnections.enabled, true),
        ),
      );
    const due = rows.filter(({ grant, connection }) => {
      const config = asRecord(connection.config);
      const oauth = asRecord(config.oauth);
      if (
        config.sourceTemplateKey !== "github" ||
        oauth.connectorProfile !== "github.code" ||
        !grant.providerTenant?.github
      )
        return false;
      const expiresAt = grant.providerTenant.oauth?.accessTokenExpiresAt;
      const refreshedAt = grant.providerTenant.oauth?.refreshedAt
        ? Date.parse(grant.providerTenant.oauth.refreshedAt)
        : Number.NaN;
      const accessCheckedAt = grant.providerTenant.github.lastAccessRefreshAt
        ? Date.parse(grant.providerTenant.github.lastAccessRefreshAt)
        : Number.NaN;
      if (typeof expiresAt === "string") {
        const expiry = Date.parse(expiresAt);
        return (
          !Number.isFinite(expiry) ||
          expiry <= now().getTime() + 60 * 60_000 ||
          !Number.isFinite(refreshedAt) ||
          refreshedAt <= cutoff
        );
      }
      return !Number.isFinite(accessCheckedAt) || accessCheckedAt <= cutoff;
    });
    let refreshed = 0;
    let failed = 0;
    for (const row of due) {
      try {
        await refreshManagedGitHubGrantAccess(row.connection, row.grant, {
          actorType: "system",
          actorId: "github-connection-continuity",
        });
        refreshed += 1;
      } catch {
        failed += 1;
      }
    }
    return { checked: rows.length, due: due.length, refreshed, failed };
  }

  function policyNameForApp(
    connection: typeof toolConnections.$inferSelect,
    entry: typeof toolCatalogEntries.$inferSelect,
  ) {
    const base = `Ask first ${connection.id.slice(0, 8)} ${entry.toolName}`;
    return base.length <= 160 ? base : base.slice(0, 160);
  }

  function nextAvailableConnectionName(
    requestedName: string,
    existingNames: readonly string[],
  ): string {
    const base = requestedName.trim() || "Custom app";
    const used = new Set(
      existingNames.map((candidate) => candidate.trim().toLocaleLowerCase()),
    );
    const unsuffixed = base.slice(0, 160);
    if (!used.has(unsuffixed.toLocaleLowerCase())) return unsuffixed;
    for (let index = 2; index < 10_000; index += 1) {
      const suffix = ` (${index})`;
      const candidate = `${base.slice(0, 160 - suffix.length).trimEnd()}${suffix}`;
      if (!used.has(candidate.toLocaleLowerCase())) return candidate;
    }
    return `${base.slice(0, 151).trimEnd()} (${randomUUID().slice(0, 6)})`;
  }

  async function assertExperimentalConnectorSetupEnabled(provider: unknown, existing = false) {
    const app = typeof provider === "string" ? getConnectableAppDefinition(provider) : null;
    if (!app?.experimentalFeatureKey && (existing || !isMemoryConnectorId(provider))) return;
    const settings = await instanceSettingsService(db).getExperimental();
    if (app && !isConnectorFeatureEnabled(app, settings)) {
      throw forbidden(`${app.name} is unavailable on this instance`, { code: "connector_disabled" });
    }
    if (!existing && isMemoryConnectorId(provider) && !settings.enableMemoryConnectors) {
      throw forbidden("Enable memory connectors in Settings → Experimental to set up this connection", { code: "memory_connectors_disabled" });
    }
  }

  async function assertConnectorConnectionSetupEnabled(connection: { config?: Record<string, unknown>; transportConfig?: Record<string, unknown>; applicationId?: string; companyId?: string; status?: string }, applicationKey?: unknown) {
    let resolvedApplicationKey = applicationKey;
    if (resolvedApplicationKey == null && connection.applicationId && connection.companyId) {
      const [application] = await db.select({ applicationKey: toolApplications.applicationKey })
        .from(toolApplications).where(and(eq(toolApplications.id, connection.applicationId),
          eq(toolApplications.companyId, connection.companyId))).limit(1);
      resolvedApplicationKey = application?.applicationKey;
    }
    const marker = connection.config?.sourceTemplateKey ?? connection.transportConfig?.sourceTemplateKey;
    const app = resolvedApplicationKey != null ? getAppDefinitionForApplicationKey(resolvedApplicationKey)
      : typeof marker === "string" ? getConnectableAppDefinition(marker) : null;
    if (app) await assertExperimentalConnectorSetupEnabled(app.slug, connection.status !== "draft");
  }

  async function connectGalleryApp(
    companyId: string,
    input: ConnectToolApp,
    actor?: ActorInfo,
  ): Promise<ConnectToolAppResult> {
    const definition = input.galleryKey
      ? getConnectableAppDefinition(input.galleryKey)
      : null;
    if (input.galleryKey && !definition)
      throw notFound("Tool app gallery entry not found");

    const galleryEntry = definition ? await appForConnectionSetup(definition) : null;

    let existingApplication: typeof toolApplications.$inferSelect | null = null;
    let requestedResumeConnection: typeof toolConnections.$inferSelect | null =
      null;
    const requestedConnectionId =
      input.resumeConnectionId ?? input.reconnectConnectionId;
    if (requestedConnectionId) {
      const [connection] = await db
        .select()
        .from(toolConnections)
        .where(
          and(
            eq(toolConnections.id, requestedConnectionId),
            eq(toolConnections.companyId, companyId),
          ),
        );
      if (!connection) throw notFound("Incomplete app connection not found");
      assertSupportedConnection(connection);
      if (input.resumeConnectionId && connection.status !== "draft") {
        throw conflict("Only an incomplete app connection can resume setup", {
          code: "connection_setup_not_incomplete",
        });
      }
      if (
        input.applicationId &&
        input.applicationId !== connection.applicationId
      ) {
        throw badRequest("The app and draft connection do not match");
      }
      const [application] = await db
        .select()
        .from(toolApplications)
        .where(
          and(
            eq(toolApplications.id, connection.applicationId),
            eq(toolApplications.companyId, companyId),
          ),
        );
      if (!application) throw notFound("App not found");
      const source =
        asRecord(connection.config).sourceTemplateKey ??
        asRecord(connection.transportConfig).sourceTemplateKey ??
        asRecord(application.metadata).sourceTemplateKey ??
        asRecord(application.metadata).source;
      if (
        input.reconnectConnectionId &&
        ((galleryEntry && source !== galleryEntry.slug) ||
          (!galleryEntry &&
            typeof source === "string" &&
            getConnectableAppDefinition(source)))
      ) {
        throw badRequest("Reconnect must preserve the configured provider");
      }
      requestedResumeConnection = connection;
      existingApplication = application;
    } else if (input.applicationId) {
      const [row] = await db
        .select()
        .from(toolApplications)
        .where(
          and(
            eq(toolApplications.id, input.applicationId),
            eq(toolApplications.companyId, companyId),
          ),
        );
      if (!row) throw notFound("App not found");
      existingApplication = row;
    } else {
      // Removal and interrupted setup intentionally retain their
      // application/connection rows. A fresh gallery click has no
      // applicationId, so recover that retained identity by its company-unique
      // name and source instead of inserting a duplicate application that the
      // unique index rejects. Active applications are excluded: connecting a
      // second account still requires its own name/application identity.
      const requestedName =
        input.name ?? galleryEntry?.name ?? defaultLinkName(input.link ?? "");
      const recoverableApplicationStatuses = galleryEntry
        ? (["draft", "archived"] as const)
        : (["archived"] as const);
      const [recoverableApplication] = await db
        .select()
        .from(toolApplications)
        .where(
          and(
            eq(toolApplications.companyId, companyId),
            eq(toolApplications.name, requestedName),
            inArray(toolApplications.status, recoverableApplicationStatuses),
          ),
        )
        .orderBy(desc(toolApplications.updatedAt))
        .limit(1);
      const recoverableSource = recoverableApplication?.metadata
        ? (recoverableApplication.metadata.sourceTemplateKey ??
          recoverableApplication.metadata.galleryKey ??
          recoverableApplication.metadata.source)
        : null;
      const requestedSource =
        galleryEntry?.slug ?? (input.link ? "link" : null);
      if (
        recoverableApplication &&
        requestedSource &&
        recoverableSource === requestedSource
      ) {
        existingApplication = recoverableApplication;
      }
    }

    await assertConnectorConnectionSetupEnabled(requestedResumeConnection ?? {}, existingApplication?.applicationKey);
    const requestedName =
      input.name ??
      existingApplication?.name ??
      galleryEntry?.name ??
      defaultLinkName(input.link ?? "");
    // Compatibility for the original Sheets robot flow, whose clients predate
    // method selection and identify the method by its spreadsheet allowlist.
    const inferredMethodKey =
      !input.connectionMethodKey &&
      galleryEntry?.slug === "google-sheets" &&
      Array.isArray(input.configValues?.allowedSpreadsheetIds)
        ? "local"
        : input.connectionMethodKey;
    if (!galleryEntry && input.connectionMethodKey)
      throw badRequest("Connection method selection requires a gallery app");
    if (
      galleryEntry &&
      getAvailableConnectionMethods(galleryEntry).filter(
        (candidate) =>
          candidate.purpose !== "channel" && candidate.purpose !== "ai"
          && candidate.transport !== "chat_sdk" && candidate.transport !== "runtime_auth",
      ).length > 1 &&
      !inferredMethodKey
    ) {
      throw badRequest("Choose a connection method for this app");
    }
    const method = galleryEntry
      ? connectionMethodFor(galleryEntry, inferredMethodKey)
      : null;
    const remoteMcpConnector = isRemoteMcpConnectorMethod(galleryEntry?.slug, method?.key);
    await assertExperimentalConnectorSetupEnabled(galleryEntry?.slug, Boolean(
      input.reconnectConnectionId && requestedResumeConnection?.status !== "draft"
      && requestedResumeConnection?.config.sourceTemplateKey === galleryEntry?.slug,
    ));
    if (galleryEntry && input.link) {
      const acceptsProviderGeneratedUrl =
        method?.transport === "mcp_remote" &&
        method.auth === "none" &&
        !method.defaults?.serverUrl &&
        !method.defaults?.serverUrlTemplate;
      if (!acceptsProviderGeneratedUrl && !remoteMcpConnector) {
        throw badRequest(
          `${galleryEntry.name} does not accept a provider-generated connection URL`,
        );
      }
      if (!(remoteMcpConnector && galleryEntry.slug === "executor") && !getAppDefinitionForUrl(input.link, [galleryEntry])) {
        throw badRequest(
          `That connection URL does not belong to ${galleryEntry.name}`,
        );
      }
    }
    if (requestedResumeConnection && galleryEntry) {
      const storedConnectionSource =
        requestedResumeConnection.config?.sourceTemplateKey ??
        requestedResumeConnection.transportConfig?.sourceTemplateKey;
      const storedApplicationSource =
        existingApplication?.metadata?.sourceTemplateKey ??
        existingApplication?.metadata?.galleryKey;
      if (
        storedConnectionSource !== galleryEntry.slug &&
        storedApplicationSource !== galleryEntry.slug
      ) {
        throw badRequest(
          "The selected provider does not match this incomplete connection",
        );
      }
    }
    // Reconnect is not a second identity decision. Removed connections retain
    // their row precisely so the next credential can be attached to the same
    // identity and history. Resolve that retained row before interpreting the
    // request so a client default cannot silently turn a personal connection
    // into an organization connection (or vice versa).
    const canResumeInterruptedDraft =
      Boolean(requestedResumeConnection) ||
      (!input.applicationId &&
        Boolean(galleryEntry) &&
        existingApplication?.status === "draft");
    const retainedConnectionStatuses = canResumeInterruptedDraft
      ? (["draft", "archived"] as const)
      : (["archived"] as const);
    const [recoveredConnection] =
      !requestedResumeConnection && existingApplication
        ? await db
            .select()
            .from(toolConnections)
            .where(
              and(
                eq(toolConnections.companyId, companyId),
                eq(toolConnections.applicationId, existingApplication.id),
                inArray(toolConnections.status, retainedConnectionStatuses),
              ),
            )
            .orderBy(desc(toolConnections.updatedAt))
            .limit(1)
        : [undefined];
    const retainedConnection = requestedResumeConnection ?? recoveredConnection;
    let applicationName = existingApplication?.name ?? requestedName;
    let name = retainedConnection?.name ?? requestedName;
    if (!existingApplication) {
      const applicationNames = await db
        .select({ name: toolApplications.name })
        .from(toolApplications)
        .where(eq(toolApplications.companyId, companyId));
      applicationName = nextAvailableConnectionName(
        requestedName,
        applicationNames.map((row) => row.name),
      );
      name = applicationName;
    } else if (!retainedConnection) {
      const connectionNames = await db
        .select({ name: toolConnections.name })
        .from(toolConnections)
        .where(
          and(
            eq(toolConnections.companyId, companyId),
            eq(toolConnections.applicationId, existingApplication.id),
          ),
        );
      name = nextAvailableConnectionName(
        requestedName,
        connectionNames.map((row) => row.name),
      );
    }
    const previousGrantKind: ConnectionGrantKind | null = retainedConnection
      ? retainedConnection.credentialPolicy === "per_user"
        ? "user"
        : retainedConnection.credentialPolicy === "per_agent"
          ? "agent"
          : "organization"
      : null;
    // An explicit resume/application reconnect continues the retained identity.
    // A fresh gallery connect may still reuse an archived row for stable history
    // and company-unique naming, but an explicit Access choice is a new identity
    // decision and must replace the archived policy. Without this distinction,
    // removing a dedicated-agent connection and reconnecting the default personal
    // account leaves `per_agent` behind and the OAuth callback cannot persist its
    // user grant.
    const retainsIdentity = Boolean(
      retainedConnection &&
      (retainedConnection.status === "draft" ||
        requestedResumeConnection ||
        input.applicationId),
    );
    const retainedGrantKind = retainsIdentity ? previousGrantKind : null;
    // The route can authorize an explicit resume before entering the service,
    // but name/source recovery happens here. Do not let a caller submit a
    // personal grant choice to pass the route and then inherit an implicitly
    // recovered organization identity. Local implicit mode is already the
    // unrestricted instance operator; every authenticated user must still hold
    // current connection-manager authority before this retained row is touched.
    if (
      previousGrantKind &&
      input.grantKind &&
      previousGrantKind !== input.grantKind &&
      actor?.actorType === "user" &&
      actor.actorSource !== "local_implicit"
    ) {
      const actorUserId = actor.actorId;
      const [membership] = actorUserId
        ? await db
            .select({
              membershipRole: companyMemberships.membershipRole,
            })
            .from(companyMemberships)
            .where(
              and(
                eq(companyMemberships.companyId, companyId),
                eq(companyMemberships.principalType, "user"),
                eq(companyMemberships.principalId, actorUserId),
                eq(companyMemberships.status, "active"),
              ),
            )
            .limit(1)
        : [];
      const roleCanManage =
        membership?.membershipRole === "owner" ||
        membership?.membershipRole === "admin";
      const [explicitManagerGrant] =
        roleCanManage || !actorUserId
          ? []
          : await db
              .select({
                id: principalPermissionGrants.id,
              })
              .from(principalPermissionGrants)
              .where(
                and(
                  eq(principalPermissionGrants.companyId, companyId),
                  eq(principalPermissionGrants.principalType, "user"),
                  eq(principalPermissionGrants.principalId, actorUserId),
                  eq(
                    principalPermissionGrants.permissionKey,
                    "tools:manage_connections",
                  ),
                ),
              )
              .limit(1);
      if (!roleCanManage && !explicitManagerGrant) {
        throw forbidden(
          "Only a company owner, admin, or member with connection-manager permission can change this connection's credential identity.",
        );
      }
    }
    const requestedGrantKind =
      retainedGrantKind ?? input.grantKind ?? (method?.grantKinds?.length === 1 ? method.grantKinds[0]! : "organization");
    if (method?.grantKinds && !method.grantKinds.includes(requestedGrantKind)) {
      throw badRequest(
        `${galleryEntry?.name ?? "This app"} supports only ${method.grantKinds.join(" or ")} credentials`,
      );
    }
    const dedicatedAgentId =
      requestedGrantKind === "agent" ? (input.subjectAgentId ?? null) : null;
    if (dedicatedAgentId) {
      const [subjectAgent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(
          and(eq(agents.id, dedicatedAgentId), eq(agents.companyId, companyId)),
        )
        .limit(1);
      if (!subjectAgent)
        throw badRequest(
          "Dedicated GitHub identity requires an agent in this company",
        );
    }
    const transport = method?.transport ?? "mcp_remote";
    const credentialSource: ToolConnectionCredentialSource =
      input.credentialSource ?? "paperclip_vault";
    if (
      retainedConnection &&
      retainedConnection.credentialSource !== credentialSource
    ) {
      throw conflict(
        "Changing credential source requires a new app connection",
        {
          code: "credential_source_migration_not_supported",
        },
      );
    }
    let externalCredential: VercelConnectCredentialReference | null = null;
    if (credentialSource === "vercel_connect") {
      const integration = vercelConnectIntegrationStatus();
      if (!integration.enabled || !integration.configured || !vercelConnect) {
        throw unprocessable(
          "Vercel Connect setup is not available on this Paperclip instance",
          {
            code: "vercel_connect_unavailable",
          },
        );
      }
      if (
        !galleryEntry ||
        !method ||
        method.transport !== "mcp_remote" ||
        method.auth === "none"
      ) {
        throw badRequest(
          "Vercel Connect is available only for reviewed remote MCP app methods",
        );
      }
      const reviewed = method.credentialSources?.vercelConnect;
      if (!reviewed) {
        throw unprocessable(
          `${galleryEntry.name} has not been reviewed for Vercel Connect`,
          {
            code: "vercel_connect_method_not_reviewed",
          },
        );
      }
      const expectedPrincipalMode = method.auth === "oauth" ? "user" : "app";
      if (!reviewed.principalModes.includes(expectedPrincipalMode)) {
        throw unprocessable(
          "This connector principal mode has not been reviewed for this app",
          {
            code: "vercel_connect_principal_not_reviewed",
          },
        );
      }
      if (
        expectedPrincipalMode === "app" &&
        requestedGrantKind !== "organization"
      ) {
        throw badRequest(
          "App-subject Vercel connectors can only back an organization identity",
        );
      }
      let metadata;
      try {
        metadata = await vercelConnect.getConnectorMetadata(
          input.vercelConnect!.connector,
        );
      } catch (error) {
        throw vercelConnectHttpError(error);
      }
      const service = metadata.service.trim().toLowerCase();
      if (
        !reviewed.services.map((value) => value.toLowerCase()).includes(service)
      ) {
        throw badRequest(
          `That Vercel connector is for ${metadata.service}, not ${galleryEntry.name}`,
          {
            code: "vercel_connect_service_mismatch",
          },
        );
      }
      if (expectedPrincipalMode === "app") {
        const [connectorInUse] = await db
          .select({ id: toolConnections.id })
          .from(toolConnections)
          .where(
            and(
              eq(toolConnections.credentialSource, "vercel_connect"),
              ne(toolConnections.status, "archived"),
              sql`${toolConnections.externalCredential}->>'connectorUid' = ${metadata.uid}`,
              ...(retainedConnection
                ? [ne(toolConnections.id, retainedConnection.id)]
                : []),
            ),
          )
          .limit(1);
        if (connectorInUse) {
          throw conflict(
            "App-subject Vercel connectors are dedicated to one Paperclip connection. Create or attach a separate connector in Vercel.",
            {
              code: "vercel_connect_app_connector_in_use",
            },
          );
        }
      }
      externalCredential = {
        provider: "vercel_connect",
        connectorId: metadata.id,
        connectorUid: metadata.uid,
        service: metadata.service,
        connectorType: metadata.type,
        principalMode: expectedPrincipalMode,
        headerName: reviewed.header.name,
        headerPrefix: reviewed.header.prefix ?? null,
        scopes: [...reviewed.scopes],
      };
    }
    const isGoogleSheetsRobotMethod =
      galleryEntry?.slug === GOOGLE_SHEETS_GALLERY_KEY &&
      method?.key === "local";
    const normalizedMethodConfig =
      isGoogleSheetsRobotMethod || !method
        ? null
        : normalizeConnectionMethodConfig(method, input.configValues ?? asRecord(asRecord(retainedConnection?.config).methodConfig));
    const remoteUrlCredential =
      transport === "mcp_remote" && input.link
        ? splitRemoteUrlCredential(input.link)
        : null;
    const baseConfig =
      (transport === "mcp_remote" || transport === "rest_api")
        ? {
            url:
              (remoteMcpConnector ? remoteUrlCredential?.publicUrl : undefined) ??
              normalizedMethodConfig?.url ??
              method?.defaults?.serverUrl ??
              remoteUrlCredential?.publicUrl ??
              input.link ??
              "",
          }
        : { templateId: method?.defaults?.templateKey };
    let config: Record<string, unknown> = galleryEntry
      ? {
          ...baseConfig,
          sourceTemplateKey: galleryEntry.slug,
          connectionMethodKey: method?.key,
          methodConfig: normalizedMethodConfig?.values ?? {},
          ...(method?.defaults?.mcpSessionRequired === true
            ? { mcpSessionRequired: true }
            : {}),
          // Grant-backed setup keeps the full discovered catalog selectable;
          // the wizard projects the app's action defaults into policies at
          // finish time instead of using catalog quarantine as access state.
          quarantineNewEntries: ["railway", "enterpret", "daytona"].includes(galleryEntry.slug),
          ...(remoteMcpConnector ? {
            mcpSessionRequired: true,
            mcpAuthMode: input.authMode ?? "auto",
            mcpPreserveAccess: Boolean(retainedConnection && (retainedConnection.status === "active" || asRecord(retainedConnection.config).mcpPreserveAccess === true)),
          } : {}),
          ...(galleryEntry.slug === "posthog" ? { safeDefault: true } : {}),
          // Telem.AI attributes each search to the Paperclip company, agent,
          // run and issue, so its catalog connection forwards those context
          // headers by default (the gateway still drops empty values). A
          // reconnect keeps the policy the operator saved on the connection.
          ...(galleryEntry.slug === "telem"
            ? {
                headerPolicy: asRecord(retainedConnection?.config).headerPolicy ?? {
                  metadata: {
                    forward: ["company_id", "issue_id", "agent_id", "run_id", "project_id", "correlation_id"],
                  },
                },
              }
            : {}),
        }
      : { ...baseConfig, quarantineNewEntries: false, unverifiedServer: true };
    if (method && isPaperclipCloudConnectorStrategy(method.oauthStrategy)) {
      const connectorProfile = method.connectorProfile;
      const profile = managedConnectorProfile(connectorProfile);
      if (!profile)
        throw badRequest("This app has an invalid managed connector profile");
      config.oauth = {
        strategy: method.oauthStrategy,
        provider: profile.provider,
        connectorProfile: profile.id,
        resource: method.defaults?.serverUrl,
        scopes: [...profile.scopes],
      };
      config.quarantineNewEntries = true;
    }
    const acceptsCustomerOAuthClient =
      remoteMcpConnector || (method?.auth === "oauth" && method.ownershipModes.includes("customer"));
    if (galleryEntry && input.oauthClient && !acceptsCustomerOAuthClient) {
      throw badRequest(
        `${galleryEntry.name} does not accept customer-owned OAuth client credentials`,
      );
    }
    // A pasted URL or an explicitly customer-owned curated method may arrive
    // with a client the operator preregistered in the provider's console. Record
    // the client id now; the secret becomes an encrypted Paperclip secret below.
    if (input.oauthClient) {
      config.oauth = {
        clientId: input.oauthClient.clientId.trim(),
        clientRegistrationSource:
          "manual" satisfies OAuthClientRegistrationSource,
        clientCompanyId: companyId,
      };
    }
    if (isGoogleSheetsRobotMethod) {
      const availability = googleSheetsRobotEmailFromEnv();
      if (!availability.available) {
        throw unprocessable(availability.reason, {
          code: "google_sheets_unavailable",
        });
      }
      const allowedSpreadsheetIds = googleSheetsAllowedSpreadsheetIds(
        input.configValues,
      );
      if (allowedSpreadsheetIds.length === 0) {
        throw badRequest("Paste at least one Google Sheets link.");
      }
      config.allowedSpreadsheetIds = allowedSpreadsheetIds;
      config.robotEmail = availability.robotEmail;
      config.env = {
        [GOOGLE_SHEETS_ALLOWED_SPREADSHEET_IDS_ENV]:
          allowedSpreadsheetIds.join(","),
      };
      config = normalizeGoogleSheetsConnectionConfig(config);
      await assertGoogleSheetsSpreadsheetOwnership(companyId, config);
    }
    if (transport === "mcp_remote")
      await assertRemoteConnectionEndpointsAllowed(config);
    if (transport === "local_stdio") await stdioTemplateId(companyId, config);
    assertLocalStdioCanBeEnabled(transport, false);

    const credentialValues = input.credentialValues ?? {};
    // A curated method declares its auth kind. A pasted URL declares one only
    // under Advanced authentication; on the simple path it starts from what the
    // operator supplied and is upgraded to `oauth` when discovery proves the
    // endpoint needs sign-in (see `remoteTools` and `startOAuth`).
    const genericAuthKind: ToolConnectionAuthKind =
      (remoteMcpConnector ? undefined : method?.auth) ??
      (input.authMode === "oauth" || input.oauthClient
        ? "oauth"
        : input.authMode === "bearer" || input.authMode === "custom_headers"
          ? "api_key"
          : input.authMode === "none"
            ? "none"
            : Object.keys(credentialValues).length > 0
              ? "api_key"
              : "none");
    const credentialSecretRefs: CreateToolConnection["credentialSecretRefs"] =
      [];
    const credentialRefs: McpConnectionCredentialRef[] = [];
    const createdSecretIds: string[] = [];
    const createdDefinitionIds: string[] = [];
    // "Just me" needs a named board user to own the consent. An agent actor
    // cannot hold a personal identity, and silently falling back to a shared
    // credential is exactly the mis-scoping the design forbids, so refuse.
    const personalIdentityUserId =
      requestedGrantKind === "user"
        ? actor?.actorType === "user" && actor.actorId
          ? actor.actorId
          : null
        : null;
    if (requestedGrantKind === "user" && !personalIdentityUserId) {
      throw badRequest(
        "Connecting an app as yourself requires a signed-in user",
      );
    }
    const retainedPersonalIdentity =
      retainedConnection?.credentialPolicy === "per_user"
        ? await fixedPersonalIdentityForReconnect(
            retainedConnection,
            personalIdentityUserId ?? undefined,
            actor,
          )
        : null;
    const retainedConfig = asRecord(retainedConnection?.config);
    const retainedMethodKey = retainedConfig.connectionMethodKey;
    const retainedSource =
      retainedConfig.sourceTemplateKey ??
      asRecord(retainedConnection?.transportConfig).sourceTemplateKey;
    // Setup forms never receive stored secret values. Treat an omitted value as
    // "keep the existing secret" only while resuming the exact same curated
    // provider and method. This prevents a retry from detaching a client secret
    // or API key, without carrying credentials across a method/provider change.
    const canRetainCredentialMaterial = Boolean(
      retainedConnection &&
      previousGrantKind === requestedGrantKind &&
      galleryEntry &&
      retainedSource === galleryEntry.slug &&
      retainedMethodKey === method?.key &&
      (!remoteMcpConnector || (baseConfig.url === retainedConfig.url && genericAuthKind === retainedConnection.authKind)),
    );
    const retainedCredentialSecretRefs = canRetainCredentialMaterial
      ? (retainedPersonalIdentity?.grant?.credentialSecretRefs ??
        retainedConnection?.credentialSecretRefs ??
        [])
      : [];
    const credentialPolicy: ToolConnectionCredentialPolicy =
      requestedGrantKind === "user"
        ? "per_user"
        : requestedGrantKind === "agent"
          ? "per_agent"
          : "shared";
    const connectionOwnership = isPaperclipCloudConnectorStrategy(
      method?.oauthStrategy,
    )
      ? "platform_shared"
      : "customer";
    let applicationRow: typeof toolApplications.$inferSelect | null = null;
    let connectionRow: typeof toolConnections.$inferSelect | null = null;
    let revivedConnectionPrevious: typeof toolConnections.$inferSelect | null =
      retainedConnection ?? null;
    let revivedGrantMutation: {
      previous: typeof connectionGrants.$inferSelect | null;
      current: typeof connectionGrants.$inferSelect;
    } | null = null;
    let personalPublicSetupEstablished = false;

    try {
      const credentialFields =
        credentialSource === "vercel_connect"
          ? []
          : galleryEntry && !remoteMcpConnector
            ? credentialFieldsFor(galleryEntry, method?.key)
            : linkCredentialFields({ ...Object.fromEntries(retainedCredentialSecretRefs.filter((ref) => ref.configPath.startsWith("headers.") || ref.configPath === "credentials.authorization").map((ref) => [ref.configPath, "retained"])), ...credentialValues });
      for (const field of credentialFields) {
        const value = credentialValues[field.configPath];
        const retainedSecretRef = retainedCredentialSecretRefs.find(
          (ref) => ref.configPath === field.configPath,
        );
        if (!value && retainedSecretRef) {
          credentialSecretRefs.push(retainedSecretRef);
          if (field.placement === "header" && field.key) {
            credentialRefs.push({
              name: field.configPath,
              secretId: retainedSecretRef.secretId,
              version: retainedSecretRef.versionSelector ?? "latest",
              placement: "header",
              key: field.key,
              prefix: field.prefix ?? null,
            });
          }
          continue;
        }
        if (!value && field.required !== false) {
          throw badRequest(`Missing credential value for ${field.configPath}`);
        }
        if (!value) continue;
        const written = await db.transaction((tx) => writeConnectionCredential(tx, {
          companyId, connectionName: name, configPath: field.configPath,
          label: field.label, value, ownerUserId: personalIdentityUserId,
          actor: actorForSecret(actor),
        }));
        const { secret } = written;
        if (written.definitionId) createdDefinitionIds.push(written.definitionId);
        createdSecretIds.push(secret.id);
        credentialSecretRefs.push({
          secretId: secret.id,
          versionSelector: "latest",
          configPath: field.configPath,
          required: field.required ?? true,
          label: field.label,
        });
        if (field.placement === "header" && field.key) {
          credentialRefs.push({
            name: field.configPath,
            secretId: secret.id,
            version: "latest",
            placement: "header",
            key: field.key,
            prefix: field.prefix ?? null,
          });
        }
      }

      if (!remoteUrlCredential?.secretUrl && canRetainCredentialMaterial && baseConfig.url === retainedConfig.url) {
        const retainedUrl = retainedCredentialSecretRefs.find((ref) => ref.configPath === REMOTE_URL_SECRET_CONFIG_PATH);
        if (retainedUrl) {
          credentialSecretRefs.push(retainedUrl);
          credentialRefs.push({ name: REMOTE_URL_SECRET_CONFIG_PATH, secretId: retainedUrl.secretId, version: retainedUrl.versionSelector ?? "latest", placement: "url", key: "url", prefix: null });
        }
      }
      if (remoteUrlCredential?.secretUrl) {
        const written = await db.transaction((tx) => writeConnectionCredential(tx, {
          companyId, connectionName: name, configPath: REMOTE_URL_SECRET_CONFIG_PATH,
          label: "MCP server URL", value: remoteUrlCredential.secretUrl!,
          ownerUserId: personalIdentityUserId, actor: actorForSecret(actor),
        }));
        const { secret } = written;
        if (written.definitionId) createdDefinitionIds.push(written.definitionId);
        createdSecretIds.push(secret.id);
        credentialSecretRefs.push({
          secretId: secret.id,
          versionSelector: "latest",
          configPath: REMOTE_URL_SECRET_CONFIG_PATH,
          required: true,
          label: "MCP server URL",
        });
        credentialRefs.push({
          name: REMOTE_URL_SECRET_CONFIG_PATH,
          secretId: secret.id,
          version: "latest",
          placement: "url",
          key: "url",
          prefix: null,
        });
      }

      // A preregistered OAuth client secret is not a request header — it is only
      // ever sent to the token endpoint — so it gets a secret ref with no
      // credential ref, keeping it out of `projectedConnectionHeaders`.
      if (input.oauthClient?.clientSecret) {
        const secret = await secrets.create(
          companyId,
          {
            name: `${name} OAuth client secret ${randomUUID().slice(0, 8)}`,
            key: `tool_app.${randomUUID()}.oauth_client_secret`,
            provider: "local_encrypted",
            value: input.oauthClient.clientSecret,
            description: `OAuth client secret for ${name}.`,
          },
          actorForSecret(actor),
        );
        createdSecretIds.push(secret.id);
        credentialSecretRefs.push({
          secretId: secret.id,
          versionSelector: "latest",
          configPath: "oauth.client_secret",
          required: false,
          label: "OAuth client secret",
        });
      } else if (input.oauthClient) {
        const retainedOAuth = asRecord(retainedConfig.oauth);
        const clientIdUnchanged =
          retainedOAuth.clientId === input.oauthClient.clientId.trim();
        const retainedClientSecretRef = clientIdUnchanged
          ? retainedCredentialSecretRefs.find(
              (ref) => ref.configPath === "oauth.client_secret",
            )
          : undefined;
        if (retainedClientSecretRef)
          credentialSecretRefs.push(retainedClientSecretRef);
      }

      const safeApplicationDescription =
        galleryEntry?.description ??
        `Connected app at ${remoteUrlCredential?.publicUrl ?? input.link}`;
      if (existingApplication) {
        if (existingApplication.status !== "active") {
          [applicationRow] = await db
            .update(toolApplications)
            .set({
              status: "draft",
              archivedAt: null,
              ...(!galleryEntry
                ? { description: safeApplicationDescription }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(toolApplications.id, existingApplication.id))
            .returning();
        } else {
          applicationRow = existingApplication;
        }
      } else {
        // Name selection is optimistic because multiple setup requests can
        // legitimately begin at the same time. The company/name unique index
        // is the authority: if another request wins after our read, refresh the
        // names and retry with the next suffix instead of surfacing a conflict
        // the user never asked to resolve.
        for (let attempt = 0; attempt < 10 && !applicationRow; attempt += 1) {
          try {
            [applicationRow] = await db
              .insert(toolApplications)
              .values({
                companyId,
                applicationKey: `app-gallery:${galleryEntry?.slug ?? "link"}:${randomUUID()}`,
                name: applicationName,
                description: safeApplicationDescription,
                type: transport === "rest_api" && ["browser-use-cloud", "daytona"].includes(galleryEntry?.slug ?? "") ? "rest_api" : transport === "mcp_remote" ? "mcp_http" : "mcp_stdio",
                status: "draft",
                metadata: galleryEntry
                  ? {
                      sourceTemplateKey: galleryEntry.slug,
                      galleryKey: galleryEntry.slug,
                    }
                  : { source: "link" },
              })
              .returning();
          } catch (error) {
            if (!isUniqueViolation(error, "tool_applications_company_name_uq"))
              throw error;
            const applicationNames = await db
              .select({ name: toolApplications.name })
              .from(toolApplications)
              .where(eq(toolApplications.companyId, companyId));
            applicationName = nextAvailableConnectionName(
              requestedName,
              applicationNames.map((row) => row.name),
            );
            name = applicationName;
          }
        }
        if (!applicationRow) {
          throw conflict(
            "Paperclip could not allocate a unique connection name",
            {
              code: "tool_access_name_allocation_exhausted",
            },
          );
        }
      }

      await assertSecretRefs(companyId, [
        ...credentialRefs,
        ...credentialSecretRefs,
      ]);
      // Reconnecting an app revives its most recent archived connection instead
      // of inserting a fresh row: keeps the connection id (and its activity
      // history) stable and avoids the unique (company, name) constraint.
      // A personal credential never becomes the connection's shared secret: the
      // row carries the header shape only, and the secret refs go to the user
      // grant below. `ensureDefaultOrganizationGrant` copies this list, so
      // leaving it empty is what keeps the secret off an organization grant.
      const connectionCredentialSecretRefs =
        personalIdentityUserId || dedicatedAgentId ? [] : credentialSecretRefs;
      if (revivedConnectionPrevious) {
        forgetMcpHttpSessions(revivedConnectionPrevious.id);
        [connectionRow] = await db
          .update(toolConnections)
          .set({
            name,
            authKind: genericAuthKind,
            transport,
            status: "draft",
            enabled: false,
            agentInstructions: input.agentInstructions !== undefined
              ? input.agentInstructions
              : retainedConnection ? retainedConnection.agentInstructions
              : defaultConnectionAgentInstructions(galleryEntry?.agentInstructions),
            config,
            transportConfig: config,
            credentialRefs,
            credentialSecretRefs: connectionCredentialSecretRefs,
            credentialSource,
            externalCredential,
            credentialPolicy,
            updatedAt: new Date(),
          })
          .where(eq(toolConnections.id, revivedConnectionPrevious.id))
          .returning();
      } else {
        const connectionId = randomUUID();
        [connectionRow] = await db
          .insert(toolConnections)
          .values({
            id: connectionId,
            companyId,
            applicationId: applicationRow.id,
            name,
            uid: connectionUid(
              applicationRow.applicationKey ?? applicationRow.name,
              name,
              connectionId,
            ),
            connectionKind: "managed",
            ownership: connectionOwnership,
            authKind: genericAuthKind,
            credentialSource,
            externalCredential,
            transport,
            status: "draft",
            enabled: false,
            agentInstructions: input.agentInstructions !== undefined
              ? input.agentInstructions
              : retainedConnection ? retainedConnection.agentInstructions
              : defaultConnectionAgentInstructions(galleryEntry?.agentInstructions),
            config,
            transportConfig: config,
            credentialRefs,
            credentialSecretRefs: connectionCredentialSecretRefs,
            credentialPolicy,
            createdByAgentId:
              actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
            createdByUserId:
              actor?.actorType === "user" ? (actor.actorId ?? null) : null,
          })
          .returning();
      }
      if (revivedConnectionPrevious) {
        emitConnectionUpdated(
          connectionRow,
          revivedConnectionPrevious,
          "gallery",
        );
      } else {
        emitConnectionCreated(connectionRow, "gallery");
      }
      if (personalIdentityUserId) {
        // "Just me" (PAP-17835 seam #4). The credential is committed straight to
        // the caller's own grant; the connection row keeps only the header
        // *shape* in `credentialRefs` (which the gateway reads for placement and
        // then resolves against the acting user's grant) and no shared secret
        // refs at all. Two consequences the design requires:
        //  - `ensureDefaultOrganizationGrant` is skipped, so no organization
        //    grant is created first and later "moved" to a user grant. It stays
        //    absent until someone explicitly connects an organization identity,
        //    which is what makes "Organization identity · Not connected"
        //    truthful rather than a silent fallback.
        //  - the credential never lands in `connection.credentialSecretRefs`,
        //    which is what an organization grant would have copied.
        //
        // OAuth is the exception: no credential exists yet at connect time, and
        // the callback upserts this same (connection, user, subject) grant with
        // the tokens. Pre-creating an empty `active` grant there would render as
        // "Connected" with nothing behind it, so the grant is left to the
        // callback and only the organization grant is suppressed.
        if (credentialSecretRefs.length > 0) {
          let changedGrant: typeof connectionGrants.$inferSelect;
          let previousGrant: typeof connectionGrants.$inferSelect | null = null;
          if (retainedPersonalIdentity?.grant) {
            const [grantSnapshot] = await db
              .select({
                grant: connectionGrants,
                // Preserve PostgreSQL microseconds for the optimistic update;
                // a JavaScript Date truncates them and falsely reports a race.
                updatedAtVersion: sql<string>`${connectionGrants.updatedAt}::text`,
              })
              .from(connectionGrants)
              .where(eq(connectionGrants.id, retainedPersonalIdentity.grant.id))
              .limit(1);
            const currentGrant = grantSnapshot?.grant;
            if (!currentGrant)
              throw conflict(
                "The personal credential changed during setup. Please try again.",
              );
            previousGrant = currentGrant;
            [changedGrant] = await db
              .update(connectionGrants)
              .set({
                credentialSecretRefs,
                status: "active",
                revokedAt: null,
                revokedByAgentId: null,
                revokedByUserId: null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(connectionGrants.id, currentGrant.id),
                  sql`${connectionGrants.updatedAt} = ${grantSnapshot!.updatedAtVersion}::timestamptz`,
                ),
              )
              .returning();
            if (!changedGrant)
              throw conflict(
                "The personal credential changed during setup. Please try again.",
              );
          } else {
            [changedGrant] = await db
              .insert(connectionGrants)
              .values({
                companyId,
                connectionId: connectionRow.id,
                kind: "user",
                subjectUserId: personalIdentityUserId,
                credentialSecretRefs,
                status: "active",
                isDefault: false,
                createdByUserId: personalIdentityUserId,
              })
              .returning();
            if (!changedGrant)
              throw new Error("Failed to create personal connection grant");
          }
          if (revivedConnectionPrevious) {
            revivedGrantMutation = {
              previous: previousGrant,
              current: changedGrant,
            };
          }
          await db.insert(toolAccessAuditEvents).values({
            companyId,
            connectionId: connectionRow.id,
            actorType: "user",
            actorId: personalIdentityUserId,
            action: retainedPersonalIdentity?.grant
              ? "connection_grant.updated"
              : "connection_grant.created",
            outcome: "success",
            reasonCode: retainedPersonalIdentity?.grant
              ? "personal_identity_reconnected"
              : "personal_identity_created",
            details: {
              kind: "user",
              credentialSecretRefCount: credentialSecretRefs.length,
            },
          });
        }
      } else if (dedicatedAgentId) {
        // Managed OAuth creates the credential-bearing grant in the callback.
        // Keep the connection free of organization secrets from the outset.
      } else {
        const organizationGrant = await ensureDefaultOrganizationGrant(
          connectionRow,
          db,
          revivedConnectionPrevious
            ? (mutation) => {
                revivedGrantMutation = mutation;
              }
            : undefined,
        );
        if (credentialSource === "vercel_connect") {
          const derived = deriveVercelConnectSubject({
            credential: externalCredential!,
            connectionId: connectionRow.id,
            companyId,
            grantKind: "organization",
          });
          const updatedOrganizationGrant = await db.transaction(async (tx) => {
            const [lockedGrant] = await tx
              .select()
              .from(connectionGrants)
              .where(eq(connectionGrants.id, organizationGrant.id))
              .limit(1)
              .for("update");
            if (
              !lockedGrant ||
              lockedGrant.updatedAt.getTime() !==
                organizationGrant.updatedAt.getTime()
            ) {
              throw conflict(
                "The organization credential changed during setup. Please try again.",
              );
            }
            const [updated] = await tx
              .update(connectionGrants)
              .set({
                externalCredential: {
                  provider: "vercel_connect",
                  subjectType: externalCredential!.principalMode,
                  ...(derived.subjectId
                    ? { subjectId: derived.subjectId }
                    : {}),
                },
                credentialSecretRefs: [],
                updatedAt: now(),
              })
              .where(eq(connectionGrants.id, organizationGrant.id))
              .returning();
            return updated;
          });
          if (!updatedOrganizationGrant) {
            throw conflict(
              "The organization credential changed during setup. Please try again.",
            );
          }
          if (revivedGrantMutation) {
            revivedGrantMutation = {
              previous: revivedGrantMutation.previous,
              current: updatedOrganizationGrant,
            };
          }
        }
      }
      await syncCredentialBindings(
        connectionRow,
        personalIdentityUserId || dedicatedAgentId ? credentialSecretRefs : [],
      );
      await ensureRuntimeSlot(connectionRow);

      if (input.saveDraft && remoteMcpConnector) {
        return { connectionId: connectionRow.id, application: toApplication(applicationRow), connection: toConnection(connectionRow),
          catalog: [], actions: { readOnly: [], canMakeChanges: [] }, suggestedDefaults: { access: "all_agents", askFirstRiskLevels: [] } };
      }
      if (galleryEntry && method?.auth === "oauth") {
        const suggestedDefaults = recommendedDefaultsForApp(
          galleryEntry,
          method.key,
        );
        return {
          connectionId: connectionRow.id,
          application: toApplication(applicationRow),
          connection: toConnection(connectionRow),
          catalog: [],
          actions: { readOnly: [], canMakeChanges: [] },
          suggestedDefaults: dedicatedAgentId
            ? { ...suggestedDefaults, access: { agentIds: [dedicatedAgentId] } }
            : suggestedDefaults,
          auth: { kind: "oauth", startUrl: null },
        };
      }

      // A pasted MCP URL starts with unknown auth. For a personal connection,
      // there is deliberately no empty active grant yet, so probe this one
      // creator-owned draft without credentials. A 401 can then discover OAuth
      // and leave grant creation to the callback; a public endpoint gets an
      // empty personal grant below so later catalog refreshes use the same
      // identity policy.
      const unauthenticatedPersonalProbe = Boolean(
        (!galleryEntry || remoteMcpConnector) &&
          genericAuthKind === "none" &&
          credentialSecretRefs.length === 0 &&
          personalIdentityUserId &&
          !retainedPersonalIdentity?.grant,
      );
      let health: ToolConnectionHealthCheckResult;
      try {
        health = await checkConnectionHealth(connectionRow.id, actor, {
          allowUnauthenticatedProbe: unauthenticatedPersonalProbe,
        });
      } catch (error) {
        if (
          (!galleryEntry || remoteMcpConnector) &&
          input.authMode !== "none" &&
          input.authMode !== "bearer" &&
          input.authMode !== "custom_headers" &&
          error instanceof HttpError &&
          asRecord(error.details).code === "oauth_challenge"
        ) {
          const [oauthConnection] = await db
            .select()
            .from(toolConnections)
            .where(eq(toolConnections.id, connectionRow.id));
          const endpoints = await discoverOAuthEndpoints(oauthConnection).catch(
            (discoveryError: unknown) => {
              // "This server advertised an address Paperclip refuses to open" is a
              // refusal, not a failed discovery: keep it instead of collapsing it
              // into the generic sign-in-required error.
              if (isOAuthEndpointRejection(discoveryError))
                throw discoveryError;
              return null;
            },
          );
          if (!endpoints) throw error;
          return {
            connectionId: oauthConnection.id,
            application: toApplication(applicationRow),
            connection: toConnection(oauthConnection),
            catalog: [],
            actions: { readOnly: [], canMakeChanges: [] },
            suggestedDefaults: {
              access: "all_agents",
              askFirstRiskLevels: [],
            },
            // The endpoint asked for authorization and discovery found a real
            // authorization server, so the wizard can offer "Sign in to
            // continue" instead of a dead end. The caller starts the flow and
            // fills in `startUrl`/`registrationSource`; it only needs the issuer
            // and resource here to show which server the operator is about to
            // trust.
            auth: {
              kind: "oauth",
              startUrl: null,
              issuer: endpoints.issuer ?? null,
              resource: endpoints.resource ?? null,
            },
          };
        }
        throw error;
      }
      if (unauthenticatedPersonalProbe) {
        const personalConnectionId = connectionRow.id;
        const grant = await db.transaction(async (tx) => {
          const [createdGrant] = await tx
            .insert(connectionGrants)
            .values({
              companyId,
              connectionId: personalConnectionId,
              kind: "user",
              subjectUserId: personalIdentityUserId!,
              credentialSecretRefs: [],
              status: "active",
              isDefault: false,
              createdByUserId: personalIdentityUserId!,
            })
            .onConflictDoNothing()
            .returning();
          if (createdGrant) {
            await tx.insert(toolAccessAuditEvents).values({
              companyId,
              connectionId: personalConnectionId,
              actorType: "user",
              actorId: personalIdentityUserId!,
              action: "connection_grant.created",
              outcome: "success",
              reasonCode: "personal_identity_created",
              details: { kind: "user", credentialSecretRefCount: 0 },
            });
          }
          return createdGrant;
        });
        if (!grant) {
          // Another setup attempt may have created this user's grant while
          // both probes were in flight. Reuse only an active personal grant;
          // never overwrite credentials, revive a revoked grant, or claim its
          // audit/rollback ownership in this attempt.
          const existingGrant = await vaultGrantForConnection(connectionRow, actor);
          if (existingGrant?.kind !== "user" || existingGrant.subjectUserId !== personalIdentityUserId) {
            throw conflict("The personal credential changed during setup. Please try again.");
          }
        }
        // A successful public probe establishes this identity, like OAuth
        // consent does. Keep its draft and grant if catalog/default discovery
        // later fails: another retry may already be using the committed grant.
        personalPublicSetupEstablished = true;
      }
      const restoreDraftDefaults = Boolean(revivedConnectionPrevious);
      const refreshOptions = {
        enableAllByDefault: restoreDraftDefaults && !remoteMcpConnector,
        restoreDraftDefaults,
      };
      const catalogConnectionId = connectionRow.id;
      // Keep the established public identity outside this transaction while
      // making catalog, defaults, and their audits one all-or-nothing step.
      const refresh: ToolCatalogRefreshResult = personalPublicSetupEstablished
        ? await db.transaction(async (tx): Promise<ToolCatalogRefreshResult> =>
            toolAccessService(tx as unknown as Db, options).refreshCatalog(
              catalogConnectionId,
              actor,
              refreshOptions,
            ),
          )
        : await refreshCatalog(catalogConnectionId, actor, refreshOptions);
      const [application] = await db
        .select()
        .from(toolApplications)
        .where(eq(toolApplications.id, applicationRow.id));
      return {
        connectionId: refresh.connection.id,
        application: toApplication(application),
        connection: refresh.connection,
        catalog: refresh.catalog,
        actions: groupedActions(refresh.catalog),
        suggestedDefaults: galleryEntry
          ? recommendedDefaultsForApp(galleryEntry, method?.key)
          : {
              access: "all_agents",
              askFirstRiskLevels: [],
            },
      };
    } catch (error) {
      if (personalPublicSetupEstablished) throw error;
      let identityRollbackError: unknown = null;
      let preserveConcurrentRevival = false;
      if (connectionRow && revivedConnectionPrevious) {
        const attemptedConnection = connectionRow;
        try {
          await db.transaction(async (tx) => {
            if (revivedGrantMutation) await tx.select({ id: connectionGrants.id }).from(connectionGrants)
              .where(and(eq(connectionGrants.id, revivedGrantMutation.current.id), eq(connectionGrants.companyId, companyId)))
              .for("update");
            const [latestConnection] = await tx
              .select()
              .from(toolConnections)
              .where(
                and(
                  eq(toolConnections.id, revivedConnectionPrevious.id),
                  eq(toolConnections.companyId, companyId),
                ),
              )
              .limit(1)
              .for("update");
            // Health/catalog failures from this setup may update only health
            // fields and `updatedAt`, so compare the identity/configuration
            // fields this attempt owned. If another request changed any of
            // those fields, its newer connection state is authoritative.
            const connectionMutationIsStillCurrent = Boolean(
              latestConnection &&
              connectionSetupMutationFingerprint(latestConnection) ===
                connectionSetupMutationFingerprint(attemptedConnection),
            );
            if (connectionMutationIsStillCurrent) {
              await tx
                .update(toolConnections)
                .set({
                  agentInstructions: revivedConnectionPrevious.agentInstructions,
                  name: revivedConnectionPrevious.name,
                  transport: revivedConnectionPrevious.transport,
                  status: revivedConnectionPrevious.status,
                  enabled: revivedConnectionPrevious.enabled,
                  config: revivedConnectionPrevious.config,
                  transportConfig: revivedConnectionPrevious.transportConfig,
                  credentialRefs: revivedConnectionPrevious.credentialRefs,
                  credentialSecretRefs:
                    revivedConnectionPrevious.credentialSecretRefs,
                  credentialSource: revivedConnectionPrevious.credentialSource,
                  externalCredential:
                    revivedConnectionPrevious.externalCredential,
                  credentialPolicy: revivedConnectionPrevious.credentialPolicy,
                  updatedAt: new Date(),
                })
                .where(eq(toolConnections.id, revivedConnectionPrevious.id));
            } else {
              preserveConcurrentRevival = true;
            }

            if (connectionMutationIsStillCurrent && revivedGrantMutation) {
              const { previous, current } = revivedGrantMutation;
              const [latestGrant] = await tx
                .select()
                .from(connectionGrants)
                .where(eq(connectionGrants.id, current.id))
                .limit(1)
                .for("update");
              const mutationIsStillCurrent = Boolean(
                latestGrant &&
                latestGrant.updatedAt.getTime() === current.updatedAt.getTime(),
              );
              // A grant manager may have changed this grant while provider
              // setup was in flight. Restore/delete only the exact version this
              // attempt wrote; a newer version is authoritative and remains
              // untouched.
              if (previous && mutationIsStillCurrent) {
                await tx
                  .update(connectionGrants)
                  .set({
                    kind: previous.kind,
                    subjectUserId: previous.subjectUserId,
                    subjectAgentId: previous.subjectAgentId,
                    providerTenant: previous.providerTenant,
                    credentialSecretRefs: previous.credentialSecretRefs,
                    externalCredential: previous.externalCredential,
                    status: previous.status,
                    isDefault: previous.isDefault,
                    createdByAgentId: previous.createdByAgentId,
                    createdByUserId: previous.createdByUserId,
                    revokedAt: previous.revokedAt,
                    revokedByAgentId: previous.revokedByAgentId,
                    revokedByUserId: previous.revokedByUserId,
                    lastUsedAt: previous.lastUsedAt,
                    updatedAt: previous.updatedAt,
                  })
                  .where(eq(connectionGrants.id, current.id));
              } else if (!previous && mutationIsStillCurrent) {
                await tx
                  .delete(connectionGrants)
                  .where(eq(connectionGrants.id, current.id));
              }
            }
          });
        } catch (rollbackError) {
          identityRollbackError = rollbackError;
          // The attempted identity and its grants may no longer agree. Keep the
          // connection unusable until a manager explicitly reconnects it, and
          // surface the restoration failure instead of returning only the
          // original provider error.
          try {
            await db
              .update(toolConnections)
              .set({
                status: "draft",
                enabled: false,
                healthStatus: "error",
                healthMessage:
                  "Connection identity restoration failed. Reconnect this app to continue.",
                lastError: "connection_identity_rollback_failed",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(toolConnections.id, revivedConnectionPrevious.id),
                  eq(toolConnections.companyId, companyId),
                ),
              );
          } catch (quarantineError) {
            identityRollbackError = new AggregateError(
              [rollbackError, quarantineError],
              "Connection identity rollback and quarantine both failed",
            );
          }
        }
      } else if (connectionRow) {
        await db
          .delete(toolConnections)
          .where(eq(toolConnections.id, connectionRow.id))
          .catch(() => undefined);
      }
      if (
        !preserveConcurrentRevival &&
        applicationRow &&
        !existingApplication
      ) {
        await db
          .delete(toolApplications)
          .where(eq(toolApplications.id, applicationRow.id))
          .catch(() => undefined);
      } else if (
        !preserveConcurrentRevival &&
        existingApplication &&
        applicationRow &&
        applicationRow.status !== existingApplication.status
      ) {
        await db
          .update(toolApplications)
          .set({
            status: existingApplication.status,
            archivedAt: existingApplication.archivedAt,
            updatedAt: new Date(),
          })
          .where(eq(toolApplications.id, existingApplication.id))
          .catch(() => undefined);
      }
      if (!preserveConcurrentRevival) {
        for (const secretId of createdSecretIds) {
          await secrets.remove(secretId).catch(() => undefined);
        }
        for (const definitionId of createdDefinitionIds) {
          await db.delete(userSecretDefinitions).where(eq(userSecretDefinitions.id, definitionId)).catch(() => undefined);
        }
      }
      if (identityRollbackError) {
        throw new HttpError(
          500,
          "Connection setup failed and its prior identity could not be restored.",
          {
            code: "connection_identity_rollback_failed",
          },
        );
      }
      throw error;
    }
  }

  async function assertCatalogEntriesForConnection(
    companyId: string,
    connectionId: string,
    catalogEntryIds: string[],
  ): Promise<Array<typeof toolCatalogEntries.$inferSelect>> {
    const uniqueIds = [...new Set(catalogEntryIds)];
    if (uniqueIds.length === 0) return [];
    const rows = await db
      .select()
      .from(toolCatalogEntries)
      .where(
        and(
          eq(toolCatalogEntries.companyId, companyId),
          eq(toolCatalogEntries.connectionId, connectionId),
          inArray(toolCatalogEntries.id, uniqueIds),
        ),
      );
    if (rows.length !== uniqueIds.length) {
      throw unprocessable(
        "All selected catalog entries must belong to this app connection",
      );
    }
    return rows;
  }

  async function assertAgentsInCompany(companyId: string, agentIds: string[]) {
    if (agentIds.length === 0) return;
    const rows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          inArray(agents.id, [...new Set(agentIds)]),
        ),
      );
    if (rows.length !== new Set(agentIds).size) {
      throw unprocessable(
        "All app access agent ids must belong to the same company",
      );
    }
  }

  async function upsertAskFirstPolicies(
    input: {
      companyId: string;
      connection: typeof toolConnections.$inferSelect;
      askFirstEntries: Array<typeof toolCatalogEntries.$inferSelect>;
      actor?: ActorInfo;
      disableStale?: boolean;
    },
    dbClient: ToolAccessMutationDb = db,
  ): Promise<ToolPolicy[]> {
    const existingPolicies = await dbClient
      .select()
      .from(toolPolicies)
      .where(
        and(
          eq(toolPolicies.companyId, input.companyId),
          eq(toolPolicies.policyType, "require_approval"),
        ),
      );
    const managedPolicies = existingPolicies.filter((policy) => {
      const config = asRecord(policy.config);
      return (
        config.source === "app_gallery_finish" &&
        config.connectionId === input.connection.id
      );
    });
    const policiesByCatalogEntryId = new Map<
      string,
      typeof toolPolicies.$inferSelect
    >();
    for (const policy of managedPolicies) {
      const config = asRecord(policy.config);
      if (typeof config.catalogEntryId === "string") {
        policiesByCatalogEntryId.set(config.catalogEntryId, policy);
      }
    }
    const askFirstIds = new Set(input.askFirstEntries.map((entry) => entry.id));
    const results: ToolPolicy[] = [];
    for (const entry of input.askFirstEntries) {
      const config = {
        source: "app_gallery_finish",
        connectionId: input.connection.id,
        catalogEntryId: entry.id,
      };
      const existing = policiesByCatalogEntryId.get(entry.id);
      if (existing) {
        const [updated] = await dbClient
          .update(toolPolicies)
          .set({
            name: policyNameForApp(input.connection, entry),
            description: `Ask first before running ${entry.toolName}.`,
            enabled: true,
            selectors: { catalogEntryId: entry.id },
            config,
            updatedAt: new Date(),
          })
          .where(eq(toolPolicies.id, existing.id))
          .returning();
        results.push(toPolicy(updated));
      } else {
        const [created] = await dbClient
          .insert(toolPolicies)
          .values({
            companyId: input.companyId,
            name: policyNameForApp(input.connection, entry),
            description: `Ask first before running ${entry.toolName}.`,
            policyType: "require_approval",
            priority: 50,
            enabled: true,
            selectors: { catalogEntryId: entry.id },
            config,
            createdByAgentId:
              input.actor?.actorType === "agent"
                ? (input.actor.actorId ?? null)
                : null,
            createdByUserId:
              input.actor?.actorType === "user"
                ? (input.actor.actorId ?? null)
                : null,
          })
          .returning();
        results.push(toPolicy(created));
      }
    }
    if (input.disableStale !== false) {
      const stalePolicies = managedPolicies.filter((policy) => {
        const config = asRecord(policy.config);
        return (
          typeof config.catalogEntryId === "string" &&
          !askFirstIds.has(config.catalogEntryId)
        );
      });
      for (const policy of stalePolicies) {
        await dbClient
          .update(toolPolicies)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(toolPolicies.id, policy.id));
      }
    }
    return results;
  }

  async function finishGalleryAppConnection(
    companyId: string,
    connectionId: string,
    input: FinishToolApp,
    actor?: ActorInfo,
  ): Promise<FinishToolAppResult> {
    const connection = await getConnectionRow(connectionId, companyId);
    await assertConnectorConnectionSetupEnabled(connection);
    if (connection.status === "archived")
      throw conflict("Archived app connections cannot be finished");
    if (connection.config.mcpPreserveAccess === true && isRemoteMcpConnectorMethod(connection.config.sourceTemplateKey, connection.config.connectionMethodKey)) {
      const [profile] = await db.select().from(toolProfiles).where(and(
        eq(toolProfiles.companyId, companyId), eq(toolProfiles.profileKey, `app:${connection.id}`),
      )).limit(1);
      if (!profile) throw conflict("The saved connection permissions could not be found");
      const config = { ...connection.config };
      delete config.mcpPreserveAccess;
      const updated = await db.transaction(async (tx) => {
        await tx.select({ id: toolApplications.id }).from(toolApplications)
          .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, companyId)))
          .for("update");
        const [row] = await tx.update(toolConnections).set({ config, transportConfig: config, status: "active", enabled: true, ...(input.agentInstructions !== undefined ? { agentInstructions: input.agentInstructions } : {}), updatedAt: new Date() })
          .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, companyId))).returning();
        await tx.update(toolApplications).set({ status: "active", updatedAt: new Date() }).where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, companyId)));
        return row;
      });
      const details = await profileDetails(profile.id, companyId);
      const policies = (await db.select().from(toolPolicies).where(eq(toolPolicies.companyId, companyId))).filter((policy) => asRecord(policy.config).connectionId === connection.id);
      return { connection: toConnection(updated), profile: toProfile(profile), profileEntries: details.entries, profileBindings: details.bindings, policies: policies.map(toPolicy) };
    }
    const enabledIds = [
      ...new Set([
        ...input.enabledCatalogEntryIds,
        ...input.askFirstCatalogEntryIds,
      ]),
    ];
    const requestedReviewedIds = input.reviewedCatalogEntryIds ?? [];
    const reviewedIds = [...new Set(requestedReviewedIds)];
    if (reviewedIds.length !== requestedReviewedIds.length) {
      throw badRequest(
        "Action review decisions must not contain duplicate catalogEntryId values",
      );
    }
    const enabledRows = await assertCatalogEntriesForConnection(
      companyId,
      connection.id,
      enabledIds,
    );
    const askFirstRows = await assertCatalogEntriesForConnection(
      companyId,
      connection.id,
      input.askFirstCatalogEntryIds,
    );
    if (enabledRows.some((entry) => entry.status === "disabled" && !(entry.quarantineReason === "mcp_tool_removed" && isRemoteMcpConnectorMethod(connection.config.sourceTemplateKey, connection.config.connectionMethodKey)))) {
      throw badRequest("Disabled actions cannot be enabled");
    }
    if (reviewedIds.length > 0) {
      await assertCatalogEntriesForConnection(
        companyId,
        connection.id,
        reviewedIds,
      );
      const quarantinedRows = await db
        .select({ id: toolCatalogEntries.id })
        .from(toolCatalogEntries)
        .where(
          and(
            eq(toolCatalogEntries.companyId, companyId),
            eq(toolCatalogEntries.connectionId, connection.id),
            eq(toolCatalogEntries.status, "quarantined"),
          ),
        );
      const reviewedIdSet = new Set(reviewedIds);
      if (
        quarantinedRows.length !== reviewedIdSet.size ||
        quarantinedRows.some((entry) => !reviewedIdSet.has(entry.id))
      ) {
        throw badRequest(
          "Action review decisions must cover every currently quarantined action exactly once",
        );
      }
    }
    if (input.access !== "all_agents")
      await assertAgentsInCompany(companyId, input.access.agentIds);

    const entries: CreateToolProfileEntryForProfile[] = enabledRows.map(
      (entry) => ({
        selectorType: "catalog_entry",
        effect: "include",
        catalogEntryId: entry.id,
        connectionId: connection.id,
        applicationId: connection.applicationId,
      }),
    );
    const profileKey = `app:${connection.id}`;
    const bindingInputs: CreateToolProfileBindingForProfile[] =
      input.access === "all_agents"
        ? [
            {
              targetType: "company",
              targetId: companyId,
              priority: 100,
              metadata: { source: "app_gallery_finish" },
            },
          ]
        : [...new Set(input.access.agentIds)].map((agentId) => ({
            targetType: "agent" as const,
            targetId: agentId,
            priority: 100,
            metadata: { source: "app_gallery_finish" },
          }));
    const transactionResult = await db.transaction(async (tx) => {
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, companyId)))
        .for("update");
      const [lockedConnection] = await tx
        .select({ id: toolConnections.id, status: toolConnections.status, enabled: toolConnections.enabled })
        .from(toolConnections)
        .where(
          and(
            eq(toolConnections.id, connectionId),
            eq(toolConnections.companyId, companyId),
          ),
        )
        .for("update");
      if (!lockedConnection) throw notFound("Tool connection not found");
      const [existingProfile] = await tx
        .select()
        .from(toolProfiles)
        .where(
          and(
            eq(toolProfiles.companyId, companyId),
            eq(toolProfiles.profileKey, profileKey),
          ),
        )
        .limit(1).for("no key update");
      await lockManagedAppPolicies(tx, companyId, connection.id);
      const existingBindings = existingProfile ? await tx.select().from(toolProfileBindings)
        .where(and(eq(toolProfileBindings.companyId, companyId), eq(toolProfileBindings.profileId, existingProfile.id))) : [];
      const existingInstalls = await tx.select().from(toolConnectionInstalls)
        .where(and(eq(toolConnectionInstalls.companyId, companyId), eq(toolConnectionInstalls.connectionId, connection.id)));
      const companyTargets = lockedConnection.status !== "active" || !lockedConnection.enabled || (existingProfile && existingProfile.status !== "active")
        ? [{ targetType: "company", targetId: companyId }] : [];
      await lockToolAssignmentAgents(tx, companyId, [...existingBindings, ...bindingInputs, ...existingInstalls, ...companyTargets]);
      // A renamed connection can leave its old profile name in use. Resolve
      // names against profiles too, including when finalizing an installed draft.
      const otherProfiles = await tx
        .select({ name: toolProfiles.name })
        .from(toolProfiles)
        .where(and(
          eq(toolProfiles.companyId, companyId),
          ne(toolProfiles.profileKey, profileKey),
        ));
      const profileName = nextAvailableConnectionName(
        connection.name,
        otherProfiles.map((profile) => profile.name),
      );
      let profileId: string;
      if (existingProfile) {
        if (input.preserveExistingAccess) {
          for (const prior of existingBindings)
            if (
              !bindingInputs.some(
                (binding) =>
                  binding.targetType === prior.targetType &&
                  binding.targetId === prior.targetId,
              )
            )
              bindingInputs.push({
                targetType: prior.targetType,
                targetId: prior.targetId,
                priority: prior.priority,
                metadata: prior.metadata,
              });
          const priorEntries = await tx
            .select()
            .from(toolProfileEntries)
            .where(eq(toolProfileEntries.profileId, existingProfile.id));
          for (const prior of priorEntries)
            if (
              !entries.some(
                (entry) =>
                  entry.catalogEntryId &&
                  entry.catalogEntryId === prior.catalogEntryId,
              )
            )
              entries.push({
                selectorType: prior.selectorType,
                effect: prior.effect,
                applicationId: prior.applicationId,
                connectionId: prior.connectionId,
                catalogEntryId: prior.catalogEntryId,
                toolName: prior.toolName,
                riskLevel: prior.riskLevel,
                conditions: prior.conditions,
              });
        }
        await tx
          .delete(toolProfileBindings)
          .where(
            and(
              eq(toolProfileBindings.companyId, companyId),
              eq(toolProfileBindings.profileId, existingProfile.id),
            ),
          );
        await tx
          .delete(toolProfileEntries)
          .where(
            and(
              eq(toolProfileEntries.companyId, companyId),
              eq(toolProfileEntries.profileId, existingProfile.id),
            ),
          );
        if (entries.length > 0) {
          await tx.insert(toolProfileEntries).values(
            entries.map((entry) => ({
              companyId,
              profileId: existingProfile.id,
              selectorType: entry.selectorType,
              effect: entry.effect ?? "include",
              applicationId: entry.applicationId ?? null,
              connectionId: entry.connectionId ?? null,
              catalogEntryId: entry.catalogEntryId ?? null,
              toolName: entry.toolName ?? null,
              riskLevel: entry.riskLevel ?? null,
              conditions: entry.conditions ?? null,
            })),
          );
        }
        const [updated] = await tx
          .update(toolProfiles)
          .set({
            name: profileName,
            description: `Access profile for ${connection.name}.`,
            status: "active",
            defaultAction: "deny",
            metadata: {
              source: "app_gallery_finish",
              connectionId: connection.id,
            },
            updatedAt: new Date(),
          })
          .where(eq(toolProfiles.id, existingProfile.id))
          .returning();
        profileId = updated.id;
      } else {
        const [created] = await tx
          .insert(toolProfiles)
          .values({
            companyId,
            profileKey,
            name: profileName,
            description: `Access profile for ${connection.name}.`,
            status: "active",
            defaultAction: "deny",
            metadata: {
              source: "app_gallery_finish",
              connectionId: connection.id,
            },
          })
          .returning();
        if (entries.length > 0) {
          await tx.insert(toolProfileEntries).values(
            entries.map((entry) => ({
              companyId,
              profileId: created.id,
              selectorType: entry.selectorType,
              effect: entry.effect ?? "include",
              applicationId: entry.applicationId ?? null,
              connectionId: entry.connectionId ?? null,
              catalogEntryId: entry.catalogEntryId ?? null,
              toolName: entry.toolName ?? null,
              riskLevel: entry.riskLevel ?? null,
              conditions: entry.conditions ?? null,
            })),
          );
        }
        profileId = created.id;
      }

      const profileBindings: ToolProfileBinding[] = [];
      // These connectors expose one agent-access choice. Commit installation
      // reach and permission bindings together, including an empty selection.
      if (isRemoteMcpConnectorMethod(connection.config.sourceTemplateKey, connection.config.connectionMethodKey)) {
        const desired = new Map(bindingInputs.flatMap((binding) => binding.targetType === "company" || binding.targetType === "agent"
          ? [[`${binding.targetType}:${binding.targetId}`, { targetType: binding.targetType, targetId: binding.targetId }] as const] : []));
        const removed = existingInstalls.filter((install) => !desired.has(`${install.targetType}:${install.targetId}`));
        const added = [...desired.values()].filter((binding) => !existingInstalls.some((install) => install.targetType === binding.targetType && install.targetId === binding.targetId));
        if (removed.length) await tx.delete(toolConnectionInstalls).where(inArray(toolConnectionInstalls.id, removed.map((install) => install.id)));
        if (added.length) await tx.insert(toolConnectionInstalls).values(added.map((binding) => ({
          companyId, connectionId: connection.id, targetType: binding.targetType, targetId: binding.targetId,
          createdByAgentId: actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
          createdByUserId: actor?.actorType === "user" ? (actor.actorId ?? null) : null,
        })));
        if (added.length || removed.length) await tx.insert(toolAccessAuditEvents).values({
          companyId, connectionId: connection.id, actorType: actor?.actorType ?? "system", actorId: actor?.actorId ?? null,
          action: "connection_installs.changed", outcome: "success", reasonCode: "installs_changed",
          details: { added: added.map(({ targetType, targetId }) => ({ targetType, targetId })), removed: removed.map(({ targetType, targetId }) => ({ targetType, targetId })) },
        });
      }
      for (const bindingInput of bindingInputs) {
        const [binding] = await tx
          .insert(toolProfileBindings)
          .values({
            companyId,
            profileId,
            targetType: bindingInput.targetType,
            targetId: bindingInput.targetId,
            priority: bindingInput.priority ?? 100,
            metadata: bindingInput.metadata ?? {},
            createdByAgentId:
              actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
            createdByUserId:
              actor?.actorType === "user" ? (actor.actorId ?? null) : null,
          })
          .returning();
        profileBindings.push(toProfileBinding(binding));
      }

      const reviewedAt = new Date();
      if (reviewedIds.length > 0) {
        await tx
          .update(toolCatalogEntries)
          .set({
            status: "active",
            reviewedAt,
            reviewedByAgentId:
              actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
            reviewedByUserId:
              actor?.actorType === "user" ? (actor.actorId ?? null) : null,
            quarantinedAt: null,
            quarantineReason: null,
            updatedAt: reviewedAt,
          })
          .where(
            and(
              eq(toolCatalogEntries.companyId, companyId),
              eq(toolCatalogEntries.connectionId, connection.id),
              inArray(toolCatalogEntries.id, reviewedIds),
              eq(toolCatalogEntries.status, "quarantined"),
            ),
          );
      }
      if (enabledIds.length > 0) {
        await tx
          .update(toolCatalogEntries)
          .set({
            status: "active",
            reviewedAt,
            reviewedByAgentId:
              actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
            reviewedByUserId:
              actor?.actorType === "user" ? (actor.actorId ?? null) : null,
            quarantinedAt: null,
            quarantineReason: null,
            updatedAt: reviewedAt,
          })
          .where(
            and(
              eq(toolCatalogEntries.companyId, companyId),
              inArray(toolCatalogEntries.id, enabledIds),
              ne(toolCatalogEntries.status, "quarantined"),
              ne(toolCatalogEntries.status, "disabled"),
            ),
          );
      }

      const policies = await upsertAskFirstPolicies(
        {
          companyId,
          connection,
          askFirstEntries: askFirstRows,
          disableStale: !input.preserveExistingAccess,
          actor,
        },
        tx,
      );
      const [updatedConnection] = await tx
        .update(toolConnections)
        .set({ status: "active", enabled: true, ...(input.agentInstructions !== undefined ? { agentInstructions: input.agentInstructions } : {}), updatedAt: new Date() })
        .where(eq(toolConnections.id, connection.id))
        .returning();
      await tx
        .update(toolApplications)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(toolApplications.id, connection.applicationId));

      return { profileId, profileBindings, policies, updatedConnection };
    });
    emitConnectionUpdated(
      transactionResult.updatedConnection,
      connection,
      "gallery",
    );

    const details = await profileDetails(
      transactionResult.profileId,
      companyId,
    );
    return {
      connection: toConnection(transactionResult.updatedConnection),
      profile: {
        id: details.id,
        companyId: details.companyId,
        profileKey: details.profileKey,
        name: details.name,
        description: details.description,
        status: details.status,
        defaultAction: details.defaultAction,
        newToolsReviewedAt: details.newToolsReviewedAt,
        metadata: details.metadata,
        createdAt: details.createdAt,
        updatedAt: details.updatedAt,
      },
      profileEntries: details.entries,
      profileBindings: transactionResult.profileBindings,
      policies: transactionResult.policies,
    };
  }

  /**
   * Resolve the one user identity a personal-only connection is allowed to
   * refresh. The connection creator is authoritative for new rows; retained
   * grants cover older or agent-created rows. Reconnect may rotate that
   * identity's credential, but it may never create a different user's identity
   * on the same connection.
   */
  async function fixedPersonalIdentityForReconnect(
    connection: typeof toolConnections.$inferSelect,
    requestedSubjectUserId: string | undefined,
    actor?: ActorInfo,
  ): Promise<{
    subjectUserId: string;
    grant: typeof connectionGrants.$inferSelect | null;
  } | null> {
    if (connection.credentialPolicy !== "per_user") return null;

    const personalGrants = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "user"),
        ),
      )
      .orderBy(desc(connectionGrants.updatedAt));
    const creatorGrant = connection.createdByUserId
      ? (personalGrants.find(
          (grant) => grant.subjectUserId === connection.createdByUserId,
        ) ?? null)
      : null;
    const retainedGrant =
      creatorGrant ??
      personalGrants.find((grant) => grant.credentialSecretRefs.length > 0) ??
      personalGrants[0] ??
      null;
    const fixedSubjectUserId =
      connection.createdByUserId ?? retainedGrant?.subjectUserId ?? null;
    const binding = actorBinding(actor);
    const actorUserId = binding.actorType === "user" ? binding.actorId : null;
    const subjectUserId = requestedSubjectUserId ?? actorUserId;

    if (!subjectUserId) {
      throw forbidden(
        "Reconnect this personal connection as the user it belongs to",
      );
    }
    if (actorUserId && subjectUserId !== actorUserId) {
      throw forbidden(
        "Board users may only reconnect their own personal connection",
      );
    }
    if (fixedSubjectUserId && subjectUserId !== fixedSubjectUserId) {
      throw forbidden(
        "Only the existing personal identity can reconnect this connection",
      );
    }

    return {
      subjectUserId,
      grant:
        personalGrants.find((grant) => grant.subjectUserId === subjectUserId) ??
        null,
    };
  }

  /**
   * Replace the credential(s) on an existing connection and re-run the health
   * check — the "Replace key" / reconnect flow (M7, PAP-10859). Rotates the
   * secret in place when a ref already exists so the connection keeps its
   * profile, policies, and catalog; creates a fresh secret only when the field
   * had none (e.g. a link connection added a key after the fact).
   */
  async function reconnectGalleryApp(
    connectionId: string,
    companyId: string,
    input: { credentialValues: Record<string, string> },
    actor?: ActorInfo,
  ): Promise<ToolConnectionHealthCheckResult> {
    const connection = await getConnectionRow(connectionId, companyId);
    assertSupportedConnection(connection);
    await assertConnectorConnectionSetupEnabled(connection);
    await assertExperimentalConnectorSetupEnabled(connection.config.sourceTemplateKey, connection.status !== "draft");
    if (connection.status === "archived")
      throw conflict("Archived app connections cannot be reconnected");
    if (connection.credentialSource === "vercel_connect") {
      throw conflict(
        "Manage this connector in Vercel Connect, then run a Paperclip health check to verify it.",
        {
          code: "vercel_connect_managed_externally",
          manageUrl: vercelConnectIntegrationStatus().manageUrl,
        },
      );
    }
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    const storedCredentialFields = connection.credentialRefs
      .filter((ref) => ref.placement === "header" || ref.placement === "url")
      .map((ref) => ({
        label: ref.placement === "url" ? "MCP server URL" : ref.prefix === "Bearer " ? "App key" : ref.key ?? ref.name,
        configPath: credentialRefConfigPath(ref),
        helpUrl: "",
        required: false,
        placement: ref.placement,
        key: ref.key,
        prefix: ref.prefix,
      }));
    const galleryCredentialFields = galleryEntry
      ? credentialFieldsFor(galleryEntry, connectionMethodForConnection(galleryEntry, connection).key)
      : [];
    const credentialFields = galleryCredentialFields.length > 0
      ? galleryCredentialFields
      : storedCredentialFields.length > 0 ? storedCredentialFields : [
          {
            label: "App key",
            configPath: "credentials.authorization",
            helpUrl: "",
            required: false,
            placement: "header" as const,
            key: "Authorization",
            prefix: "Bearer ",
          },
        ];

    const providedFields = credentialFields.filter(
      (field) =>
        (input.credentialValues[field.configPath]?.trim().length ?? 0) > 0,
    );
    if (providedFields.length === 0)
      throw badRequest("Enter a replacement credential to reconnect this app");

    const personalIdentity = await fixedPersonalIdentityForReconnect(
      connection,
      undefined,
      actor,
    );
    const credentialSecretRefs = [
      ...(personalIdentity?.grant?.credentialSecretRefs ??
        connection.credentialSecretRefs),
    ];
    const credentialRefs: McpConnectionCredentialRef[] = [
      ...(connection.credentialRefs ?? []),
    ];

    const updated = await db.transaction(async (tx) => {
      await tx.select({ id: connectionGrants.id }).from(connectionGrants)
        .where(and(eq(connectionGrants.companyId, companyId), eq(connectionGrants.connectionId, connection.id)))
        .orderBy(connectionGrants.id).for("update");
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, companyId)))
        .for("update");
      await tx.select({ id: toolConnections.id }).from(toolConnections)
        .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, companyId)))
        .for("update");
      for (const field of providedFields) {
        const value = input.credentialValues[field.configPath]!.trim();
        if (field.placement === "url" && !remoteUrlCredentialMatchesPublicUrl(String(connection.config.url ?? ""), value)) {
          throw badRequest("The replacement server URL must use the same endpoint as this connection.", {
            code: "mcp_remote_url_credential_mismatch",
          });
        }
        const existing = credentialSecretRefs.find(
          (ref) => ref.configPath === field.configPath,
        );
        const { secret } = await writeConnectionCredential(tx, {
          companyId, connectionName: connection.name, configPath: field.configPath,
          label: field.label, value, ownerUserId: personalIdentity?.subjectUserId,
          existingRef: existing, actor: actorForSecret(actor),
        });
        const nextRef = { secretId: secret.id, versionSelector: "latest" as const,
          configPath: field.configPath, required: field.required ?? true, label: field.label };
        const refIndex = credentialSecretRefs.findIndex((ref) => ref.configPath === field.configPath);
        if (refIndex >= 0) credentialSecretRefs[refIndex] = nextRef;
        else credentialSecretRefs.push(nextRef);
        if ((field.placement === "header" && field.key) || field.placement === "url") {
          const nextCredentialRef = {
            name: field.configPath,
            secretId: secret.id,
            version: "latest",
            placement: field.placement,
            key: field.key ?? "url",
            prefix: field.prefix ?? null,
          } satisfies McpConnectionCredentialRef;
          const existingCredentialRefIndex = credentialRefs.findIndex(
            (ref) => credentialRefConfigPath(ref) === field.configPath,
          );
          if (existingCredentialRefIndex >= 0)
            credentialRefs[existingCredentialRefIndex] = nextCredentialRef;
          else credentialRefs.push(nextCredentialRef);
        }
      }

      const updatedAt = new Date();
      if (personalIdentity) {
        const grantValues = {
          credentialSecretRefs,
          status: "active" as const,
          revokedAt: null,
          revokedByAgentId: null,
          revokedByUserId: null,
          updatedAt,
        };
        if (personalIdentity.grant) {
          await tx
            .update(connectionGrants)
            .set(grantValues)
            .where(eq(connectionGrants.id, personalIdentity.grant.id));
        } else {
          await tx.insert(connectionGrants).values({
            companyId: connection.companyId,
            connectionId: connection.id,
            kind: "user",
            subjectUserId: personalIdentity.subjectUserId,
            ...grantValues,
            isDefault: false,
            createdByUserId: personalIdentity.subjectUserId,
          });
        }
      }
      const [nextConnection] = await tx
        .update(toolConnections)
        .set({
          credentialRefs,
          // Personal reconnect rotates the existing user's grant. The
          // connection-level organization slot stays exactly as it was.
          credentialSecretRefs: personalIdentity
            ? connection.credentialSecretRefs
            : credentialSecretRefs,
          lastError: null,
          updatedAt,
        })
        .where(eq(toolConnections.id, connection.id))
        .returning();
      await syncConnectionCredentialBindings(tx, nextConnection,
        personalIdentity ? credentialSecretRefs : []);
      return nextConnection;
    });
    const health = await checkConnectionHealth(updated.id, actor);
    const refresh = await refreshCatalog(updated.id, actor, {
      enableAllByDefault: true,
    });
    return { ...health, connection: refresh.connection };
  }

  async function startOAuth(
    companyId: string,
    connectionId: string,
    input: {
      redirectUri: string;
      actor: ActorInfo;
      subjectUserId?: string;
      subjectAgentId?: string;
      scopes?: string[];
      workspaceServices?: GoogleWorkspaceServiceSelection;
      returnTo?: string;
      issueId?: string;
      interactionId?: string;
    },
  ): Promise<ToolOAuthStartResult> {
    let connection = await getConnectionRow(connectionId, companyId);
    assertSupportedConnection(connection);
    await assertConnectorConnectionSetupEnabled(connection);
    await assertExperimentalConnectorSetupEnabled(connection.config.sourceTemplateKey, connection.status !== "draft");
    if (connection.status === "archived")
      throw conflict("Archived app connections cannot start sign in");
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    assertOAuthRedirectConstraints(galleryEntry, input.redirectUri);
    const galleryMethod = galleryEntry
      ? connectionMethodForConnection(galleryEntry, connection)
      : null;
    const requestedScopes = await (async () => {
      if (input.workspaceServices && sourceTemplateKey !== "google-workspace") throw badRequest("Service selection requires Google Workspace");
      if (sourceTemplateKey === "google-workspace") {
        if (input.workspaceServices && input.scopes) throw badRequest("Choose services or scopes, not both");
        const allowed = normalizeOauthScopes(galleryMethod?.defaults?.scopesHint);
        let scopes = input.scopes ?? (input.workspaceServices ? googleWorkspaceSelectedScopes(input.workspaceServices) : undefined);
        if (!scopes && connection.status !== "draft") {
          // Account-page reconnect has no new service choice. Never replace its
          // subject's saved request with the new-account write defaults.
          const binding = actorBinding(input.actor);
          const subjectUserId = input.subjectUserId ?? (binding.actorType === "user" ? binding.actorId : null);
          const kind = connection.credentialPolicy === "per_user" ? "user"
            : connection.credentialPolicy === "per_agent" ? "agent" : "organization";
          const [grant] = await db.select().from(connectionGrants).where(and(
            eq(connectionGrants.companyId, companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, kind),
            kind === "user" ? eq(connectionGrants.subjectUserId, subjectUserId ?? "")
              : kind === "agent" ? eq(connectionGrants.subjectAgentId, input.subjectAgentId ?? "")
                : eq(connectionGrants.isDefault, true),
          )).limit(1);
          const saved = grant?.providerTenant?.oauth;
          scopes = normalizeOauthScopes(saved?.requestedScopes ?? saved?.scopes)
            .filter(scope => allowed.includes(scope));
          if (scopes.length === 0) throw badRequest("Choose your Google Workspace services before reconnecting");
        }
        scopes ??= googleWorkspaceSelectedScopes(GOOGLE_WORKSPACE_DEFAULT_SELECTION);
        if (!isGoogleWorkspaceScopeGrant(scopes) || scopes.some(scope => !allowed.includes(scope))) throw badRequest("Select at least one supported Google service");
        return scopes;
      }
      if (!galleryMethod) return input.scopes ?? null;
      const allowed = normalizeOauthScopes(galleryMethod.defaults?.scopesHint);
      if (!input.scopes) return allowed;
      const requested = normalizeOauthScopes(input.scopes);
      const widened = requested.filter((scope) => !allowed.includes(scope));
      if (widened.length > 0) {
        throw badRequest(
          `Requested OAuth scopes are not allowed for ${galleryEntry?.name ?? "this app"}`,
          {
            code: "oauth_scope_widening_rejected",
            scopes: widened,
          },
        );
      }
      return requested;
    })();
    const starterBinding = actorBinding(input.actor);
    const fixedPersonalIdentity = await fixedPersonalIdentityForReconnect(
      connection,
      input.subjectUserId,
      input.actor,
    );
    const authorizationSubjectUserId =
      fixedPersonalIdentity?.subjectUserId ?? input.subjectUserId;
    const authorizationSubjectAgentId = input.subjectAgentId;
    if (authorizationSubjectAgentId) {
      const [subjectAgent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(
          and(
            eq(agents.id, authorizationSubjectAgentId),
            eq(agents.companyId, companyId),
          ),
        )
        .limit(1);
      if (!subjectAgent)
        throw badRequest(
          "Dedicated identity requires an agent in this company",
        );
      if (connection.credentialPolicy !== "per_agent") {
        throw badRequest(
          "This connection is not configured for a dedicated agent identity",
        );
      }
    }
    const intentLink = input.interactionId
      ? await db
          .select({
            id: issueThreadInteractions.id,
            issueId: issueThreadInteractions.issueId,
            addresseeUserId: issueThreadInteractions.addresseeUserId,
            kind: issueThreadInteractions.kind,
            status: issueThreadInteractions.status,
          })
          .from(issueThreadInteractions)
          .where(
            and(
              eq(issueThreadInteractions.id, input.interactionId),
              eq(issueThreadInteractions.companyId, companyId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    if (
      input.interactionId &&
      (!intentLink ||
        intentLink.kind !== "connection_intent" ||
        intentLink.status !== "pending" ||
        starterBinding.actorType !== "user" ||
        starterBinding.actorId !== intentLink.addresseeUserId)
    ) {
      throw forbidden(
        "Only the addressed user can authorize this connection request",
      );
    }
    if (connection.credentialSource === "vercel_connect") {
      if (!vercelConnect)
        throw vercelConnectHttpError(
          new VercelConnectClientError("vercel_connect_unavailable", 503),
        );
      const credential = vercelCredentialFor(connection);
      if (
        connection.authKind !== "oauth" ||
        credential.principalMode !== "user"
      ) {
        throw badRequest(
          "This Vercel connector does not use browser authorization",
        );
      }
      const binding = starterBinding;
      if (!binding.actorType || !binding.actorId) {
        throw forbidden(
          "Vercel Connect authorization requires an authenticated actor",
        );
      }
      const grantKind: ConnectionGrantKind = authorizationSubjectUserId
        ? "user"
        : "organization";
      const derived = deriveVercelConnectSubject({
        credential,
        connectionId: connection.id,
        companyId,
        grantKind,
        subjectUserId: authorizationSubjectUserId,
      });
      const state = randomOauthToken();
      let authorization;
      try {
        authorization = await vercelConnect.startAuthorization(
          {
            connector: credential.connectorUid,
            subject: derived.subject,
            scopes: credential.scopes,
            resources: vercelConnectResourcesFor(connection),
          },
          vercelConnectCallbackUrl(input.redirectUri, state),
        );
      } catch (error) {
        throw vercelConnectHttpError(error);
      }
      const remoteExpiry = authorization.expiresAt
        ? new Date(authorization.expiresAt)
        : null;
      const expiresAt =
        remoteExpiry && Number.isFinite(remoteExpiry.getTime())
          ? new Date(
              Math.min(
                remoteExpiry.getTime(),
                now().getTime() + 10 * 60 * 1000,
              ),
            )
          : new Date(now().getTime() + 10 * 60 * 1000);
      await db
        .delete(toolOauthStates)
        .where(lt(toolOauthStates.expiresAt, now()));
      await db.insert(toolOauthStates).values({
        state,
        companyId,
        connectionId: connection.id,
        // Vercel owns its verifier. This marker only dispatches the consumed
        // one-time state to the Vercel callback completion path.
        codeVerifier: "vercel-connect",
        createdByActorType: binding.actorType,
        createdByActorId: binding.actorId,
        createdBySessionId: binding.sessionId,
        subjectUserId: authorizationSubjectUserId,
        requestedScopes: [...credential.scopes],
        returnTo: input.returnTo,
        issueId: intentLink?.issueId ?? input.issueId,
        interactionId: intentLink?.id,
        expiresAt,
      });
      return {
        connectionId: connection.id,
        provider: `vercel-connect:${credential.service}`,
        authorizationUrl: authorization.url,
        expiresAt: expiresAt.toISOString(),
        issuer: "https://vercel.com/connect",
        resource: galleryMethod?.defaults?.serverUrl ?? null,
        registrationSource: null,
      };
    }
    if (
      galleryMethod &&
      isPaperclipCloudConnectorStrategy(galleryMethod.oauthStrategy)
    ) {
      const connectorProfile = galleryMethod.connectorProfile;
      const managedProfile = managedConnectorProfile(connectorProfile);
      if (!managedProfile)
        throw badRequest("This app has an invalid managed connector profile");
      const providerName = galleryEntry?.name ?? "Google Workspace";
      const cloudConnector = currentCloudConnector();
      if (!cloudConnector) {
        throw unprocessable(
          `${providerName} connections through Paperclip are not available on this instance yet`,
          {
            code: "paperclip_cloud_connector_unavailable",
          },
        );
      }
      const binding = starterBinding;
      if (!binding.actorType || !binding.actorId) {
        throw forbidden(
          `${providerName} sign-in requires an authenticated actor`,
        );
      }
      const subjectUserId = authorizationSubjectAgentId
        ? null
        : (authorizationSubjectUserId ??
          (binding.actorType === "user" ? binding.actorId : null));
      if (!subjectUserId && !authorizationSubjectAgentId) {
        throw forbidden(
          `Agent-started ${providerName} sign-in requires an authorized identity`,
        );
      }
      if (
        !authorizationSubjectAgentId &&
        binding.actorType === "user" &&
        subjectUserId !== binding.actorId
      ) {
        throw forbidden(
          `Board users may only authorize their own ${providerName} identity`,
        );
      }
      await db
        .delete(toolOauthStates)
        .where(lt(toolOauthStates.expiresAt, now()));
      const state = randomOauthToken();
      const returnUri = new URL(input.redirectUri);
      returnUri.pathname = "/api/tools/oauth/cloud-connector/callback";
      returnUri.search = "";
      returnUri.hash = "";
      const session = await cloudConnector.startAuthorization({
        subject: authorizationSubjectAgentId
          ? `agent:${authorizationSubjectAgentId}`
          : subjectUserId!,
        companyId,
        profile: managedProfile.id,
        ...(managedProfile.id === "workspace.all" ? { scopes: requestedScopes! } : {}),
        returnUri: returnUri.toString(),
        returnState: state,
      });
      const remoteExpiry = new Date(session.expiresAt);
      const expiresAt = Number.isFinite(remoteExpiry.getTime())
        ? new Date(
            Math.min(remoteExpiry.getTime(), now().getTime() + 10 * 60 * 1000),
          )
        : new Date(now().getTime() + 10 * 60 * 1000);
      await db.insert(toolOauthStates).values({
        state,
        companyId,
        connectionId: connection.id,
        // Paperclip Cloud owns PKCE for this flow. The local state row remains the
        // single-use browser correlator and never stores broker token material.
        codeVerifier: "paperclip-cloud-connector",
        createdByActorType: binding.actorType,
        createdByActorId: binding.actorId,
        createdBySessionId: binding.sessionId,
        subjectUserId,
        subjectAgentId: authorizationSubjectAgentId,
        requestedScopes: managedProfile.id === "workspace.all" ? requestedScopes! : [...managedProfile.scopes],
        returnTo: input.returnTo,
        issueId: intentLink?.issueId ?? input.issueId,
        interactionId: intentLink?.id,
        expiresAt,
      });
      return {
        connectionId: connection.id,
        provider: managedProfile.provider,
        authorizationUrl: session.authorizationUrl,
        expiresAt: expiresAt.toISOString(),
        ...(session.handoff ? { handoff: session.handoff } : {}),
        issuer:
          managedProfile.provider === "github"
            ? "https://github.com"
            : managedProfile.provider === "asana"
              ? "https://app.asana.com"
              : "https://accounts.google.com",
        resource: galleryMethod.defaults?.serverUrl ?? null,
        registrationSource: null,
      };
    }
    const endpoints = await oauthEndpointsForConnection(
      connection,
      null,
      input.redirectUri,
    );
    if (endpoints.grantType === "client_credentials") {
      throw unprocessable(
        "This app uses shared machine credentials and does not need browser sign in",
      );
    }
    const resolvedClient = await ensureOAuthClient({
      connection,
      endpoints,
      redirectUri: input.redirectUri,
      galleryEntry,
      actor: input.actor,
    });
    connection = resolvedClient.connection;
    const client = resolvedClient.client;
    if (galleryMethod?.oauthClientSecretRequired && !client.clientSecret) {
      throw unprocessable("This app requires an OAuth client secret. Add it in the app setup before signing in.");
    }
    if (!client.clientId)
      throw unprocessable(
        `OAuth client id is not configured for ${endpoints.provider}`,
      );

    const authorizationScopes = normalizeOauthScopes(
      galleryMethod ? (requestedScopes ?? []) : (input.scopes ?? endpoints.scopes),
    );
    if (
      !galleryMethod &&
      endpoints.offlineAccessSupported &&
      (!endpoints.grantTypesSupported?.length ||
        endpoints.grantTypesSupported.includes("refresh_token")) &&
      !authorizationScopes.includes("offline_access")
    ) authorizationScopes.push("offline_access");

    await db
      .delete(toolOauthStates)
      .where(lt(toolOauthStates.expiresAt, new Date()));

    const state = randomOauthToken();
    const codeVerifier = randomOauthToken(48);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const binding = starterBinding;
    if (!binding.actorType || !binding.actorId) {
      throw forbidden("OAuth sign-in requires an authenticated board session");
    }
    await db.insert(toolOauthStates).values({
      state,
      companyId,
      connectionId: connection.id,
      codeVerifier,
      createdByActorType: binding.actorType,
      createdByActorId: binding.actorId,
      createdBySessionId: binding.sessionId,
      subjectUserId: authorizationSubjectUserId,
      requestedScopes: authorizationScopes,
      returnTo: input.returnTo,
      issueId: intentLink?.issueId ?? input.issueId,
      interactionId: intentLink?.id,
      expiresAt,
    });

    // Last gate before this URL becomes a top-level browser navigation. Every
    // producer above already validates, so reaching a rejection here means a new
    // path was added without one — fail closed rather than hand the board an
    // unvetted target.
    const authorizationUrl = new URL(
      assertOAuthEndpointUrl("authorization", endpoints.authorizationUrl, {
        // Paperclip's own callback origin: a first-party authorization endpoint is
        // served however this deployment is served, plaintext LAN host included.
        firstPartyOrigin: originOf(input.redirectUri),
      }),
    );
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", client.clientId);
    authorizationUrl.searchParams.set("redirect_uri", input.redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set(
      "code_challenge",
      base64UrlSha256(codeVerifier),
    );
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    // RFC 8707: name the MCP server the resulting token is for, so an
    // authorization server that serves several resources can audience-restrict it.
    if (endpoints.resource)
      authorizationUrl.searchParams.set("resource", endpoints.resource);
    // Curated definitions are an allowlist, not a suggestion. Never copy every
    // scope advertised by discovery into a provider consent screen: a curated
    // method either sends its reviewed hint or omits scope entirely. Generic
    // MCP URLs retain discovery-first behavior because Paperclip has no manifest
    // against which it could safely judge the caller's requested scope.
    if (authorizationScopes.length > 0)
      authorizationUrl.searchParams.set("scope", authorizationScopes.join(" "));
    if (galleryMethod && connection.config.sourceTemplateKey === "google-workspace")
      authorizationUrl.searchParams.set("enable_granular_consent", "true");
    const reviewedAuthorizationParams =
      galleryMethod?.defaults?.oauthAuthorizationParams;
    if (reviewedAuthorizationParams?.access_type)
      authorizationUrl.searchParams.set(
        "access_type",
        reviewedAuthorizationParams.access_type,
      );
    if (reviewedAuthorizationParams?.prompt)
      authorizationUrl.searchParams.set(
        "prompt",
        reviewedAuthorizationParams.prompt,
      );
    else if (!galleryMethod && authorizationScopes.includes("offline_access"))
      // OIDC offline access requires consent unless the provider has another
      // established basis for granting it. A generic server has no reviewed override.
      authorizationUrl.searchParams.set("prompt", "consent");

    if (
      authorizationSubjectUserId &&
      input.issueId &&
      binding.actorType === "agent"
    ) {
      const idempotencyKey = `connection-authorization:${connection.id}:${authorizationSubjectUserId}`;
      // Provider label for the card's copy. The gallery definition's name when we
      // have one, else the connection's own name — never a secret name or ref.
      const sourceTemplateKey =
        typeof connection.config.sourceTemplateKey === "string"
          ? connection.config.sourceTemplateKey
          : null;
      const providerName =
        (sourceTemplateKey
          ? getConnectableAppDefinition(sourceTemplateKey)?.name
          : null) ?? connection.name;
      const [requestingAgent] = binding.actorId
        ? await db
            .select({ name: agents.name })
            .from(agents)
            .where(
              and(
                eq(agents.id, binding.actorId),
                eq(agents.companyId, companyId),
              ),
            )
            .limit(1)
        : [undefined];
      const payload = {
        version: 1 as const,
        prompt: `Connect your ${providerName} to continue`,
        acceptLabel: `Connect ${providerName}`,
        rejectLabel: "Not now",
        detailsMarkdown:
          "Authorization is required before this agent can act on your behalf.",
        // Presentation metadata so the card can compose its own copy instead of
        // parsing the title string (PAP-17835 seam #6). The interaction kind and
        // the server-addressed audience are unchanged.
        connectionAuthorization: {
          version: 1 as const,
          providerName,
          connectionName:
            connection.name === providerName ? null : connection.name,
          requestingAgentName: requestingAgent?.name ?? null,
        },
        target: {
          type: "custom" as const,
          key: `connection:${connection.uid}:user:${authorizationSubjectUserId}`,
          revisionId: state,
          label: `Connect ${providerName}`,
          href: authorizationUrl.toString(),
        },
      };
      const [existingInteraction] = await db
        .select()
        .from(issueThreadInteractions)
        .where(
          and(
            eq(issueThreadInteractions.companyId, companyId),
            eq(issueThreadInteractions.issueId, input.issueId),
            eq(issueThreadInteractions.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      const [interaction] = existingInteraction
        ? await db
            .update(issueThreadInteractions)
            .set({
              status: "pending",
              requestedResolverPolicy: "human_only",
              effectiveResolverPolicy: "human_only",
              resolverPolicyProvenance: "explicit",
              effectiveResolverPolicySource: "requested",
              addresseeUserId: authorizationSubjectUserId,
              payload,
              result: null,
              resolvedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(issueThreadInteractions.id, existingInteraction.id))
            .returning()
        : await db
            .insert(issueThreadInteractions)
            .values({
              companyId,
              issueId: input.issueId,
              kind: "request_confirmation",
              status: "pending",
              continuationPolicy: "none",
              requestedResolverPolicy: "human_only",
              effectiveResolverPolicy: "human_only",
              resolverPolicyProvenance: "explicit",
              effectiveResolverPolicySource: "requested",
              addresseeUserId: authorizationSubjectUserId,
              idempotencyKey,
              sourceRunId:
                binding.actorType === "agent"
                  ? (input.actor.sessionId ?? null)
                  : null,
              title: `Connect your ${providerName} to continue`,
              summary: `${requestingAgent?.name ?? "An agent"} needs your ${providerName} identity for work running as you.`,
              createdByAgentId:
                binding.actorType === "agent" ? binding.actorId : null,
              payload,
            })
            .returning();
      if (interaction) {
        await db
          .update(toolOauthStates)
          .set({ interactionId: interaction.id })
          .where(eq(toolOauthStates.state, state));
      }
    }

    const nextConfig = {
      ...connection.config,
      oauth: {
        ...oauthConfig(connection),
        provider: endpoints.provider,
        authorizationUrl: endpoints.authorizationUrl,
        tokenUrl: endpoints.tokenUrl,
        registrationUrl: endpoints.registrationUrl ?? null,
        metadataUrl: endpoints.metadataUrl ?? null,
        // Curated apps persist only the reviewed scopes attached to this OAuth
        // state. Discovery metadata can advertise a provider's entire scope
        // universe and must never silently become Paperclip's requested set.
        scopes: authorizationScopes,
        offlineAccessSupported: endpoints.offlineAccessSupported,
        grantTypesSupported: endpoints.grantTypesSupported ?? [],
        codeChallengeMethodsSupported:
          endpoints.codeChallengeMethodsSupported ?? [],
        tokenEndpointAuthMethodsSupported:
          endpoints.tokenEndpointAuthMethodsSupported ?? [],
        grantType: "authorization_code",
        clientIdEnv: client.clientIdEnv,
        clientSecretEnv: client.clientSecret ? client.clientSecretEnv : null,
        credentialScope: credentialScope(connection, input.actor),
        // Persist the issuer and resource this authorization run is bound to.
        // `iss` on the callback is validated against `expectedIssuer`, and
        // refresh/reconnect/revoke reuse the same pair rather than re-deriving it.
        issuer: endpoints.issuer ?? oauthConfig(connection).issuer ?? null,
        expectedIssuer: endpoints.issuer ?? null,
        resource:
          endpoints.resource ?? oauthConfig(connection).resource ?? null,
        clientIdMetadataDocumentSupported:
          endpoints.clientIdMetadataDocumentSupported === true,
      },
    };
    await db
      .update(toolConnections)
      .set({
        // A generic URL connection starts life as `authKind: none`. Once it has
        // completed OAuth discovery and client resolution it is an OAuth
        // connection, and refresh, reconnect, revoke and diagnostics must all
        // treat it as one.
        authKind: "oauth",
        config: nextConfig,
        transportConfig: nextConfig,
        updatedAt: new Date(),
      })
      .where(eq(toolConnections.id, connection.id));

    return {
      connectionId: connection.id,
      provider: endpoints.provider,
      authorizationUrl: authorizationUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      issuer: endpoints.issuer ?? null,
      resource: endpoints.resource ?? null,
      registrationSource: resolvedClient.source,
    };
  }

  async function peekOAuthState(state: string) {
    const [row] = await db
      .select({
        companyId: toolOauthStates.companyId,
        connectionId: toolOauthStates.connectionId,
        subjectUserId: toolOauthStates.subjectUserId,
        subjectAgentId: toolOauthStates.subjectAgentId,
        returnTo: toolOauthStates.returnTo,
        issueId: toolOauthStates.issueId,
        interactionId: toolOauthStates.interactionId,
      })
      .from(toolOauthStates)
      .where(eq(toolOauthStates.state, state))
      .limit(1);
    return row ?? null;
  }

  /** Bind a callback to its initiating actor without consuming retryable state. */
  async function validateOAuthState(
    state: string,
    actor: ActorInfo | undefined,
  ) {
    const [stateRow] = await db
      .select()
      .from(toolOauthStates)
      .where(eq(toolOauthStates.state, state))
      .limit(1);
    if (!stateRow)
      throw badRequest("OAuth state was not found or has already been used");
    if (stateRow.expiresAt.getTime() <= Date.now())
      throw badRequest("OAuth state has expired");
    if (stateRow.subjectUserId) {
      if (
        actor?.actorType !== "user" ||
        actor.actorId !== stateRow.subjectUserId
      ) {
        throw forbidden(
          "OAuth callback user does not match the requested subject",
        );
      }
    } else {
      assertSameOAuthActor(stateRow, actor);
    }
    return stateRow;
  }

  /**
   * Answer a terminal authorization callback exactly once. Actor validation
   * happens before the atomic delete, so an unbound callback cannot consume a
   * valid flow and concurrent callbacks cannot both complete it.
   */
  async function consumeOAuthState(
    state: string,
    actor: ActorInfo | undefined,
  ) {
    const stateRow = await validateOAuthState(state, actor);
    const [consumed] = await db
      .delete(toolOauthStates)
      .where(eq(toolOauthStates.state, state))
      .returning();
    if (!consumed)
      throw badRequest("OAuth state was not found or has already been used");
    return consumed;
  }

  /**
   * End the board's "Connect your account" prompt when the user declines in the
   * provider's window (PAP-17109). Without this the card stays `pending`, so the
   * board keeps offering an authorization link for a flow the user just refused
   * and the requesting agent never learns the answer.
   *
   * Scoped to a still-`pending` row: a board user who already answered the card
   * directly keeps their own answer.
   */
  async function rejectPendingOAuthInteraction(
    stateRow: typeof toolOauthStates.$inferSelect,
    actor: ActorInfo | undefined,
  ) {
    if (!stateRow.interactionId) return;
    const now = new Date();
    const linked = await db
      .select({
        kind: issueThreadInteractions.kind,
        payload: issueThreadInteractions.payload,
      })
      .from(issueThreadInteractions)
      .where(
        and(
          eq(issueThreadInteractions.id, stateRow.interactionId),
          eq(issueThreadInteractions.companyId, stateRow.companyId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (linked?.kind === "connection_intent") {
      const connectionIntentPayload = connectionIntentPayloadSchema.parse(
        linked.payload,
      );
      await db
        .update(issueThreadInteractions)
        .set({
          payload: { ...connectionIntentPayload, phase: "needs_retry" },
          updatedAt: now,
        })
        .where(
          and(
            eq(issueThreadInteractions.id, stateRow.interactionId),
            eq(issueThreadInteractions.companyId, stateRow.companyId),
            eq(issueThreadInteractions.status, "pending"),
          ),
        );
      return;
    }
    await db
      .update(issueThreadInteractions)
      .set({
        status: "rejected",
        result: {
          version: 1,
          outcome: "rejected",
          // Paperclip's own words: the provider's explanation is untrusted and
          // this reason is rendered in the thread (PAP-17108).
          reason:
            "Authorization was declined or cancelled in the provider's window",
        },
        resolvedByUserId: actor?.actorType === "user" ? actor.actorId : null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(issueThreadInteractions.id, stateRow.interactionId),
          eq(issueThreadInteractions.companyId, stateRow.companyId),
          eq(issueThreadInteractions.status, "pending"),
        ),
      );
  }

  async function finishOAuthCatalogWithRecommendedDefaults(input: {
    connection: typeof toolConnections.$inferSelect;
    catalog: ToolCatalogEntry[];
    suggestedDefaults: ConnectToolAppResult["suggestedDefaults"];
    activateQuarantined?: boolean;
    actor?: ActorInfo;
    interactionId?: string | null;
  }) {
    const linkedInteraction = input.interactionId
      ? await db
          .select({ kind: issueThreadInteractions.kind })
          .from(issueThreadInteractions)
          .where(
            and(
              eq(issueThreadInteractions.id, input.interactionId),
              eq(issueThreadInteractions.companyId, input.connection.companyId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    // A task callback only prepares the catalog. The intent completion transaction
    // validates current ownership and adds the requesting agent's access.
    const deferTaskAccess = linkedInteraction?.kind === "connection_intent";
    const installs = await db
      .select()
      .from(toolConnectionInstalls)
      .where(
        and(
          eq(toolConnectionInstalls.companyId, input.connection.companyId),
          eq(toolConnectionInstalls.connectionId, input.connection.id),
        ),
      );
    const companyInstall = installs.some(
      (install) => install.targetType === "company",
    );
    const agentIds = installs
      .filter((install) => install.targetType === "agent")
      .map((install) => install.targetId);
    const suggestedAccess = input.suggestedDefaults.access;
    const suggestedAccessRecord = asRecord(suggestedAccess);
    const suggestedAgentIds = Array.isArray(suggestedAccessRecord.agentIds)
      ? suggestedAccessRecord.agentIds.filter(
          (agentId): agentId is string => typeof agentId === "string",
        )
      : [];
    const normalizedSuggestedAccess: FinishToolApp["access"] =
      suggestedAccess === "all_agents"
        ? "all_agents"
        : suggestedAgentIds.length > 0
          ? { agentIds: suggestedAgentIds }
          : "all_agents";
    // Workspace setup saves the operator's install selection before OAuth too.
    // An empty selection means no agents, not permission to apply all-agent
    // defaults after the user returns from Google.
    const preserveEmptyInstalls = input.connection.config.sourceTemplateKey === "google-workspace"
      || isRemoteMcpConnectorMethod(
      input.connection.config.sourceTemplateKey,
      input.connection.config.connectionMethodKey,
    ) || (input.connection.transport === "mcp_remote"
      && input.connection.config.mcpAgentAccessConfigured === true);
    const access: FinishToolApp["access"] = deferTaskAccess
      ? { agentIds: [] }
      : installs.length === 0
        ? preserveEmptyInstalls ? { agentIds: [] } : normalizedSuggestedAccess
        : companyInstall
          ? "all_agents"
          : { agentIds };
    const askFirstRiskLevels = new Set(
      Array.isArray(input.suggestedDefaults.askFirstRiskLevels)
        ? input.suggestedDefaults.askFirstRiskLevels.filter(
            (riskLevel): riskLevel is string => typeof riskLevel === "string",
          )
        : [],
    );
    const enabledCatalog = input.catalog.filter(
      (entry) =>
        entry.status === "active" ||
        (input.activateQuarantined === true && entry.status === "quarantined"),
    );
    const finished = await finishGalleryAppConnection(
      input.connection.companyId,
      input.connection.id,
      {
        enabledCatalogEntryIds: enabledCatalog.map((entry) => entry.id),
        askFirstCatalogEntryIds: enabledCatalog
          .filter((entry) => askFirstRiskLevels.has(entry.riskLevel))
          .map((entry) => entry.id),
        reviewedCatalogEntryIds:
          input.activateQuarantined === true
            ? enabledCatalog
                .filter((entry) => entry.status === "quarantined")
                .map((entry) => entry.id)
            : undefined,
        access,
        preserveExistingAccess: deferTaskAccess,
      },
      input.actor,
    );
    if (!deferTaskAccess && !preserveEmptyInstalls && installs.length === 0) {
      const installTargets =
        access === "all_agents"
          ? [
              {
                targetType: "company" as const,
                targetId: input.connection.companyId,
              },
            ]
          : [...new Set(access.agentIds)].map((agentId) => ({
              targetType: "agent" as const,
              targetId: agentId,
            }));
      if (installTargets.length > 0) {
        await db
          .insert(toolConnectionInstalls)
          .values(
            installTargets.map((target) => ({
              companyId: input.connection.companyId,
              connectionId: input.connection.id,
              ...target,
              createdByAgentId:
                input.actor?.actorType === "agent"
                  ? (input.actor.actorId ?? null)
                  : null,
              createdByUserId:
                input.actor?.actorType === "user"
                  ? (input.actor.actorId ?? null)
                  : null,
            })),
          )
          .onConflictDoNothing();
      }
    }
    return finished;
  }

  async function completePaperclipCloudConnectorCallback(input: {
    state: string;
    claimId?: string | null;
    error?: string | null;
    actor?: ActorInfo;
  }): Promise<ConnectToolAppResult> {
    // Keep the local state live until the sealed claim is in the durable vault.
    // The broker binds repeat claim requests to this stable state value, so a
    // transient broker, database, or secret-store failure can retry safely.
    const stateRow = await validateOAuthState(input.state, input.actor);
    let connection = await getConnectionRow(
      stateRow.connectionId,
      stateRow.companyId,
    );
    const preCloudCallbackLifecycle = {
      status: connection.status,
      enabled: connection.enabled,
    };
    // The connection lifecycle, not the incidental presence of its app profile,
    // distinguishes setup from reauthorization. New connections and connections
    // revived after removal are drafts until this callback completes. A profile
    // may legitimately survive removal because an MCP gateway retains it, or be
    // intentionally archived on an otherwise active connection; neither case
    // should invert whether recommended defaults are rebuilt.
    const shouldFinalizeManagedDefaults = connection.status === "draft";
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    const method = galleryEntry
      ? connectionMethodForConnection(galleryEntry, connection)
      : null;
    const providerName = galleryEntry?.name ?? "Google Workspace";
    if (input.error) {
      const consumedState = await consumeOAuthState(input.state, input.actor);
      await rejectPendingOAuthInteraction(consumedState, input.actor);
      throw new HttpError(
        400,
        `${providerName} authorization did not complete. Start a new ${providerName} connection to try again.`,
        {
          code:
            input.error === "access_denied"
              ? "oauth_authorization_denied"
              : "paperclip_cloud_connector_failed",
        },
      );
    }
    if (!input.claimId)
      throw badRequest(
        `${providerName} callback is missing a claim identifier`,
      );
    const cloudConnector = currentCloudConnector();
    if (!cloudConnector) {
      throw unprocessable(
        `${providerName} connections through Paperclip are not available on this instance yet`,
        {
          code: "paperclip_cloud_connector_unavailable",
        },
      );
    }
    const subjectUserId = stateRow.subjectUserId;
    const subjectAgentId = stateRow.subjectAgentId;
    if (
      !method ||
      !isPaperclipCloudConnectorStrategy(method.oauthStrategy) ||
      (!subjectUserId && !subjectAgentId)
    ) {
      throw badRequest(
        "OAuth state does not belong to a managed connector flow",
      );
    }
    const connectorProfile = method.connectorProfile;
    const profile = managedConnectorProfile(connectorProfile);
    if (!profile) throw badRequest("Managed connector profile is invalid");
    const connectorSubject = subjectAgentId
      ? `agent:${subjectAgentId}`
      : subjectUserId!;
    const credentials = await cloudConnector.claim({
      subject: connectorSubject,
      companyId: stateRow.companyId,
      profile: profile.id,
      claimId: input.claimId,
      redemptionId: input.state,
      ...(profile.id === "workspace.all" && stateRow.requestedScopes ? { scopes: stateRow.requestedScopes } : {}),
    });
    if (profile.id === "workspace.all") {
      const requested = normalizeOauthScopes(stateRow.requestedScopes);
      credentials.scopes = googleWorkspaceEffectiveScopes(requested, credentials.scopes);
      if (!isGoogleWorkspaceScopeGrant(credentials.scopes)) throw unprocessable("Google did not grant any selected service permissions", { code: "oauth_scope_grant_invalid" });
    }
    const refreshToken = credentials.refreshToken;
    if ((profile.provider === "google" || profile.provider === "asana") && !refreshToken) {
      throw unprocessable(
        `${providerName} did not return offline access. Reconnect and grant the requested permissions.`,
        {
          code: "oauth_refresh_missing",
        },
      );
    }
    const githubMetadata =
      profile.provider === "github"
        ? await loadGitHubGrantMetadata(
            credentials.accessToken,
            fetch,
            credentials.appSlug,
          )
        : null;
    const authorizingUserId =
      subjectUserId ??
      (stateRow.createdByActorType === "user"
        ? stateRow.createdByActorId
        : null);
    if (!authorizingUserId)
      throw forbidden(
        `A signed-in connection manager must authorize ${providerName}`,
      );

    await db.transaction(async (tx) => {
      // Keep connector credential persistence serialized with membership
      // suspension, downgrade, and removal. A successful claim is only durable
      // while the initiating user still holds connection-management authority.
      const [membership] = await tx
        .select({
          id: companyMemberships.id,
          membershipRole: companyMemberships.membershipRole,
        })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, connection.companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, authorizingUserId),
            eq(companyMemberships.status, "active"),
            ne(companyMemberships.membershipRole, "viewer"),
          ),
        )
        .limit(1)
        .for("update");
      if (!membership) {
        throw forbidden(
          `Your company membership no longer permits connection changes. Restore non-viewer access before you connect ${providerName} again.`,
        );
      }
      if (subjectAgentId) {
        const roleCanManage =
          membership.membershipRole === "owner" ||
          membership.membershipRole === "admin";
        const [explicitManagerGrant] = roleCanManage
          ? []
          : await tx
              .select({
                id: principalPermissionGrants.id,
              })
              .from(principalPermissionGrants)
              .where(
                and(
                  eq(principalPermissionGrants.companyId, connection.companyId),
                  eq(principalPermissionGrants.principalType, "user"),
                  eq(principalPermissionGrants.principalId, authorizingUserId),
                  eq(
                    principalPermissionGrants.permissionKey,
                    "tools:manage_connections",
                  ),
                ),
              )
              .limit(1)
              .for("update");
        if (!roleCanManage && !explicitManagerGrant) {
          throw forbidden(
            "Only a connection manager can authorize a dedicated agent identity.",
          );
        }
      }
      const [consumedState] = await tx
        .delete(toolOauthStates)
        .where(
          and(
            eq(toolOauthStates.state, input.state),
            gte(toolOauthStates.expiresAt, new Date()),
          ),
        )
        .returning({ state: toolOauthStates.state });
      if (!consumedState)
        throw badRequest(
          "OAuth state was not found, expired, or has already been used",
        );
      const txSecrets = secretService(tx);
      const txSecretContext = { dbClient: tx, secretClient: txSecrets };
      const personalCredential = connection.credentialPolicy === "per_user";
      const agentCredential = connection.credentialPolicy === "per_agent";
      const grantKind: ConnectionGrantKind = agentCredential
        ? "agent"
        : personalCredential
          ? "user"
          : "organization";
      const [existingCredentialGrant] = await tx
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, grantKind),
            agentCredential
              ? eq(connectionGrants.subjectAgentId, subjectAgentId!)
              : personalCredential
                ? eq(connectionGrants.subjectUserId, subjectUserId!)
                : eq(connectionGrants.isDefault, true),
          ),
        )
        .limit(1)
        .for("update");
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, connection.companyId)))
        .for("update");
      await tx.select({ id: toolConnections.id }).from(toolConnections)
        .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, connection.companyId)))
        .for("update");
      const existingRefs =
        existingCredentialGrant?.credentialSecretRefs ??
        (personalCredential || agentCredential
          ? []
          : connection.credentialSecretRefs);
      const accessRef = await createOrRotateOAuthSecret(
        {
          companyId: connection.companyId,
          connection,
          configPath: "oauth.access_token",
          label: `${providerName} access token`,
          value: credentials.accessToken,
          actor: input.actor,
          existingRefs,
          ownerUserId: personalCredential ? subjectUserId! : undefined,
        },
        txSecretContext,
      );
      const refreshRef = refreshToken
        ? await createOrRotateOAuthSecret(
            {
              companyId: connection.companyId,
              connection,
              configPath: "oauth.refresh_token",
              label: `${providerName} refresh token`,
              value: refreshToken,
              actor: input.actor,
              existingRefs,
              ownerUserId: personalCredential ? subjectUserId! : undefined,
            },
            txSecretContext,
          )
        : null;
      const credentialSecretRefs = [
        ...existingRefs.filter(
          (ref) =>
            ref.configPath !== "oauth.access_token" &&
            ref.configPath !== "oauth.refresh_token",
        ),
        accessRef,
        ...(refreshRef ? [refreshRef] : []),
      ];
      const grantValues = {
        providerTenant: {
          name: githubMetadata?.login ?? providerName,
          externalId: credentials.subject,
          oauth: {
            strategy: "paperclip_cloud_connector",
            accessTokenExpiresAt: credentials.accessTokenExpiresAt,
            scopes: credentials.scopes,
            requestedScopes: stateRow.requestedScopes ?? undefined,
            tokenType: credentials.tokenType,
            ...(credentials.refreshTokenExpiresAt
              ? { refreshTokenExpiresAt: credentials.refreshTokenExpiresAt }
              : {}),
            ...(credentials.accessTokenExpiresAt
              ? { refreshedAt: now().toISOString() }
              : {}),
          },
          ...(githubMetadata ? { github: githubMetadata } : {}),
        },
        credentialSecretRefs,
        status: "active" as const,
        revokedAt: null,
        revokedByAgentId: null,
        revokedByUserId: null,
        updatedAt: now(),
      };
      if (existingCredentialGrant) {
        await tx
          .update(connectionGrants)
          .set(grantValues)
          .where(eq(connectionGrants.id, existingCredentialGrant.id));
      } else {
        await tx.insert(connectionGrants).values({
          companyId: connection.companyId,
          connectionId: connection.id,
          kind: grantKind,
          subjectUserId: personalCredential ? subjectUserId : null,
          subjectAgentId: agentCredential ? subjectAgentId : null,
          ...grantValues,
          isDefault: grantKind === "organization",
          createdByUserId: authorizingUserId,
        });
      }
      const nextConfig = {
        ...connection.config,
        oauth: {
          ...oauthConfig(connection),
          strategy: "paperclip_cloud_connector",
          provider: galleryEntry?.slug,
          connectorProfile,
          connectorSubjectUserId: subjectUserId,
          connectorSubjectAgentId: subjectAgentId,
          resource: method.defaults?.serverUrl,
          scopes: [...profile.scopes],
        },
      };
      [connection] = await tx
        .update(toolConnections)
        .set({
          status: shouldFinalizeManagedDefaults ? "draft" : "active",
          enabled: shouldFinalizeManagedDefaults ? false : true,
          authKind: "oauth",
          config: nextConfig,
          transportConfig: nextConfig,
          credentialRefs:
            personalCredential || agentCredential
              ? connection.credentialRefs.filter(
                  (ref) => ref.name !== "oauth.access_token",
                )
              : [
                  ...connection.credentialRefs.filter(
                    (ref) => ref.name !== "oauth.access_token",
                  ),
                  {
                    name: "oauth.access_token",
                    secretId: accessRef.secretId,
                    version: "latest" as const,
                    placement: "header" as const,
                    key: "Authorization",
                    prefix: "Bearer ",
                  },
                ],
          credentialSecretRefs:
            personalCredential || agentCredential
              ? connection.credentialSecretRefs.filter(
                  (ref) =>
                    ref.configPath !== "oauth.access_token" &&
                    ref.configPath !== "oauth.refresh_token",
                )
              : credentialSecretRefs,
          updatedAt: now(),
        })
        .where(eq(toolConnections.id, connection.id))
        .returning();
      await tx
        .update(toolApplications)
        .set({
          status: shouldFinalizeManagedDefaults ? "draft" : "active",
          updatedAt: now(),
        })
        .where(eq(toolApplications.id, connection.applicationId));
      await syncCredentialBindings(
        connection,
        personalCredential || agentCredential ? credentialSecretRefs : [],
        tx,
      );
      const linkedInteractionKind = stateRow.interactionId
        ? await tx
            .select({ kind: issueThreadInteractions.kind })
            .from(issueThreadInteractions)
            .where(eq(issueThreadInteractions.id, stateRow.interactionId))
            .limit(1)
            .then((rows) => rows[0]?.kind ?? null)
        : null;
      if (
        stateRow.interactionId &&
        linkedInteractionKind === "request_confirmation"
      ) {
        await tx
          .update(issueThreadInteractions)
          .set({
            status: "accepted",
            result: { version: 1, outcome: "accepted" },
            resolvedByUserId: authorizingUserId,
            resolvedAt: now(),
            updatedAt: now(),
          })
          .where(eq(issueThreadInteractions.id, stateRow.interactionId));
      }
    });
    // The transaction above committed the connection's lifecycle write; a
    // Paperclip Cloud connector callback is the managed variant of an OAuth
    // callback completion.
    emitConnectionUpdated(connection, preCloudCallbackLifecycle, "oauth_callback");
    if (githubMetadata) {
      const [githubGrant] = await db
        .select({ id: connectionGrants.id })
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
            subjectAgentId
              ? and(
                  eq(connectionGrants.kind, "agent"),
                  eq(connectionGrants.subjectAgentId, subjectAgentId),
                )
              : and(
                  eq(connectionGrants.kind, "user"),
                  eq(connectionGrants.subjectUserId, subjectUserId!),
                ),
          ),
        )
        .limit(1);
      if (!githubGrant) throw new Error("GitHub grant was not persisted");
      await Promise.all(
        githubMetadata.installationIds.map((installationId) =>
          cloudConnector.setWebhookBinding({
            subject: connectorSubject,
            companyId: connection.companyId,
            id: `${githubGrant.id}_${installationId}`,
            installationId,
            connectionId: connection.id,
            grantId: githubGrant.id,
            active: true,
            accessToken: credentials.accessToken,
          }),
        ),
      );
    }
    const refresh = await refreshCatalog(connection.id, input.actor, {
      enableAllByDefault: false,
      quarantineManagedOAuthDraft: shouldFinalizeManagedDefaults,
      skipDefaultProfileSync: true,
      credentialHeaders: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const recommended = recommendedDefaultsForApp(galleryEntry!, method.key);
    const suggestedDefaults = subjectAgentId
      ? { ...recommended, access: { agentIds: [subjectAgentId] } as const }
      : recommended;
    const finished = shouldFinalizeManagedDefaults
      ? await finishOAuthCatalogWithRecommendedDefaults({
          interactionId: stateRow.interactionId,
          connection,
          catalog: refresh.catalog,
          suggestedDefaults,
          activateQuarantined: true,
          actor: input.actor,
        })
      : null;
    const activatedCatalogEntryIds = new Set(
      shouldFinalizeManagedDefaults
        ? refresh.catalog
            .filter((entry) => entry.status === "quarantined")
            .map((entry) => entry.id)
        : [],
    );
    const catalog = refresh.catalog.map((entry) =>
      activatedCatalogEntryIds.has(entry.id)
        ? { ...entry, status: "active" as const }
        : entry,
    );
    const [application] = await db
      .select()
      .from(toolApplications)
      .where(eq(toolApplications.id, connection.applicationId));
    return {
      connectionId: connection.id,
      application: toApplication(application),
      connection: finished?.connection ?? refresh.connection,
      catalog,
      actions: groupedActions(catalog),
      suggestedDefaults,
      auth: null,
    };
  }

  async function completeVercelConnectCallback(input: {
    state: string;
    error?: string | null;
    actor?: ActorInfo;
  }): Promise<ConnectToolAppResult> {
    const stateRow = await consumeOAuthState(input.state, input.actor);
    if (stateRow.codeVerifier !== "vercel-connect") {
      throw badRequest("OAuth state does not belong to a Vercel Connect flow");
    }
    if (input.error) {
      await rejectPendingOAuthInteraction(stateRow, input.actor);
      throw new HttpError(
        400,
        "Vercel Connect authorization did not complete. Start a new authorization to try again.",
        {
          code:
            input.error === "access_denied"
              ? "oauth_authorization_denied"
              : "vercel_connect_authorization_required",
        },
      );
    }
    if (!vercelConnect)
      throw vercelConnectHttpError(
        new VercelConnectClientError("vercel_connect_unavailable", 503),
      );
    let connection = await getConnectionRow(
      stateRow.connectionId,
      stateRow.companyId,
    );
    const credential = vercelCredentialFor(connection);
    if (
      credential.principalMode !== "user" ||
      connection.authKind !== "oauth"
    ) {
      throw badRequest(
        "Vercel Connect callback does not match this connection",
      );
    }
    const grantKind: ConnectionGrantKind = stateRow.subjectUserId
      ? "user"
      : "organization";
    if (stateRow.subjectUserId) {
      const [membership] = await db
        .select({ id: companyMemberships.id })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, connection.companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, stateRow.subjectUserId),
            eq(companyMemberships.status, "active"),
            ne(companyMemberships.membershipRole, "viewer"),
          ),
        )
        .limit(1);
      if (!membership) {
        throw forbidden(
          "Your company membership no longer permits connection changes. Restore non-viewer access before authorizing this connection.",
        );
      }
    }
    const [existingGrant] = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, connection.companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, grantKind),
          grantKind === "user"
            ? eq(connectionGrants.subjectUserId, stateRow.subjectUserId!)
            : eq(connectionGrants.isDefault, true),
        ),
      )
      .limit(1);
    const derived = deriveVercelConnectSubject({
      credential,
      connectionId: connection.id,
      companyId: connection.companyId,
      grantKind,
      subjectUserId: stateRow.subjectUserId,
    });
    const request = vercelTokenRequest({
      credential,
      connectionId: connection.id,
      companyId: connection.companyId,
      resources: vercelConnectResourcesFor(connection),
      grant: {
        kind: grantKind,
        subjectUserId: stateRow.subjectUserId,
        externalCredential: existingGrant?.externalCredential,
      },
    });
    let token;
    try {
      token = await vercelConnect.getToken(request, { forceRefresh: true });
    } catch (error) {
      throw vercelConnectHttpError(error);
    }
    if (
      token.connector.id !== credential.connectorId &&
      token.connector.uid !== credential.connectorUid
    ) {
      throw new HttpError(
        502,
        "Vercel Connect returned a token for a different connector.",
        {
          code: "vercel_connect_connector_mismatch",
        },
      );
    }
    const externalGrant = vercelGrantReference({
      credential,
      token,
      subjectId: derived.subjectId,
      verifiedAt: now(),
    });
    const grantValues = {
      providerTenant: token.tenantId
        ? { name: credential.service, externalId: token.tenantId }
        : { name: credential.service },
      credentialSecretRefs: [],
      externalCredential: externalGrant,
      status: "active" as const,
      isDefault: grantKind === "organization",
      revokedAt: null,
      revokedByAgentId: null,
      revokedByUserId: null,
      updatedAt: now(),
    };
    if (existingGrant) {
      await db
        .update(connectionGrants)
        .set(grantValues)
        .where(eq(connectionGrants.id, existingGrant.id));
    } else {
      await db.insert(connectionGrants).values({
        companyId: connection.companyId,
        connectionId: connection.id,
        kind: grantKind,
        subjectUserId: stateRow.subjectUserId,
        ...grantValues,
        createdByUserId:
          input.actor?.actorType === "user"
            ? (input.actor.actorId ?? null)
            : null,
      });
    }
    const preActivationLifecycle = {
      status: connection.status,
      enabled: connection.enabled,
    };
    [connection] = await db
      .update(toolConnections)
      .set({
        status: "active",
        enabled: true,
        credentialRefs: [],
        credentialSecretRefs: [],
        updatedAt: now(),
      })
      .where(
        and(
          eq(toolConnections.id, connection.id),
          eq(toolConnections.companyId, connection.companyId),
        ),
      )
      .returning();
    emitConnectionUpdated(
      connection,
      preActivationLifecycle,
      "oauth_callback",
    );
    await db
      .update(toolApplications)
      .set({ status: "active", updatedAt: now() })
      .where(eq(toolApplications.id, connection.applicationId));
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    if (!galleryEntry)
      throw badRequest(
        "Vercel Connect connection is missing its reviewed app definition",
      );
    const method = connectionMethodForConnection(galleryEntry, connection);
    const refresh = await refreshCatalog(connection.id, input.actor, {
      enableAllByDefault: true,
      skipDefaultProfileSync: true,
      credentialHeaders: {
        ...projectedConnectionHeaders(connection),
        [credential.headerName]: `${credential.headerPrefix ?? ""}${token.token}`,
      },
    });
    const suggestedDefaults = recommendedDefaultsForApp(
      galleryEntry,
      method.key,
    );
    const finished = await finishOAuthCatalogWithRecommendedDefaults({
      interactionId: stateRow.interactionId,
      connection,
      catalog: refresh.catalog,
      suggestedDefaults,
      actor: input.actor,
    });
    const [application] = await db
      .select()
      .from(toolApplications)
      .where(eq(toolApplications.id, connection.applicationId));
    return {
      connectionId: connection.id,
      application: toApplication(application),
      connection: finished.connection,
      catalog: refresh.catalog,
      actions: groupedActions(refresh.catalog),
      suggestedDefaults,
      auth: null,
    };
  }

  async function completeOAuthCallback(input: {
    state: string;
    code?: string | null;
    /**
     * RFC 6749 `error`. Untrusted, and deliberately the *only* thing read from a
     * failed callback — `error_description` and `error_uri` are not accepted as
     * input at all, so there is nothing for a hostile provider to reflect
     * through (PAP-17108).
     */
    error?: string | null;
    redirectUri: string;
    /** RFC 9207 `iss`, when the authorization server returns it. */
    iss?: string | null;
    actor?: ActorInfo;
  }): Promise<ConnectToolAppResult> {
    // Binding first, outcome second: the provider's report of a failure is only
    // acted on once the callback is bound to a state Paperclip issued and to the
    // actor that started the flow, so an unsolicited callback cannot drive any
    // path here. Consuming the state up front is what makes a denial terminal —
    // a refused request must not stay completable by a later code (PAP-17109).
    const stateRow = await consumeOAuthState(input.state, input.actor);
    if (input.error) {
      await rejectPendingOAuthInteraction(stateRow, input.actor);
      const providerError = normalizeOAuthProviderError(input.error);
      throw new HttpError(
        400,
        oauthProviderErrorMessage(
          providerError,
          "The authorization server denied the request.",
        ),
        {
          code: "oauth_authorization_denied",
          providerError,
        },
      );
    }
    // Neither a code nor an error is not a usable answer either. It still spends
    // the request: the recovery is a fresh authorization, not a state left live
    // waiting for a better callback.
    if (!input.code) throw badRequest("OAuth callback is missing a code");

    let connection = await getConnectionRow(
      stateRow.connectionId,
      stateRow.companyId,
    );
    // Reauthorization refreshes credentials and catalog without rebuilding the
    // operator's action profile, policy rules, or access bindings.
    const shouldFinalizeDefaults = connection.status === "draft";
    const preCallbackLifecycle = {
      status: connection.status,
      enabled: connection.enabled,
    };
    await assertConnectorConnectionSetupEnabled(connection);
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    assertOAuthRedirectConstraints(galleryEntry, input.redirectUri);
    const endpoints = await oauthEndpointsForConnection(
      connection,
      null,
      input.redirectUri,
    );
    assertOAuthCallbackIssuer(connection, endpoints, input.iss);
    // Generic states created before requested scopes were persisted may still
    // complete after an upgrade. Keep their original cached/discovered scope set.
    const authorizedScopes = normalizeOauthScopes(
      stateRow.requestedScopes ?? (galleryEntry ? [] : endpoints.scopes),
    );
    const client = await oauthClientForConnection(
      connection,
      endpoints.provider,
      input.actor,
    );
    if (!client.clientId)
      throw unprocessable(
        `OAuth client id is not configured for ${endpoints.provider}`,
      );

    const token = await exchangeOAuthToken({
      tokenUrl: endpoints.tokenUrl,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      tokenEndpointAuthMethod: storedOAuthTokenEndpointAuthMethod(
        oauthConfig(connection),
        client.clientSecret,
      ),
      redirectUri: input.redirectUri,
      codeVerifier: stateRow.codeVerifier,
      code: input.code,
      resource: endpoints.resource,
    });
    if (sourceTemplateKey === "google-workspace" && !isGoogleWorkspaceScopeGrant(normalizeOauthScopes(token.scope))) {
      throw unprocessable("Google did not return a supported permission grant. Reconnect and choose the Google services you want to use.", { code: "oauth_scope_grant_invalid" });
    }
    if (sourceTemplateKey === "google-workspace") {
      token.scope = googleWorkspaceEffectiveScopes(authorizedScopes, normalizeOauthScopes(token.scope)).join(" ");
      if (!token.scope) throw unprocessable("Google did not grant any selected service permissions", { code: "oauth_scope_grant_invalid" });
    }
    const connectedAt = now();
    const expiresAt = token.expiresIn
      ? new Date(connectedAt.getTime() + token.expiresIn * 1000).toISOString()
      : null;
    if (stateRow.subjectUserId) {
      let personalCredentialSecretRefs: typeof connectionGrants.$inferSelect.credentialSecretRefs =
        [];
      await db.transaction(async (tx) => {
        // Serialize callback persistence with suspension/removal. Those paths
        // lock this same membership row before sweeping personal credentials.
        const [membership] = await tx
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, connection.companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, stateRow.subjectUserId!),
              eq(companyMemberships.status, "active"),
              ne(companyMemberships.membershipRole, "viewer"),
            ),
          )
          .limit(1)
          .for("update");
        if (!membership) {
          throw forbidden(
            "Your company membership no longer permits connection changes. Ask a company owner to restore non-viewer access before you authorize this connection again.",
          );
        }
        const txSecrets = secretService(tx);
        const txSecretContext = { dbClient: tx, secretClient: txSecrets };

        const [existingUserGrant] = await tx
          .select()
          .from(connectionGrants)
          .where(
            and(
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
              eq(connectionGrants.kind, "user"),
              eq(connectionGrants.subjectUserId, stateRow.subjectUserId!),
            ),
          )
          .limit(1)
          .for("update");
        await tx.select({ id: toolApplications.id }).from(toolApplications)
          .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, connection.companyId)))
          .for("update");
        await tx.select({ id: toolConnections.id }).from(toolConnections)
          .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, connection.companyId)))
          .for("update");
        const subjectCredentialSecretRefs =
          existingUserGrant?.credentialSecretRefs ?? [];
        const accessRef = await createOrRotateOAuthSecret(
          {
            companyId: connection.companyId,
            connection,
            configPath: "oauth.access_token",
            label: "OAuth access token",
            value: token.accessToken,
            actor: input.actor,
            existingRefs: subjectCredentialSecretRefs,
            ownerUserId: stateRow.subjectUserId!,
          },
          txSecretContext,
        );
        const nextCredentialSecretRefs = [
          ...subjectCredentialSecretRefs.filter(
            (ref) =>
              ref.configPath !== "oauth.access_token" &&
              ref.configPath !== "oauth.refresh_token",
          ),
          accessRef,
        ];
        if (token.refreshToken) {
          nextCredentialSecretRefs.push(
            await createOrRotateOAuthSecret(
              {
                companyId: connection.companyId,
                connection,
                configPath: "oauth.refresh_token",
                label: "OAuth refresh token",
                value: token.refreshToken,
                actor: input.actor,
                existingRefs: subjectCredentialSecretRefs,
                ownerUserId: stateRow.subjectUserId!,
              },
              txSecretContext,
            ),
          );
        } else {
          const existingRefreshRef = subjectCredentialSecretRefs.find(
            (ref) => ref.configPath === "oauth.refresh_token",
          );
          if (existingRefreshRef)
            nextCredentialSecretRefs.push(existingRefreshRef);
        }

        const grantedScopes = resolveGrantedOauthScopes({
          tokenScope: token.scope,
          requestedScopes: authorizedScopes,
        });
        const grantValues = {
          providerTenant: {
            ...(existingUserGrant?.providerTenant ?? {}),
            oauth: {
              ...asRecord(asRecord(existingUserGrant?.providerTenant).oauth),
              strategy: "direct_oauth",
              accessTokenExpiresAt: expiresAt ?? undefined,
              scopes: grantedScopes.scopes,
              scopeSource: grantedScopes.scopeSource,
              unrequestedScopes: grantedScopes.unrequestedScopes,
              // Per-grant, because two users can authorize the same connection with
              // different scopes. The connection-level list is whichever callback ran last,
              // so it is the wrong baseline for anyone else's refresh.
              requestedScopes: authorizedScopes,
              tokenType: token.tokenType,
              refreshedAt: connectedAt.toISOString(),
            },
          },
          credentialSecretRefs: nextCredentialSecretRefs,
          status: "active" as const,
          revokedAt: null,
          revokedByAgentId: null,
          revokedByUserId: null,
          updatedAt: new Date(),
        };
        if (existingUserGrant) {
          await tx
            .update(connectionGrants)
            .set(grantValues)
            .where(eq(connectionGrants.id, existingUserGrant.id));
        } else {
          await tx.insert(connectionGrants).values({
            companyId: connection.companyId,
            connectionId: connection.id,
            kind: "user",
            subjectUserId: stateRow.subjectUserId!,
            ...grantValues,
            isDefault: false,
            createdByUserId: stateRow.subjectUserId!,
          });
        }
        personalCredentialSecretRefs = nextCredentialSecretRefs;
        const nextConfig = {
          ...connection.config,
          oauth: {
            ...withoutOAuthRefreshLease(oauthConfig(connection)),
            provider: endpoints.provider,
            authorizationUrl: endpoints.authorizationUrl,
            tokenUrl: endpoints.tokenUrl,
            metadataUrl: endpoints.metadataUrl ?? null,
            scopes: authorizedScopes,
            clientIdEnv: client.clientIdEnv,
            clientSecretEnv: client.clientSecret
              ? client.clientSecretEnv
              : null,
            credentialScope: credentialScope(connection, input.actor),
            issuer: endpoints.issuer ?? oauthConfig(connection).issuer ?? null,
            resource:
              endpoints.resource ?? oauthConfig(connection).resource ?? null,
            expiresAt,
            scope: token.scope,
            tokenType: token.tokenType,
            connectedAt: connectedAt.toISOString(),
          },
          providerMetadata: {
            ...asRecord(connection.config.providerMetadata),
            oauth: {
              expiresAt,
              scope: token.scope,
              scopeSource: grantedScopes.scopeSource,
              unrequestedScopes: grantedScopes.unrequestedScopes,
              tokenType: token.tokenType,
            },
          },
        };
        const [updatedConnection] = await tx
          .update(toolConnections)
          .set({
            status: "active",
            enabled: true,
            authKind: "oauth",
            credentialPolicy: connection.credentialPolicy,
            config: nextConfig,
            transportConfig: nextConfig,
            // A personal-only connection keeps tokens exclusively on its user
            // grant. Adding a personal identity to an existing shared/fallback
            // connection must not erase that connection's organization token.
            credentialRefs:
              connection.credentialPolicy === "per_user"
                ? connection.credentialRefs.filter(
                    (ref) => ref.name !== "oauth.access_token",
                  )
                : connection.credentialRefs,
            credentialSecretRefs:
              connection.credentialPolicy === "per_user"
                ? connection.credentialSecretRefs.filter(
                    (ref) =>
                      ref.configPath !== "oauth.access_token" &&
                      ref.configPath !== "oauth.refresh_token",
                  )
                : connection.credentialSecretRefs,
            updatedAt: new Date(),
          })
          .where(eq(toolConnections.id, connection.id))
          .returning();
        if (!updatedConnection)
          throw new Error("OAuth connection was not found");
        connection = updatedConnection;
        await tx
          .update(toolApplications)
          .set({
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(toolApplications.id, connection.applicationId));
        const linkedInteractionKind = stateRow.interactionId
          ? await tx
              .select({ kind: issueThreadInteractions.kind })
              .from(issueThreadInteractions)
              .where(eq(issueThreadInteractions.id, stateRow.interactionId))
              .limit(1)
              .then((rows) => rows[0]?.kind ?? null)
          : null;
        if (
          stateRow.interactionId &&
          linkedInteractionKind === "request_confirmation"
        ) {
          await tx
            .update(issueThreadInteractions)
            .set({
              status: "accepted",
              result: { version: 1, outcome: "accepted" },
              resolvedByUserId: stateRow.subjectUserId!,
              resolvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(issueThreadInteractions.id, stateRow.interactionId),
                eq(issueThreadInteractions.companyId, connection.companyId),
              ),
            );
        }
        await syncCredentialBindings(
          connection,
          connection.credentialPolicy === "per_user"
            ? personalCredentialSecretRefs
            : [],
          tx,
        );
      });
      emitConnectionUpdated(
        connection,
        preCallbackLifecycle,
        "oauth_callback",
      );

      // Personal OAuth used to return immediately after saving the grant. That
      // left the connection draft/paused and its catalog empty, so the person
      // who had just consented landed on a false "Nothing to test" state.
      // Activate and discover with the just-issued token before returning.
      const refresh = await refreshCatalog(connection.id, input.actor, {
        enableAllByDefault: shouldFinalizeDefaults,
        skipDefaultProfileSync: shouldFinalizeDefaults,
        credentialHeaders: { Authorization: `Bearer ${token.accessToken}` },
      });
      const [application] = await db
        .select()
        .from(toolApplications)
        .where(eq(toolApplications.id, connection.applicationId));
      if (!application)
        throw new Error("OAuth connection application was not found");
      const suggestedDefaults = galleryEntry
        ? recommendedDefaultsForApp(
            galleryEntry,
            connectionMethodForConnection(galleryEntry, connection).key,
          )
        : { access: "all_agents" as const, askFirstRiskLevels: [] };
      const finished = shouldFinalizeDefaults
        ? await finishOAuthCatalogWithRecommendedDefaults({
            interactionId: stateRow.interactionId,
            connection,
            catalog: refresh.catalog,
            suggestedDefaults,
            actor: input.actor,
          })
        : null;
      return {
        connectionId: refresh.connection.id,
        application: toApplication(application),
        connection: finished?.connection ?? refresh.connection,
        catalog: refresh.catalog,
        actions: groupedActions(refresh.catalog),
        suggestedDefaults,
        auth: null,
      };
    }

    const organizationActorUserId =
      stateRow.createdByActorType === "user" ? stateRow.createdByActorId : null;
    if (!organizationActorUserId) {
      throw forbidden(
        "Organization OAuth completion requires the user who started sign-in",
      );
    }
    await db.transaction(async (tx) => {
      // Keep callback persistence serialized with membership suspension, role
      // downgrade, and removal. Once this row is locked, authority cannot be
      // revoked between the live check and the shared credential/grant writes.
      const [membership] = await tx
        .select({
          id: companyMemberships.id,
          membershipRole: companyMemberships.membershipRole,
        })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, connection.companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, organizationActorUserId),
            eq(companyMemberships.status, "active"),
            ne(companyMemberships.membershipRole, "viewer"),
          ),
        )
        .limit(1)
        .for("update");
      if (!membership) {
        throw forbidden(
          "Your company membership no longer permits connection changes. Ask a company owner to restore non-viewer access before you authorize this connection again.",
        );
      }
      const roleCanManage =
        membership.membershipRole === "owner" ||
        membership.membershipRole === "admin";
      const [explicitManagerGrant] = roleCanManage
        ? []
        : await tx
            .select({
              id: principalPermissionGrants.id,
            })
            .from(principalPermissionGrants)
            .where(
              and(
                eq(principalPermissionGrants.companyId, connection.companyId),
                eq(principalPermissionGrants.principalType, "user"),
                eq(
                  principalPermissionGrants.principalId,
                  organizationActorUserId,
                ),
                eq(
                  principalPermissionGrants.permissionKey,
                  "tools:manage_connections",
                ),
              ),
            )
            .limit(1)
            .for("update");
      if (!roleCanManage && !explicitManagerGrant) {
        throw forbidden(
          "Only a company owner, admin, or member with connection-manager permission can share credentials with the organization.",
        );
      }
      await tx.select({ id: connectionGrants.id }).from(connectionGrants)
        .where(and(eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "organization"), eq(connectionGrants.isDefault, true)))
        .for("update");
      await tx.select({ id: toolApplications.id }).from(toolApplications)
        .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, connection.companyId)))
        .for("update");
      await tx.select({ id: toolConnections.id }).from(toolConnections)
        .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, connection.companyId)))
        .for("update");
      const txSecrets = secretService(tx);
      const txSecretContext = { dbClient: tx, secretClient: txSecrets };

      const subjectCredentialSecretRefs = connection.credentialSecretRefs;
      const accessRef = await createOrRotateOAuthSecret(
        {
          companyId: connection.companyId,
          connection,
          configPath: "oauth.access_token",
          label: "OAuth access token",
          value: token.accessToken,
          actor: input.actor,
        },
        txSecretContext,
      );
      const nextCredentialSecretRefs = [
        ...subjectCredentialSecretRefs.filter(
          (ref) =>
            ref.configPath !== "oauth.access_token" &&
            ref.configPath !== "oauth.refresh_token",
        ),
        accessRef,
      ];
      if (token.refreshToken) {
        nextCredentialSecretRefs.push(
          await createOrRotateOAuthSecret(
            {
              companyId: connection.companyId,
              connection,
              configPath: "oauth.refresh_token",
              label: "OAuth refresh token",
              value: token.refreshToken,
              actor: input.actor,
            },
            txSecretContext,
          ),
        );
      } else {
        const existingRefreshRef = subjectCredentialSecretRefs.find(
          (ref) => ref.configPath === "oauth.refresh_token",
        );
        if (existingRefreshRef)
          nextCredentialSecretRefs.push(existingRefreshRef);
      }
      const organizationGrantedScopes = resolveGrantedOauthScopes({
        tokenScope: token.scope,
        requestedScopes: authorizedScopes,
      });
      const nextConfig = {
        ...connection.config,
        oauth: {
          ...withoutOAuthRefreshLease(oauthConfig(connection)),
          provider: endpoints.provider,
          authorizationUrl: endpoints.authorizationUrl,
          tokenUrl: endpoints.tokenUrl,
          metadataUrl: endpoints.metadataUrl ?? null,
          scopes: authorizedScopes,
          clientIdEnv: client.clientIdEnv,
          clientSecretEnv: client.clientSecret ? client.clientSecretEnv : null,
          credentialScope: credentialScope(connection, input.actor),
          // Keep the issuer and resource this grant was minted against so refresh,
          // reconnect, revoke and diagnostics resolve the same authorization server
          // instead of re-discovering one from a possibly-changed endpoint.
          issuer: endpoints.issuer ?? oauthConfig(connection).issuer ?? null,
          resource:
            endpoints.resource ?? oauthConfig(connection).resource ?? null,
          expiresAt,
          scope: token.scope,
          tokenType: token.tokenType,
          connectedAt: connectedAt.toISOString(),
        },
        providerMetadata: {
          ...asRecord(connection.config.providerMetadata),
          oauth: {
            expiresAt,
            scope: token.scope,
            scopeSource: organizationGrantedScopes.scopeSource,
            unrequestedScopes: organizationGrantedScopes.unrequestedScopes,
            tokenType: token.tokenType,
          },
        },
      };
      const [updatedConnection] = await tx
        .update(toolConnections)
        .set({
          status: "active",
          enabled: true,
          authKind: "oauth",
          config: nextConfig,
          transportConfig: nextConfig,
          credentialSecretRefs: nextCredentialSecretRefs,
          credentialRefs: [
            ...connection.credentialRefs.filter(
              (ref) => ref.name !== "oauth.access_token",
            ),
            {
              name: "oauth.access_token",
              secretId: accessRef.secretId,
              version: "latest" as const,
              placement: "header" as const,
              key: "Authorization",
              prefix: "Bearer ",
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(toolConnections.id, connection.id))
        .returning();
      connection = updatedConnection;
      await tx
        .update(toolApplications)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(toolApplications.id, connection.applicationId));
      // The organization grant is created before OAuth has any secrets to attach.
      // Synchronize it after every successful callback/rotation so all real tool
      // execution paths receive the credentials that setup and catalog discovery
      // just proved.
      await ensureDefaultOrganizationGrant(connection, tx, undefined, {
        scopes: organizationGrantedScopes.scopes,
        scopeSource: organizationGrantedScopes.scopeSource,
        unrequestedScopes: organizationGrantedScopes.unrequestedScopes,
        requestedScopes: authorizedScopes,
      });
      await syncCredentialBindings(connection, [], tx);
    });
    emitConnectionUpdated(
      connection,
      preCallbackLifecycle,
      "oauth_callback",
    );

    await checkConnectionHealth(connection.id, input.actor);
    const refresh = await refreshCatalog(connection.id, input.actor, {
      enableAllByDefault: shouldFinalizeDefaults,
      skipDefaultProfileSync: shouldFinalizeDefaults,
    });
    const [application] = await db
      .select()
      .from(toolApplications)
      .where(eq(toolApplications.id, connection.applicationId));
    const suggestedDefaults = galleryEntry
      ? recommendedDefaultsForApp(
          galleryEntry,
          connectionMethodForConnection(galleryEntry, connection).key,
        )
      : {
          access: "all_agents" as const,
          askFirstRiskLevels: [],
        };
    const finished = shouldFinalizeDefaults
      ? await finishOAuthCatalogWithRecommendedDefaults({
          interactionId: stateRow.interactionId,
          connection,
          catalog: refresh.catalog,
          suggestedDefaults,
          actor: input.actor,
        })
      : null;
    return {
      connectionId: refresh.connection.id,
      application: toApplication(application),
      connection: finished?.connection ?? refresh.connection,
      catalog: refresh.catalog,
      actions: groupedActions(refresh.catalog),
      suggestedDefaults,
      auth: null,
    };
  }

  /**
   * Finish the one decision that cannot safely be guessed for a browser OAuth
   * connection: whether the consenting identity stays personal or becomes the
   * company's shared identity. The provider callback always writes a fresh
   * token to the consenting user's grant first. Only this explicit endpoint may
   * promote it to company-scoped secrets.
   */
  async function finalizeOAuthAccess(
    companyId: string,
    connectionId: string,
    input: FinalizeOAuthAccess,
    actor?: ActorInfo,
    requestingAgentId?: string,
  ): Promise<FinishToolAppResult> {
    if (requestingAgentId)
      await assertAgentsInCompany(companyId, [requestingAgentId]);
    let connection = await getConnectionRow(connectionId, companyId);
    const preFinalizeLifecycle = {
      status: connection.status,
      enabled: connection.enabled,
    };
    if (connection.authKind !== "oauth")
      throw badRequest("This connection does not use browser sign-in");
    if (connection.status === "archived")
      throw conflict("Archived app connections cannot be finished");
    const actorUserId = actor?.actorType === "user" ? actor.actorId : null;
    if (!actorUserId)
      throw badRequest("Finishing browser sign-in requires a signed-in user");

    const [personalGrant] = await db
      .select()
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.companyId, companyId),
          eq(connectionGrants.connectionId, connection.id),
          eq(connectionGrants.kind, "user"),
          eq(connectionGrants.subjectUserId, actorUserId),
        ),
      )
      .limit(1);

    if (connection.credentialSource === "vercel_connect") {
      const [organizationGrant] = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, companyId),
            eq(connectionGrants.connectionId, connection.id),
            eq(connectionGrants.kind, "organization"),
            eq(connectionGrants.isDefault, true),
          ),
        )
        .limit(1);
      const selectedGrant =
        input.grantKind === "user" ? personalGrant : organizationGrant;
      if (
        !selectedGrant ||
        selectedGrant.status !== "active" ||
        !selectedGrant.externalCredential
      ) {
        throw conflict(
          "The selected Vercel Connect identity is missing. Authorize this connection again.",
        );
      }
      const expectedPolicy = input.grantKind === "user" ? "per_user" : "shared";
      if (connection.credentialPolicy !== expectedPolicy) {
        throw conflict(
          "Vercel Connect identity scope is fixed when the connector is attached. Create a new connection to change it.",
        );
      }
    } else if (input.grantKind === "user") {
      if (
        !personalGrant ||
        personalGrant.status !== "active" ||
        personalGrant.credentialSecretRefs.length === 0
      ) {
        throw conflict(
          "Your connected identity is missing. Connect this app again before choosing Just me.",
        );
      }
      if (
        connection.credentialPolicy === "shared" &&
        connection.credentialSecretRefs.length > 0
      ) {
        throw conflict("This connection already uses a company identity");
      }
      [connection] = await db
        .update(toolConnections)
        .set({
          credentialPolicy: "per_user",
          credentialRefs: connection.credentialRefs.filter(
            (ref) => ref.name !== "oauth.access_token",
          ),
          credentialSecretRefs: connection.credentialSecretRefs.filter(
            (ref) =>
              ref.configPath !== "oauth.access_token" &&
              ref.configPath !== "oauth.refresh_token",
          ),
          status: "active",
          enabled: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(toolConnections.id, connection.id),
            eq(toolConnections.companyId, companyId),
          ),
        )
        .returning();
      await syncCredentialBindings(
        connection,
        personalGrant.credentialSecretRefs,
      );
    } else if (
      connection.credentialPolicy !== "shared" ||
      connection.credentialSecretRefs.length === 0
    ) {
      if (
        !personalGrant ||
        personalGrant.status !== "active" ||
        personalGrant.credentialSecretRefs.length === 0
      ) {
        throw conflict(
          "Your connected identity is missing. Connect this app again before sharing it.",
        );
      }

      const personalSecretIds = personalGrant.credentialSecretRefs.map(
        (ref) => ref.secretId,
      );
      const personalSecretRows = await db
        .select({
          id: companySecrets.id,
          scope: companySecrets.scope,
          ownerUserId: companySecrets.ownerUserId,
          userSecretDefinitionId: companySecrets.userSecretDefinitionId,
        })
        .from(companySecrets)
        .where(
          and(
            eq(companySecrets.companyId, companyId),
            inArray(companySecrets.id, personalSecretIds),
          ),
        );
      const personalSecretById = new Map(
        personalSecretRows.map((row) => [row.id, row]),
      );
      const promotedRefs: ToolCredentialSecretRef[] = [];
      try {
        for (const ref of personalGrant.credentialSecretRefs) {
          const secretRow = personalSecretById.get(ref.secretId);
          if (
            !secretRow ||
            secretRow.scope !== "user" ||
            secretRow.ownerUserId !== actorUserId ||
            !secretRow.userSecretDefinitionId
          ) {
            throw forbidden(
              "Only your own connected identity can be shared with the company",
            );
          }
          if (
            ref.configPath !== "oauth.access_token" &&
            ref.configPath !== "oauth.refresh_token" &&
            ref.configPath !== "oauth.client_secret"
          ) {
            throw badRequest(
              "The connected identity contains an unsupported OAuth credential",
            );
          }
          const resolved = await secrets.resolveUserSecretValue(
            companyId,
            {
              definitionId: secretRow.userSecretDefinitionId,
              responsibleUserId: actorUserId,
              version: ref.versionSelector ?? "latest",
            },
            {
              consumerType: "tool_connection",
              consumerId: connection.id,
              responsibleUserId: actorUserId,
              actorType: "user",
              actorId: actorUserId,
            },
          );
          if (!resolved)
            throw unprocessable("The connected identity could not be read");
          const promoted = await createOrRotateOAuthSecret({
            companyId,
            connection,
            configPath: ref.configPath,
            label: ref.label ?? "OAuth credential",
            value: resolved.value,
            actor,
            existingRefs: promotedRefs,
          });
          promotedRefs.push({ ...ref, ...promoted });
        }

        const accessRef = promotedRefs.find(
          (ref) => ref.configPath === "oauth.access_token",
        );
        if (!accessRef)
          throw unprocessable(
            "The connected identity is missing its OAuth access token",
          );
        const connectionCredentialSecretRefs = [
          ...connection.credentialSecretRefs.filter(
            (ref) =>
              ref.configPath !== "oauth.access_token" &&
              ref.configPath !== "oauth.refresh_token",
          ),
          ...promotedRefs,
        ];
        const nowAt = new Date();
        await db.transaction(async (tx) => {
          await tx.select({ id: connectionGrants.id }).from(connectionGrants)
            .where(and(eq(connectionGrants.companyId, companyId), eq(connectionGrants.connectionId, connection.id),
              or(eq(connectionGrants.id, personalGrant.id), and(eq(connectionGrants.kind, "organization"), eq(connectionGrants.isDefault, true)))))
            .orderBy(connectionGrants.id).for("update");
          await tx.select({ id: toolApplications.id }).from(toolApplications)
            .where(and(eq(toolApplications.id, connection.applicationId), eq(toolApplications.companyId, companyId)))
            .for("update");
          await tx.select({ id: toolConnections.id }).from(toolConnections)
            .where(and(eq(toolConnections.id, connection.id), eq(toolConnections.companyId, companyId)))
            .for("update");
          const [existingOrganizationGrant] = await tx
            .select()
            .from(connectionGrants)
            .where(
              and(
                eq(connectionGrants.companyId, companyId),
                eq(connectionGrants.connectionId, connection.id),
                eq(connectionGrants.kind, "organization"),
                eq(connectionGrants.isDefault, true),
              ),
            )
            .limit(1);
          let organizationGrantId: string;
          if (existingOrganizationGrant) {
            organizationGrantId = existingOrganizationGrant.id;
            await tx
              .update(connectionGrants)
              .set({
                providerTenant: personalGrant.providerTenant,
                credentialSecretRefs: connectionCredentialSecretRefs,
                status: "active",
                revokedAt: null,
                revokedByAgentId: null,
                revokedByUserId: null,
                updatedAt: nowAt,
              })
              .where(eq(connectionGrants.id, existingOrganizationGrant.id));
          } else {
            const [createdOrganizationGrant] = await tx
              .insert(connectionGrants)
              .values({
                companyId,
                connectionId: connection.id,
                kind: "organization",
                subjectUserId: null,
                providerTenant: personalGrant.providerTenant,
                credentialSecretRefs: connectionCredentialSecretRefs,
                status: "active",
                isDefault: true,
                createdByUserId: actorUserId,
              })
              .returning({ id: connectionGrants.id });
            organizationGrantId = createdOrganizationGrant.id;
          }
          // Empty audience rows are the canonical "everyone in the company".
          await tx
            .delete(connectionGrantMembers)
            .where(
              and(
                eq(connectionGrantMembers.companyId, companyId),
                eq(connectionGrantMembers.grantId, organizationGrantId),
              ),
            );
          await tx
            .delete(connectionGrantDelegations)
            .where(
              and(
                eq(connectionGrantDelegations.companyId, companyId),
                eq(connectionGrantDelegations.grantId, personalGrant.id),
              ),
            );
          await tx
            .update(connectionGrants)
            .set({
              credentialSecretRefs: [],
              status: "revoked",
              revokedAt: nowAt,
              revokedByUserId: actorUserId,
              updatedAt: nowAt,
            })
            .where(eq(connectionGrants.id, personalGrant.id));
          [connection] = await tx
            .update(toolConnections)
            .set({
              credentialPolicy: "shared",
              credentialSecretRefs: connectionCredentialSecretRefs,
              credentialRefs: [
                {
                  name: "oauth.access_token",
                  secretId: accessRef.secretId,
                  version: "latest",
                  placement: "header",
                  key: "Authorization",
                  prefix: "Bearer ",
                },
              ],
              status: "active",
              enabled: true,
              updatedAt: nowAt,
            })
            .where(
              and(
                eq(toolConnections.id, connection.id),
                eq(toolConnections.companyId, companyId),
              ),
            )
            .returning();
        });
      } catch (error) {
        await Promise.all(
          promotedRefs.map((ref) =>
            secrets.remove(ref.secretId).catch(() => undefined),
          ),
        );
        throw error;
      }
      await syncCredentialBindings(connection);
      // The source values are no longer referenced by either grant or
      // connection. Removing them makes the promotion a move, not a copy.
      for (const secretId of personalSecretIds) await secrets.remove(secretId);
    }

    // Both identity branches above commit their own lifecycle write (draft ->
    // active) before `finishGalleryAppConnection` re-reads the row, so that
    // step alone would never observe this transition. This is the OAuth
    // access-finalization step of the same gallery setup flow (Apps and inline
    // task cards both reach it), hence `gallery`.
    emitConnectionUpdated(connection, preFinalizeLifecycle, "gallery");
    const catalog = await db
      .select()
      .from(toolCatalogEntries)
      .where(
        and(
          eq(toolCatalogEntries.companyId, companyId),
          eq(toolCatalogEntries.connectionId, connection.id),
          eq(toolCatalogEntries.status, "active"),
        ),
      );
    const sourceTemplateKey =
      typeof connection.config.sourceTemplateKey === "string"
        ? connection.config.sourceTemplateKey
        : null;
    const galleryEntry = sourceTemplateKey
      ? getConnectableAppDefinition(sourceTemplateKey)
      : null;
    const defaults = galleryEntry
      ? recommendedDefaultsForApp(
          galleryEntry,
          connectionMethodForConnection(galleryEntry, connection).key,
        )
      : { askFirstRiskLevels: [] };
    const askFirstRiskLevels = new Set(
      Array.isArray(defaults.askFirstRiskLevels)
        ? defaults.askFirstRiskLevels.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );
    const finished = await finishGalleryAppConnection(
      companyId,
      connection.id,
      {
        enabledCatalogEntryIds: catalog.map((entry) => entry.id),
        askFirstCatalogEntryIds: catalog
          .filter((entry) => askFirstRiskLevels.has(entry.riskLevel))
          .map((entry) => entry.id),
        access: requestingAgentId
          ? { agentIds: [requestingAgentId] }
          : "all_agents",
        preserveExistingAccess: Boolean(requestingAgentId),
      },
      actor,
    );
    await db
      .insert(toolConnectionInstalls)
      .values({
        companyId,
        connectionId: connection.id,
        targetType: requestingAgentId ? "agent" : "company",
        targetId: requestingAgentId ?? companyId,
        createdByUserId: actorUserId,
      })
      .onConflictDoNothing();
    return finished;
  }

  async function preflightGalleryAppMetadata(
    galleryKey: string,
    methodKey?: string | null,
  ): Promise<ToolAppMetadataPreflightResult> {
    const app = getConnectableAppDefinition(galleryKey);
    if (!app || app.availability?.available === false)
      throw notFound("App not found");
    const method = connectionMethodFor(app, methodKey);
    await assertExperimentalConnectorSetupEnabled(app.slug);
    if (method.transport !== "mcp_remote" || !method.defaults?.serverUrl) {
      throw unprocessable(
        "This app method does not use a hosted remote MCP endpoint",
      );
    }

    const serverUrl = await assertRemoteHttpUrlAllowed(
      method.defaults.serverUrl,
    );
    return preflightConnectionMetadata(app, method, method.defaults, serverUrl, () => options.now?.() ?? new Date());
  }

  return {
    /** Identity-only verification: no bot installation/repository access required. */
    verifyPersonalGitHubIdentity: async (companyId: string, connectionId: string, userId: string) => {
      const [connection] = await db.select().from(toolConnections).where(and(eq(toolConnections.companyId, companyId), eq(toolConnections.id, connectionId), eq(toolConnections.enabled, true)));
      if (!connection || (connection.config.sourceTemplateKey !== "github" && connection.transportConfig?.sourceTemplateKey !== "github")) throw notFound("GitHub connection not found");
      const [ownGrant] = await db.select().from(connectionGrants).where(and(eq(connectionGrants.companyId, companyId), eq(connectionGrants.connectionId, connectionId), eq(connectionGrants.kind, "user"), eq(connectionGrants.subjectUserId, userId), eq(connectionGrants.status, "active")));
      if (!ownGrant) throw forbidden("Connect your own GitHub account first. Shared and agent connections cannot prove your identity.");
      const actor = { actorType: "user" as const, actorId: userId };
      const grant = await refreshOAuthGrantCredentials({ companyId, connectionId, grantId: ownGrant.id, actor });
      const accessRef = grant.credentialSecretRefs.find(ref => ref.configPath === "oauth.access_token");
      if (!accessRef) throw unprocessable("Reconnect your personal GitHub connection");
      const { value } = await resolveOAuthGrantSecret(connection, grant, accessRef, actor, undefined);
      const identity = await githubBotRequest<{ id?: number; login?: string; avatar_url?: string }>(fetch, value, "/user");
      if (!Number.isSafeInteger(identity.id) || !identity.id || !identity.login || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(identity.login)) throw unprocessable("GitHub returned an invalid account identity");
      const [current] = await db.select({ id: connectionGrants.id }).from(connectionGrants).where(and(eq(connectionGrants.id, grant.id), eq(connectionGrants.companyId, companyId), eq(connectionGrants.subjectUserId, userId), eq(connectionGrants.status, "active")));
      if (!current) throw forbidden("Your GitHub connection was revoked. Connect it again.");
      return { githubUserId: String(identity.id), login: identity.login, avatarUrl: identity.avatar_url ?? null, connectionId, grantId: grant.id };
    },
    preflightGalleryAppMetadata,
    approvedStdioTemplates: async (
      companyId: string,
    ): Promise<ToolStdioCommandTemplate[]> => {
      const adminTemplates = await db
        .select()
        .from(toolStdioCommandTemplates)
        .where(eq(toolStdioCommandTemplates.companyId, companyId))
        .orderBy(asc(toolStdioCommandTemplates.templateKey));
      return [
        ...Object.keys(APPROVED_STDIO_TEMPLATES)
          .sort()
          .map((templateId) => builtInStdioTemplate(templateId)!),
        ...adminTemplates.map(toStdioCommandTemplate),
      ];
    },

    createStdioCommandTemplate: async (
      companyId: string,
      input: CreateToolStdioCommandTemplate,
      actor?: ActorInfo,
    ): Promise<ToolStdioCommandTemplate> => {
      if (builtInStdioTemplate(input.templateId)) {
        throw conflict(
          "A built-in stdio template already uses this templateId",
        );
      }
      const existing = await getAdminStdioTemplate(companyId, input.templateId);
      if (existing)
        throw conflict("A stdio command template already uses this templateId");
      const tools = input.tools
        .map((tool) => normalizeToolDescriptor(tool))
        .filter((tool): tool is McpToolDescriptor => Boolean(tool));
      const [row] = await db
        .insert(toolStdioCommandTemplates)
        .values({
          companyId,
          templateKey: input.templateId,
          name: input.name,
          description: input.description ?? null,
          status: "active",
          command: input.command,
          args: input.args,
          envKeys: input.envKeys,
          tools,
          createdByAgentId:
            actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
          createdByUserId:
            actor?.actorType === "user" ? (actor.actorId ?? null) : null,
        })
        .returning();
      return toStdioCommandTemplate(row);
    },

    disableStdioCommandTemplate: async (
      companyId: string,
      templateId: string,
    ): Promise<ToolStdioCommandTemplate> => {
      if (builtInStdioTemplate(templateId))
        throw unprocessable("Built-in stdio templates cannot be disabled");
      const existing = await getAdminStdioTemplate(companyId, templateId);
      if (!existing) throw notFound("Stdio command template not found");
      if (existing.status === "disabled")
        return toStdioCommandTemplate(existing);
      const at = now();
      const [row] = await db
        .update(toolStdioCommandTemplates)
        .set({ status: "disabled", disabledAt: at, updatedAt: at })
        .where(
          and(
            eq(toolStdioCommandTemplates.companyId, companyId),
            eq(toolStdioCommandTemplates.templateKey, templateId),
          ),
        )
        .returning();
      return toStdioCommandTemplate(row);
    },

    async setupComposioApp(connectionId: string, toolkit: string, input: ComposioAppSetupInput, actor: ActorInfo): Promise<ComposioAppSetupResult> {
      if (!findComposioCatalogApp(toolkit)) throw notFound("This Composio app is not in the catalog");
      const { connection, manage } = await openComposioGateway(connectionId, actor);
      let result = composioAppSetupResult(await manage([{ name: toolkit, action: "list" }]), toolkit);
      if (input.action === "start" && result.status !== "connected") {
        result = composioAppSetupResult(await manage([{ name: toolkit, action: "add" }]), toolkit);
        if (result.status === "not_connected") throw unprocessable("Composio did not return a sign-in link for this app. Manage it in Composio to check its setup requirements.");
      }
      if (input.action === "complete") {
        if (result.status !== "connected") throw conflict("Finish connecting this app in Composio, then check again");
        const currentConnection = await getConnectionRow(connectionId);
        if (currentConnection.status !== "active" || !currentConnection.enabled) {
          throw conflict("The gateway is no longer active. Restore it before connecting this app.");
        }
      }
      await audit({ companyId: connection.companyId, connectionId, action: "tool_connection.upstream_app_setup", outcome: "success", actor,
        details: { toolkit, action: input.action, status: result.status } });
      return result;
    },

    listAggregatorApps: async (connectionId: string, actor: ActorInfo) => aggregatorAppsResponse(await getConnectionRow(connectionId), actor),
    syncAggregatorApps,
    refreshAggregatorApps: async (connectionId: string, requested: string[], actor: ActorInfo) => {
      const connection = await getConnectionRow(connectionId);
      if (aggregatorProvider(connection) === "composio" && requested.length) {
        const { manage } = await openComposioGateway(connectionId, actor);
        if (requested.some(toolkit => !findComposioCatalogApp(toolkit))) throw notFound("This Composio app is not in the catalog");
        await manage(requested.map(name => ({ name, action: "list" })));
        return aggregatorAppsResponse(connection, actor);
      }
      return syncAggregatorApps(connectionId, true, actor);
    },
    configureArcadeDiscovery,
    syncComposioApps: startComposioAppSync,

    async listComposioApps(connectionId: string, actor: ActorInfo) {
      const connection = await getConnectionRow(connectionId);
      if (actor.actorType !== "user" || !actor.actorId) throw forbidden("Board access required");
      if (connection.config.sourceTemplateKey !== "composio") throw notFound("Composio gateway not found");
      return composioAppsResponse(connection, actor);
    },

    async refreshComposioApps(connectionId: string, requested: string[], actor: ActorInfo) {
      if (requested.some(toolkit => !findComposioCatalogApp(toolkit))) throw notFound("This Composio app is not in the catalog");
      const { connection, manage } = await openComposioGateway(connectionId, actor);
      const existing = await cachedComposioApps(connection, actor);
      // Migrate observations from the original direct setup flow on the first visit.
      const history = await db.select({ details: toolAccessAuditEvents.details }).from(toolAccessAuditEvents).where(and(
        eq(toolAccessAuditEvents.companyId, connection.companyId), eq(toolAccessAuditEvents.connectionId, connectionId),
        eq(toolAccessAuditEvents.actorId, actor.actorId!), eq(toolAccessAuditEvents.action, "tool_connection.upstream_app_setup"),
      )).orderBy(desc(toolAccessAuditEvents.createdAt)).limit(128);
      const known = [...existing.filter(app => app.accounts.length > 0).map(app => app.toolkit),
        ...history.map(row => row.details.toolkit).filter((toolkit): toolkit is string => typeof toolkit === "string" && Boolean(findComposioCatalogApp(toolkit)))];
      const toolkits = [...new Set([...requested, ...known])];
      for (let start = 0; start < toolkits.length; start += 32) {
        await manage(toolkits.slice(start, start + 32).map(name => ({ name, action: "list" })));
      }
      return composioAppsResponse(connection, actor);
    },

    async manageComposioAppAccount(connectionId: string, toolkit: string, input: ComposioAppAccountInput, actor: ActorInfo) {
      if (!findComposioCatalogApp(toolkit)) throw notFound("This Composio app is not in the catalog");
      const { connection, manage } = await openComposioGateway(connectionId, actor);
      if (input.action !== "add") {
        const before = composioAppAccounts(await manage([{ name: toolkit, action: "list" }]), toolkit);
        if (!before?.some(account => account.id === input.accountId)) throw notFound("This account is no longer available in the selected Composio app");
      }
      const details = { toolkit, ...(input.action !== "add" ? { accountId: input.accountId } : {}) };
      await logActivity(db, { companyId: connection.companyId, actorType: "user", actorId: actor.actorId!,
        action: `tool_connection.upstream_account_${input.action}_requested`, entityType: "tool_connection", entityId: connectionId, details });
      let payload: unknown;
      try {
        payload = await manage([{ name: toolkit, action: input.action,
          ...(input.action !== "add" ? { account_id: input.accountId } : {}), ...(input.action === "rename" ? { alias: input.alias } : {}) }]);
      } catch (error) {
        await audit({ companyId: connection.companyId, connectionId, actor, action: `tool_connection.upstream_account_${input.action}`,
          outcome: "failure", reasonCode: "provider_unconfirmed", details });
        throw error;
      }
      const result = composioAppSetupResult(payload, toolkit); // Reject provider errors before reporting success.
      if (input.action === "add" && !result.authorizationUrl) throw unprocessable("Composio did not return a sign-in link. Check the app in Composio.");
      if (input.action !== "add") {
        const after = composioAppAccounts(await manage([{ name: toolkit, action: "list" }]), toolkit);
        if (!after || (input.action === "remove" ? after.some(account => account.id === input.accountId)
          : !after.some(account => account.id === input.accountId && account.alias === input.alias))) {
          throw conflict("Composio has not confirmed this change. Refresh the accounts before trying again.");
        }
      }
      await logActivity(db, { companyId: connection.companyId, actorType: "user", actorId: actor.actorId!,
        action: `tool_connection.upstream_account_${input.action}`, entityType: "tool_connection", entityId: connectionId,
        details: { toolkit, ...(input.action !== "add" ? { accountId: input.accountId } : {}) } });
      return { ...result, apps: await cachedComposioApps(connection, actor) };
    },

    connectGalleryApp,

    finishGalleryAppConnection,

    reconnectGalleryApp,

    storeConnectorOAuthSecret: createOrRotateOAuthSecret,
    resolveConnectorOAuthGrantSecret: resolveOAuthGrantSecret,
    startOAuth,

    startAuthorizationForAgent: async (input: {
      companyId: string;
      connectionId: string;
      agentId: string;
      runId: string;
      subjectUserId: string;
      scopes?: string[];
      returnTo?: string;
      redirectUri: string;
    }) => {
      const runContext = await loadBrokerRunContext(input);
      const connection = await getConnectionRow(
        input.connectionId,
        input.companyId,
      );
      if (
        !runContext.responsibleUserId ||
        runContext.responsibleUserId !== input.subjectUserId
      ) {
        throw new HttpError(
          403,
          "The agent run cannot start authorization for the requested user",
          {
            code: "subject_not_permitted",
            connection: { uid: connection.uid },
            subject: { type: "user", userId: input.subjectUserId },
          },
        );
      }
      return startOAuth(input.companyId, connection.id, {
        redirectUri: input.redirectUri,
        actor: { actorType: "agent", actorId: input.agentId },
        subjectUserId: input.subjectUserId,
        scopes: input.scopes,
        returnTo: input.returnTo,
        issueId: runContext.issueId ?? undefined,
      });
    },

    peekOAuthState,

    completePaperclipCloudConnectorCallback,

    completeVercelConnectCallback,

    completeOAuthCallback,
    refreshOAuthGrantCredentials,
    finalizeOAuthAccess,

    listExamples: async (companyId: string): Promise<ToolExampleSummary[]> => {
      return Promise.all(
        TOOL_EXAMPLES.map(async (definition) => {
          const rows = await exampleRows(companyId, definition);
          return exampleSummary(definition, rows);
        }),
      );
    },

    installExample: async (
      companyId: string,
      exampleId: string,
      actor?: ActorInfo,
    ): Promise<ToolExampleInstallResult> => {
      const definition = findExample(exampleId);
      const blocker = localStdioInstallBlocker();
      if (blocker) throw unprocessable(blocker);
      assertLocalStdioCanBeEnabled("local_stdio", true);
      await stdioTemplateId(companyId, { templateId: definition.templateId });
      const before = await exampleRows(companyId, definition);
      const application = await upsertExampleApplication(
        companyId,
        definition,
        before.application,
      );
      const connection = await upsertExampleConnection(
        companyId,
        definition,
        application.row.id,
        before.connection,
      );
      const refresh = await refreshCatalog(connection.row.id, actor);
      let catalog = refresh.catalog;
      const safeReadEntryIds = catalog
        .filter((entry) => entry.riskLevel === "read")
        .map((entry) => entry.id);
      if (safeReadEntryIds.length > 0) {
        const reviewedAt = new Date();
        await db
          .update(toolCatalogEntries)
          .set({
            status: "active",
            reviewedAt,
            reviewedByAgentId:
              actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
            reviewedByUserId:
              actor?.actorType === "user" ? (actor.actorId ?? null) : null,
            quarantinedAt: null,
            quarantineReason: null,
            updatedAt: reviewedAt,
          })
          .where(
            and(
              eq(toolCatalogEntries.companyId, companyId),
              inArray(toolCatalogEntries.id, safeReadEntryIds),
            ),
          );
        catalog = catalog.map((entry) =>
          safeReadEntryIds.includes(entry.id)
            ? {
                ...entry,
                status: "active",
                reviewedAt,
                quarantinedAt: null,
                quarantineReason: null,
                updatedAt: reviewedAt,
              }
            : entry,
        );
      }
      const profile = await upsertExampleProfile(
        companyId,
        definition,
        before.profile,
      );
      const profileEntries = await syncExampleProfileEntries(
        companyId,
        profile.row.id,
        catalog,
      );
      const profileBinding = await upsertExampleProfileBinding(
        companyId,
        profile.row.id,
        before.profileBinding,
        actor,
      );
      const after = await exampleRows(companyId, definition);
      return {
        example: exampleSummary(definition, after),
        created:
          application.created ||
          connection.created ||
          profile.created ||
          !before.profileBinding,
        application: toApplication(application.row),
        connection: refresh.connection,
        profile: toProfile(profile.row),
        profileEntries,
        profileBinding,
        catalog,
      };
    },

    smokeExample: async (
      companyId: string,
      exampleId: string,
      actor?: ActorInfo,
    ): Promise<ToolExampleSmokeResult> => {
      const definition = findExample(exampleId);
      const rows = await exampleRows(companyId, definition);
      if (!rows.connection || !rows.profile || !rows.profileBinding) {
        throw conflict("Install this tool example before running smoke checks");
      }
      const catalog =
        rows.catalog.length > 0
          ? rows.catalog.map(toCatalogEntry)
          : (await refreshCatalog(rows.connection.id, actor)).catalog;
      const readEntry = catalog.find(
        (entry) => entry.riskLevel === "read" && entry.status === "active",
      );
      const deniedEntry = catalog.find(
        (entry) =>
          entry.riskLevel === "write" || entry.riskLevel === "destructive",
      );
      if (!readEntry || !deniedEntry) {
        throw unprocessable(
          "Example smoke requires at least one read tool and one denied write/destructive tool",
        );
      }
      const smokeActor = await exampleSmokeActor(companyId, actor);
      const connection = toConnection(rows.connection);
      const allowCheck = await runSmokeDecisionCheck({
        companyId,
        actor: smokeActor,
        connection,
        catalogEntry: readEntry,
        expectedDecision: "allow",
        name: "allow_read_tool",
      });
      const denyCheck = await runSmokeDecisionCheck({
        companyId,
        actor: smokeActor,
        connection,
        catalogEntry: deniedEntry,
        expectedDecision: "deny",
        name: "deny_write_tool",
      });
      const auditCheck: ToolExampleSmokeCheck = {
        name: "audit_written",
        ok: Boolean(
          allowCheck.auditEventId &&
          allowCheck.toolCallEventId &&
          denyCheck.auditEventId &&
          denyCheck.toolCallEventId,
        ),
        details: {
          auditEventIds: [allowCheck.auditEventId, denyCheck.auditEventId],
          toolCallEventIds: [
            allowCheck.toolCallEventId,
            denyCheck.toolCallEventId,
          ],
        },
      };
      const checks = [allowCheck, denyCheck, auditCheck];
      return {
        exampleId: definition.id,
        ok: checks.every((check) => check.ok),
        actor: smokeActor,
        connection,
        profile: toProfile(rows.profile),
        checks,
      };
    },

    listApplications: async (companyId: string): Promise<ToolApplication[]> => {
      const rows = await db
        .select()
        .from(toolApplications)
        .where(eq(toolApplications.companyId, companyId))
        .orderBy(desc(toolApplications.updatedAt));
      return rows.map(toApplication);
    },

    createApplication: async (
      companyId: string,
      input: CreateToolApplication,
    ): Promise<ToolApplication> => {
      await assertOptionalPlugin(input.pluginId);
      await assertOptionalAgent(
        companyId,
        input.ownerAgentId,
        "Tool application owner agent",
      );
      const [row] = await db
        .insert(toolApplications)
        .values({
          companyId,
          applicationKey: input.applicationKey ?? normalizeKey(input.name),
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          status: input.status ?? "active",
          pluginId: input.pluginId ?? null,
          ownerAgentId: input.ownerAgentId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          metadata: input.metadata ?? {},
        })
        .returning();
      return toApplication(row);
    },

    getApplication: async (
      applicationId: string,
      companyId?: string,
    ): Promise<ToolApplication> => {
      const where = companyId
        ? and(
            eq(toolApplications.id, applicationId),
            eq(toolApplications.companyId, companyId),
          )
        : eq(toolApplications.id, applicationId);
      const [row] = await db.select().from(toolApplications).where(where);
      if (!row) throw notFound("Tool application not found");
      return toApplication(row);
    },

    updateApplication: async (
      applicationId: string,
      input: UpdateToolApplication,
    ): Promise<ToolApplication> => {
      const [existing] = await db
        .select()
        .from(toolApplications)
        .where(eq(toolApplications.id, applicationId));
      if (!existing) throw notFound("Tool application not found");
      await assertOptionalPlugin(input.pluginId);
      await assertOptionalAgent(
        existing.companyId,
        input.ownerAgentId,
        "Tool application owner agent",
      );
      if (input.name && input.name !== existing.name) {
        const [duplicate] = await db
          .select({ id: toolApplications.id })
          .from(toolApplications)
          .where(
            and(
              eq(toolApplications.companyId, existing.companyId),
              eq(toolApplications.name, input.name),
              ne(toolApplications.id, applicationId),
            ),
          )
          .limit(1);
        if (duplicate) {
          throw conflict("A tool access record with that name already exists", {
            code: "tool_access_name_conflict",
          });
        }
      }
      const [row] = await db
        .update(toolApplications)
        .set({
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
          status: input.status ?? existing.status,
          pluginId: input.pluginId ?? existing.pluginId,
          ownerAgentId: input.ownerAgentId ?? existing.ownerAgentId,
          ownerUserId: input.ownerUserId ?? existing.ownerUserId,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: new Date(),
        })
        .where(eq(toolApplications.id, applicationId))
        .returning();
      return toApplication(row);
    },

    deleteApplication: async (
      applicationId: string,
    ): Promise<ToolApplication> => {
      const [existing] = await db
        .select()
        .from(toolApplications)
        .where(eq(toolApplications.id, applicationId));
      if (!existing) throw notFound("Tool application not found");
      // Guard: never orphan connections. The caller must remove the connections
      // or archive the application instead — there is no force-cascade in v1.
      const linkedConnections = await db
        .select({ id: toolConnections.id })
        .from(toolConnections)
        .where(eq(toolConnections.applicationId, applicationId));
      if (linkedConnections.length > 0) {
        throw conflict(
          "This application still has connections. Remove its connections or archive the application instead of deleting it.",
          { connectionCount: linkedConnections.length },
        );
      }
      // The pre-check above gives a friendly 409 in the common case, but it cannot close the
      // race where a connection is created in the gap before this delete runs. The FK is now
      // ON DELETE RESTRICT, so such a delete fails closed with a foreign_key_violation instead
      // of silently cascading the new connection away. Translate that into the same 409 so the
      // endpoint keeps its contract instead of surfacing a 500.
      let row: typeof toolApplications.$inferSelect | undefined;
      try {
        [row] = await db
          .delete(toolApplications)
          .where(eq(toolApplications.id, applicationId))
          .returning();
      } catch (error) {
        if (isToolConnectionForeignKeyViolation(error)) {
          throw conflict(
            "This application still has connections. Remove its connections or archive the application instead of deleting it.",
          );
        }
        throw error;
      }
      if (!row) throw notFound("Tool application not found");
      return toApplication(row);
    },

    // Repository discovery uses credential audiences, not connection-management
    // visibility. An administrator cannot browse another user's private repos.
    listProjectRepositories: async (companyId: string, userId: string | null, localTrusted = false) =>
      toolAccessService(db).listGitHubRepositories(companyId, userId, localTrusted),

    // Return identifiers, never credentials, so each attempted read can recheck its grant.
    githubReadConnectionIds: async (companyId: string, userId: string | null, localTrusted = false): Promise<string[]> => {
      const connections = await db.select().from(toolConnections).where(and(eq(toolConnections.companyId, companyId), eq(toolConnections.enabled, true))).orderBy(desc(toolConnections.updatedAt));
      const ids: string[] = [];
      for (const connection of connections) {
        if (connection.status !== "active" || asRecord(connection.config).sourceTemplateKey !== "github") continue;
        try {
          await gitHubReadGrantAccess(db, companyId, connection.id, userId, localTrusted);
          ids.push(connection.id);
        } catch (error) {
          // Only ineligible grants are skipped; database/service failures must surface.
          if (!(error instanceof Error && "status" in error && error.status === 403)) throw error;
        }
      }
      return ids;
    },

    githubReadGrantIds: async (companyId: string, connectionId: string, userId: string | null, localTrusted = false): Promise<Array<string | null>> => {
      const { allowed, legacyShared } = await gitHubReadGrantAccess(db, companyId, connectionId, userId, localTrusted);
      return legacyShared ? [null] : allowed.map(grant => grant.id);
    },

    // Server-side reads share the same grant audience and credential lifecycle as discovery.
    githubReadHeaders: async (companyId: string, connectionId: string, userId: string | null, localTrusted = false, forceRefresh = false, grantId?: string | null): Promise<Record<string, string>> => {
      const { connection, allowed, legacyShared } = await gitHubReadGrantAccess(db, companyId, connectionId, userId, localTrusted);
      const actor: ActorInfo = { actorType: "user", actorId: userId ?? "board" };
      if (legacyShared && !grantId) return resolveCredentialHeaders(connection, actor);
      let grant = grantId ? allowed.find(candidate => candidate.id === grantId) : allowed.length === 1 ? allowed[0] : undefined;
      if (!grant) throw forbidden("Choose an active GitHub authorization you can use.");
      if (asRecord(asRecord(connection.config).oauth).connectorProfile === "github.code") {
        grant = await refreshOAuthGrantCredentials({ companyId, connectionId, grantId: grant.id, actor, forceRefresh });
      }
      const ref = grant.credentialSecretRefs.find(ref => ref.configPath === "oauth.access_token" || /authorization|token|api_key/i.test(ref.configPath));
      if (!ref) throw unprocessable("Reconnect GitHub to read repository files.");
      const secret = await resolveOAuthGrantSecret(connection, grant, ref, actor, undefined);
      return { Authorization: `Bearer ${secret.value}` };
    },

    listGitHubRepositories: async (
      companyId: string,
      userId: string | null,
      localTrusted = false,
    ) => measureRunPhase("connectors.github.catalog", async () => {
      const [connections, grants, members, memberships] = await Promise.all([
        measureRunPhase("connectors.github.connections", () => db
          .select()
          .from(toolConnections)
          .where(
            and(
              eq(toolConnections.companyId, companyId),
              eq(toolConnections.enabled, true),
            ),
          )),
        measureRunPhase("connectors.github.grants", () => db
          .select()
          .from(connectionGrants)
          .where(eq(connectionGrants.companyId, companyId))),
        measureRunPhase("connectors.github.grant_members", () => db
          .select()
          .from(connectionGrantMembers)
          .where(eq(connectionGrantMembers.companyId, companyId))),
        userId
          ? measureRunPhase("connectors.github.membership", () => db
              .select()
              .from(companyMemberships)
              .where(
                and(
                  eq(companyMemberships.companyId, companyId),
                  eq(companyMemberships.principalType, "user"),
                  eq(companyMemberships.principalId, userId),
                  eq(companyMemberships.status, "active"),
                ),
              ))
          : Promise.resolve([]),
      ]);
      const repositories = new Map<
        string,
        import("@paperclipai/shared").ProjectRepository
      >();
      const usableConnections: Array<{ id: string; name: string }> = [];
      let connectionCount = 0;
      let failedConnectionCount = 0;
      for (const connection of connections) {
        if (
          connection.status !== "active" ||
          asRecord(connection.config).sourceTemplateKey !== "github"
        )
          continue;
        const connectionGrants = grants.filter(
          (grant) => grant.connectionId === connection.id,
        );
        const availableGrants = connectionGrants.filter(
          (grant) =>
            !(
              grant.kind === "organization" &&
              ["per_user", "per_agent"].includes(connection.credentialPolicy)
            ) &&
            canBrowseProjectRepositoryGrant({
              grant,
              userId,
              activeMember: localTrusted || memberships.length > 0,
              audience: members
                .filter((member) => member.grantId === grant.id)
                .map((member) => member.subjectId),
            }),
        );
        // Legacy shared PAT connections predate grants. Never fall back when a
        // grant exists but is revoked, private, or outside the caller's audience.
        const legacyShared =
          connectionGrants.length === 0 &&
          connection.credentialPolicy === "shared" &&
          (localTrusted || (!!userId && memberships.length > 0));
        if (!availableGrants.length && !legacyShared) continue;
        connectionCount += 1;
        usableConnections.push({ id: connection.id, name: connection.name });
        const actor: ActorInfo = {
          actorType: "user",
          actorId: userId ?? "board",
        };
        let failed = false;
        for (const initialGrant of legacyShared ? [null] : availableGrants) {
          try {
            let rows: Array<{
              id: string;
              fullName: string;
              private?: boolean;
            }>;
            if (
              initialGrant &&
              asRecord(asRecord(connection.config).oauth).connectorProfile ===
                "github.code"
            ) {
              const grant = await refreshManagedGitHubGrantAccess(
                connection,
                initialGrant,
                actor,
              );
              rows = grant.providerTenant?.github?.repositories ?? [];
            } else {
              const headers = await measureRunPhase("connectors.github.credentials", () => initialGrant
                ? (async () => {
                    const ref = initialGrant.credentialSecretRefs.find(
                      (ref) =>
                        ref.configPath === "oauth.access_token" ||
                        /authorization|token|api_key/i.test(ref.configPath),
                    );
                    if (!ref)
                      throw unprocessable(
                        "Reconnect GitHub to load repositories",
                      );
                    const secret = await resolveOAuthGrantSecret(
                      connection,
                      initialGrant,
                      ref,
                      actor,
                      undefined,
                    );
                    return { Authorization: `Bearer ${secret.value}` };
                  })()
                : resolveCredentialHeaders(connection, actor));
              rows = await measureRunPhase("connectors.github.repositories", () => loadGitHubTokenRepositories(headers));
            }
            for (const row of rows) {
              mergeProjectRepository(repositories, row, connection.name, connection.id);
            }
          } catch {
            // Credential/provider errors may contain secrets. Only expose an
            // aggregate failure; successful connections remain usable.
            failed = true;
          }
        }
        if (failed) failedConnectionCount += 1;
      }
      return {
        repositories: [...repositories.values()].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        ),
        connections: usableConnections,
        connectionCount,
        failedConnectionCount,
      };
    }),

    listConnections: async (
      companyId: string,
      viewerUserId?: string,
    ): Promise<ToolConnection[]> => {
      const rows = await db
        .select()
        .from(toolConnections)
        .where(eq(toolConnections.companyId, companyId))
        .orderBy(desc(toolConnections.updatedAt));
      const connections = rows.map(toConnection);
      if (connections.length === 0) return connections;
      const installRows = await db
        .select()
        .from(toolConnectionInstalls)
        .where(eq(toolConnectionInstalls.companyId, companyId))
        .orderBy(
          asc(toolConnectionInstalls.targetType),
          asc(toolConnectionInstalls.targetId),
        );
      const installsByConnection = new Map<string, ToolConnectionInstall[]>();
      for (const row of installRows) {
        const installs = installsByConnection.get(row.connectionId) ?? [];
        installs.push(toConnectionInstall(row));
        installsByConnection.set(row.connectionId, installs);
      }
      for (const connection of connections)
        connection.installs = installsByConnection.get(connection.id) ?? [];
      // Enrich with "last used" = most recent tool-call event per connection so the
      // prosumer Apps list can surface a staleness signal without an N+1 fan-out.
      const lastUsedRows = await db
        .select({
          connectionId: toolCallEvents.connectionId,
          lastUsedAt: max(toolCallEvents.createdAt),
        })
        .from(toolCallEvents)
        .where(
          and(
            eq(toolCallEvents.companyId, companyId),
            inArray(
              toolCallEvents.connectionId,
              connections.map((connection) => connection.id),
            ),
          ),
        )
        .groupBy(toolCallEvents.connectionId);
      const lastUsedByConnection = new Map(
        lastUsedRows.map((row) => [row.connectionId, row.lastUsedAt]),
      );
      for (const connection of connections) {
        connection.lastUsedAt = lastUsedByConnection.get(connection.id) ?? null;
      }
      await annotateAiGrantHealth(connections);
      await annotateGitHubAuthorization(connections, viewerUserId);
      await annotateSavedOAuthClientSecret(connections, viewerUserId);
      return connections;
    },

    createConnection: async (
      companyId: string,
      input: CreateToolConnection,
      actor?: ActorInfo,
    ): Promise<ToolConnection> => {
      let applicationId = input.applicationId;
      let applicationNamespace = input.applicationName ?? input.name;
      const transport = input.transport;
      if (!transport) throw badRequest("Tool connection transport is required");
      const config = normalizeGoogleSheetsConnectionConfig(
        input.config ?? input.transportConfig ?? {},
      );
      await assertConnectorConnectionSetupEnabled({ config, applicationId, companyId });
      // Validate company-scoped references before touching a caller-supplied
      // network endpoint. Besides failing fast, this keeps cross-company
      // authorization errors from being masked by DNS or SSRF validation.
      await assertSecretRefs(companyId, [
        ...(input.credentialRefs ?? []),
        ...(input.credentialSecretRefs ?? []),
      ]);
      if (transport === "mcp_remote")
        await assertRemoteConnectionEndpointsAllowed(config);
      if (transport === "local_stdio") await stdioTemplateId(companyId, config);
      assertLocalStdioCanBeEnabled(transport, input.enabled ?? false, config);
      await assertGoogleSheetsSpreadsheetOwnership(companyId, config);
      if (applicationId) {
        const app = await assertApplication(companyId, applicationId);
        applicationNamespace = app.applicationKey ?? app.name;
        await assertConnectorConnectionSetupEnabled({ config }, applicationNamespace);
        if (
          (transport === "mcp_remote" && app.type !== "mcp_http") ||
          (transport === "local_stdio" && app.type !== "mcp_stdio")
        ) {
          throw unprocessable(
            "Connection transport must match application type",
          );
        }
      } else {
        const [app] = await db
          .insert(toolApplications)
          .values({
            companyId,
            applicationKey: normalizeKey(input.applicationName ?? input.name),
            name: input.applicationName ?? input.name,
            type: isBrowserUseConnection({ transport, config }) || isDaytonaConnection({ transport, config }) ? "rest_api" : transport === "mcp_remote" ? "mcp_http" : "mcp_stdio",
            status: "active",
            metadata: {},
          })
          .returning();
        applicationId = app.id;
      }
      const connectionId = randomUUID();
      const binding = actorBinding(actor);
      const [row] = await db
        .insert(toolConnections)
        .values({
          id: connectionId,
          companyId,
          applicationId,
          name: input.name,
          uid: connectionUid(applicationNamespace, input.name, connectionId),
          connectionKind: input.connectionKind ?? "managed",
          ownership: input.ownership ?? "customer",
          transport,
          authKind: input.authKind ?? "none",
          credentialPolicy:
            input.credentialPolicy ??
            (input.authKind === "oauth" ? "per_user" : "shared"),
          status: input.status ?? "draft",
          enabled: input.enabled ?? false,
          agentInstructions: input.agentInstructions !== undefined ? input.agentInstructions : defaultConnectionAgentInstructions(
            typeof config.sourceTemplateKey === "string" ? getConnectableAppDefinition(config.sourceTemplateKey)?.agentInstructions : null,
          ),
          config,
          transportConfig: isGoogleSheetsConnectionConfig(config)
            ? config
            : (input.transportConfig ?? config),
          credentialRefs: input.credentialRefs ?? [],
          credentialSecretRefs: input.credentialSecretRefs ?? [],
          createdByAgentId:
            binding.actorType === "agent" ? binding.actorId : null,
          createdByUserId:
            binding.actorType === "user" ? binding.actorId : null,
        })
        .returning();
      await ensureDefaultOrganizationGrant(row);
      await syncCredentialBindings(row);
      await ensureRuntimeSlot(row);
      emitConnectionCreated(row, "api");
      return toConnection(row);
    },

    getConnection: async (
      connectionId: string,
      companyId?: string,
      viewerUserId?: string,
    ): Promise<ToolConnection> => {
      const connection = toConnection(
        await getConnectionRow(connectionId, companyId),
      );
      connection.installs = await listConnectionInstalls(
        connection.id,
        connection.companyId,
      );
      await annotateAiGrantHealth([connection]);
      await annotateGitHubAuthorization([connection], viewerUserId);
      await annotateSavedOAuthClientSecret([connection], viewerUserId);
      return connection;
    },

    listConnectionGrants: async (idOrUid: string, companyId?: string) => {
      const connection = await getConnectionRow(idOrUid, companyId);
      const grants = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
          ),
        )
        .orderBy(
          desc(connectionGrants.isDefault),
          desc(connectionGrants.updatedAt),
        );
      const grantIds = grants.map((grant) => grant.id);
      const [members, delegations] =
        grantIds.length === 0
          ? [[], []]
          : await Promise.all([
              db
                .select()
                .from(connectionGrantMembers)
                .where(
                  and(
                    eq(connectionGrantMembers.companyId, connection.companyId),
                    inArray(connectionGrantMembers.grantId, grantIds),
                  ),
                ),
              db
                .select()
                .from(connectionGrantDelegations)
                .where(
                  and(
                    eq(
                      connectionGrantDelegations.companyId,
                      connection.companyId,
                    ),
                    inArray(connectionGrantDelegations.grantId, grantIds),
                  ),
                ),
            ]);
      return {
        connection: { id: connection.id, uid: connection.uid },
        grants: grants.map((grant) => ({
          ...toConnectionGrant(grant),
          members: members.filter((member) => member.grantId === grant.id),
          delegations: delegations.filter(
            (delegation) => delegation.grantId === grant.id,
          ),
        })),
      };
    },

    /**
     * Company members eligible to appear in an organization grant's audience.
     * The audience editor needs display names, and the client must not have to
     * cross-reference a second endpoint to render "12 selected members".
     */
    listConnectionAudienceMembers: async (companyId: string) => {
      const rows = await db
        .select({
          userId: companyMemberships.principalId,
          name: authUsers.name,
          email: authUsers.email,
        })
        .from(companyMemberships)
        .leftJoin(authUsers, eq(authUsers.id, companyMemberships.principalId))
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.status, "active"),
          ),
        );
      return rows
        .map((row) => ({
          userId: row.userId,
          name: row.name ?? null,
          email: row.email ?? null,
        }))
        .sort((a, b) =>
          (a.name ?? a.email ?? a.userId).localeCompare(
            b.name ?? b.email ?? b.userId,
          ),
        );
    },

    /**
     * Replace an organization grant's audience atomically (PAP-17835).
     *
     * An empty `memberUserIds` persists as zero rows, which the resolver already
     * treats as "every organization member". Replacement is delete-then-insert
     * inside one transaction so a partially-applied audience can never widen or
     * narrow access, and every member id is checked against active company
     * membership first so an audience cannot name an outsider. Existing audience
     * members are locked too: membership cleanup deliberately retains a sole
     * inactive audience row, and a concurrent empty replacement must not erase
     * that fail-closed marker after cleanup wins. Once cleanup has retained that
     * marker, callers must restore the member or replace it with an active named
     * audience before widening access to the whole company.
     */
    replaceConnectionGrantMembers: async (
      idOrUid: string,
      grantId: string,
      memberUserIds: string[],
      actor?: ActorInfo,
    ) => {
      const connection = await getConnectionRow(idOrUid);
      const [grant] = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.id, grantId),
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
          ),
        )
        .limit(1);
      if (!grant) throw notFound("Connection grant not found");
      if (grant.kind !== "organization") {
        throw badRequest(
          "Only an organization identity has an audience; a personal identity belongs to its owner",
        );
      }
      const requested = [
        ...new Set(memberUserIds.map((id) => id.trim()).filter(Boolean)),
      ];
      const binding = actorBinding(actor);
      const members = await db.transaction(async (tx) => {
        // Serialize replacements before taking the current audience snapshot.
        // Otherwise a second replacement could read the old rows, wait behind
        // an in-flight replacement, and then miss locking a newly-added member.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"paperclip.connection_grant_audience:" + grant.id}, 0))`);
        const existingAudience = await tx
          .select()
          .from(connectionGrantMembers)
          .where(
            and(
              eq(connectionGrantMembers.companyId, connection.companyId),
              eq(connectionGrantMembers.grantId, grant.id),
              eq(connectionGrantMembers.subjectType, "user"),
            ),
          );
        const existingUserIds = [
          ...new Set(existingAudience.map((row) => row.subjectId)),
        ];
        const membershipUserIds = [
          ...new Set([...existingUserIds, ...requested]),
        ];
        if (membershipUserIds.length > 0) {
          // Membership suspension/archive/removal takes the same row lock before
          // sweeping grant audiences. Lock both the old and new audience so an
          // empty replacement also serializes with cleanup of its existing sole
          // member. Whichever transaction wins is then authoritative.
          const memberships = await tx
            .select({
              principalId: companyMemberships.principalId,
              status: companyMemberships.status,
            })
            .from(companyMemberships)
            .where(
              and(
                eq(companyMemberships.companyId, connection.companyId),
                eq(companyMemberships.principalType, "user"),
                inArray(companyMemberships.principalId, membershipUserIds),
              ),
            )
            .orderBy(asc(companyMemberships.id))
            .for("update");
          const active = new Set(
            memberships
              .filter((row) => row.status === "active")
              .map((row) => row.principalId),
          );
          const unknown = requested.filter((id) => !active.has(id));
          if (unknown.length > 0) {
            throw unprocessable(
              "Every audience member must be an active member of this company",
              {
                code: "audience_member_not_in_company",
                unknownUserIds: unknown,
              },
            );
          }
          const inactiveExisting = existingUserIds.filter(
            (id) => !active.has(id),
          );
          if (requested.length === 0 && inactiveExisting.length > 0) {
            throw conflict(
              "Replace inactive audience members before widening access to the whole company",
              {
                code: "audience_widening_blocked",
                inactiveUserIds: inactiveExisting,
              },
            );
          }
        }
        await tx
          .select({ id: connectionGrants.id })
          .from(connectionGrants)
          .where(
            and(
              eq(connectionGrants.id, grant.id),
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
            ),
          )
          .for("update");
        const existingUserSet = new Set(existingUserIds);
        if (requested.length === existingUserSet.size && requested.every(id => existingUserSet.has(id))) return existingAudience;
        await tx
          .delete(connectionGrantMembers)
          .where(
            and(
              eq(connectionGrantMembers.companyId, connection.companyId),
              eq(connectionGrantMembers.grantId, grant.id),
            ),
          );
        const inserted =
          requested.length === 0
            ? []
            : await tx
                .insert(connectionGrantMembers)
                .values(
                  requested.map((subjectId) => ({
                    companyId: connection.companyId,
                    grantId: grant.id,
                    subjectType: "user" as const,
                    subjectId,
                  })),
                )
                .returning();
        await tx
          .update(connectionGrants)
          .set({ updatedAt: new Date() })
          .where(eq(connectionGrants.id, grant.id));
        return inserted;
      });
      await db.insert(toolAccessAuditEvents).values({
        companyId: connection.companyId,
        connectionId: connection.id,
        actorType: binding.actorType ?? "system",
        actorId: binding.actorId,
        action: "connection_grant.audience_replaced",
        outcome: "success",
        reasonCode: "audience_replaced",
        details: {
          grantId: grant.id,
          memberCount: members.length,
          memberUserIds: requested,
        },
      });
      return { ...toConnectionGrant(grant), members };
    },

    createConnectionGrantDelegation: async (
      idOrUid: string,
      grantId: string,
      agentId: string,
      ownerUserId: string,
    ) => {
      const connection = await getConnectionRow(idOrUid);
      if (connection.connectionPurpose === "ai") {
        throw badRequest("AI credentials use the connection's human access settings, not agent delegation");
      }
      return db.transaction(async (tx) => {
        // Membership removal/suspension takes this same row lock before sweeping
        // personal grants. Whichever operation wins is therefore authoritative:
        // removal deletes a delegation committed first, while creation that runs
        // second observes the inactive membership and fails closed.
        const [membership] = await tx
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, connection.companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, ownerUserId),
              eq(companyMemberships.status, "active"),
            ),
          )
          .for("update")
          .limit(1);
        if (!membership) {
          throw forbidden(
            "Only an active company member can delegate their personal grant",
          );
        }

        const [grant] = await tx
          .select()
          .from(connectionGrants)
          .where(
            and(
              eq(connectionGrants.id, grantId),
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
              eq(connectionGrants.kind, "user"),
              eq(connectionGrants.subjectUserId, ownerUserId),
              eq(connectionGrants.status, "active"),
            ),
          )
          .for("update")
          .limit(1);
        if (!grant)
          throw forbidden(
            "Only the active personal grant owner can create a delegation",
          );
        await tx.select({ id: toolConnections.id }).from(toolConnections)
          .where(eq(toolConnections.id, connection.id)).for("key share");
        const [targetAgent] = await tx
          .select({ id: agents.id })
          .from(agents)
          .where(
            and(
              eq(agents.id, agentId),
              eq(agents.companyId, connection.companyId),
            ),
          )
          .for("no key update")
          .limit(1);
        if (!targetAgent) throw notFound("Agent not found");
        const [existing] = await tx
          .select()
          .from(connectionGrantDelegations)
          .where(
            and(
              eq(connectionGrantDelegations.grantId, grant.id),
              eq(connectionGrantDelegations.agentId, agentId),
            ),
          )
          .limit(1);
        if (existing) return existing;
        const [delegation] = await tx
          .insert(connectionGrantDelegations)
          .values({
            companyId: connection.companyId,
            grantId: grant.id,
            agentId,
            createdByUserId: ownerUserId,
          })
          .returning();
        await tx.insert(toolAccessAuditEvents).values({
          companyId: connection.companyId,
          connectionId: connection.id,
          actorType: "user",
          actorId: ownerUserId,
          action: "connection_grant.delegated",
          outcome: "success",
          reasonCode: "delegation_created",
          details: { grantId: grant.id, delegationId: delegation!.id, agentId },
        });
        return delegation!;
      });
    },

    revokeConnectionGrantDelegation: async (
      idOrUid: string,
      grantId: string,
      delegationId: string,
      actor?: ActorInfo,
    ) => {
      const connection = await getConnectionRow(idOrUid);
      const delegation = await db.transaction(async tx => {
        const [grant] = await tx.select({ id: connectionGrants.id }).from(connectionGrants)
          .where(and(eq(connectionGrants.id, grantId), eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.connectionId, connection.id)))
          .for("update");
        if (!grant) return undefined;
        const [target] = await tx.select({ agentId: connectionGrantDelegations.agentId }).from(connectionGrantDelegations)
          .where(and(eq(connectionGrantDelegations.id, delegationId), eq(connectionGrantDelegations.companyId, connection.companyId), eq(connectionGrantDelegations.grantId, grantId)));
        if (!target) return undefined;
        await tx.select({ id: agents.id }).from(agents)
          .where(and(eq(agents.companyId, connection.companyId), eq(agents.id, target.agentId))).for("no key update");
        const [removed] = await tx
          .delete(connectionGrantDelegations)
          .where(
            and(
              eq(connectionGrantDelegations.id, delegationId),
              eq(connectionGrantDelegations.companyId, connection.companyId),
              eq(connectionGrantDelegations.grantId, grantId),
            ),
          )
          .returning();
        return removed;
      });
      if (!delegation) throw notFound("Connection grant delegation not found");
      const binding = actorBinding(actor);
      await db.insert(toolAccessAuditEvents).values({
        companyId: connection.companyId,
        connectionId: connection.id,
        actorType: binding.actorType ?? "system",
        actorId: binding.actorId,
        action: "connection_grant.delegation_revoked",
        outcome: "success",
        reasonCode: "delegation_revoked",
        details: { grantId, delegationId, agentId: delegation.agentId },
      });
      return delegation;
    },

    addConnectionInstallation: async (
      idOrUid: string,
      input: {
        providerTenant?: { name?: string; externalId?: string };
        credentialSecretRefs?: typeof connectionGrants.$inferInsert.credentialSecretRefs;
        isDefault?: boolean;
      },
      actor?: ActorInfo,
    ) => {
      const connection = await getConnectionRow(idOrUid);
      await assertSecretRefs(
        connection.companyId,
        input.credentialSecretRefs ?? [],
      );
      if (input.isDefault) {
        await db
          .update(connectionGrants)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(connectionGrants.connectionId, connection.id),
              eq(connectionGrants.kind, "organization"),
            ),
          );
      }
      const binding = actorBinding(actor);
      const [grant] = await db
        .insert(connectionGrants)
        .values({
          companyId: connection.companyId,
          connectionId: connection.id,
          kind: "organization",
          providerTenant: input.providerTenant,
          credentialSecretRefs: input.credentialSecretRefs ?? [],
          status: "active",
          isDefault: input.isDefault ?? false,
          createdByAgentId:
            binding.actorType === "agent" ? binding.actorId : null,
          createdByUserId:
            binding.actorType === "user" ? binding.actorId : null,
        })
        .returning();
      if (!grant) throw new Error("Failed to create connection installation");
      await db.insert(toolAccessAuditEvents).values({
        companyId: connection.companyId,
        connectionId: connection.id,
        actorType: binding.actorType ?? "system",
        actorId: binding.actorId,
        action: "connection_grant.created",
        outcome: "success",
        reasonCode: "grant_created",
        details: {
          grantId: grant.id,
          kind: grant.kind,
          isDefault: grant.isDefault,
        },
      });
      return toConnectionGrant(grant);
    },

    revokeConnectionGrant: async (
      idOrUid: string,
      grantId: string,
      actor?: ActorInfo,
    ) => {
      const connection = await getConnectionRow(idOrUid);
      const binding = actorBinding(actor);
      const [currentGrant] = await db
        .select()
        .from(connectionGrants)
        .where(
          and(
            eq(connectionGrants.id, grantId),
            eq(connectionGrants.companyId, connection.companyId),
            eq(connectionGrants.connectionId, connection.id),
          ),
        )
        .limit(1);
      if (!currentGrant) throw notFound("Connection grant not found");
      let providerRevocation = "not_applicable";
      if (
        connection.credentialSource === "vercel_connect" &&
        connection.externalCredential
      ) {
        const request = vercelTokenRequest({
          credential: connection.externalCredential,
          grant: currentGrant,
          connectionId: connection.id,
          companyId: connection.companyId,
          resources: vercelConnectResourcesFor(connection),
        });
        vercelConnect?.evict(request);
        if (currentGrant.externalCredential?.subjectType === "app") {
          providerRevocation = "manage_in_vercel";
        } else if (currentGrant.externalCredential?.subjectType === "user") {
          try {
            if (!vercelConnect) throw new Error("Vercel Connect unavailable");
            await vercelConnect.revoke(request);
            providerRevocation = "success";
          } catch {
            providerRevocation = "failed";
          }
        }
      } else if (
        isPaperclipCloudConnectorStrategy(oauthConfig(connection).strategy)
      ) {
        // Google revocation is client-wide for a user. The managed Workspace
        // profiles intentionally share one Paperclip-owned client, so revoking
        // one token here could invalidate unrelated Gmail, Drive, and Calendar
        // grants. A per-profile removal is therefore local-only. A future
        // provider-level disconnect must warn that it removes every profile.
        providerRevocation = "local_only_shared_client";
      }
      const grant = await db.transaction(async (tx) => {
        const [lockedGrant] = await tx.select({ id: connectionGrants.id }).from(connectionGrants)
          .where(and(eq(connectionGrants.id, grantId), eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.connectionId, connection.id)))
          .for("update");
        if (!lockedGrant) throw notFound("Connection grant not found");
        await tx.select({ id: agents.id }).from(agents)
          .where(and(eq(agents.companyId, connection.companyId), notInArray(agents.status, ["pending_approval", "terminated"])))
          .orderBy(agents.id).for("no key update");
        const removedDelegations = await tx
          .delete(connectionGrantDelegations)
          .where(
            and(
              eq(connectionGrantDelegations.companyId, connection.companyId),
              eq(connectionGrantDelegations.grantId, grantId),
            ),
          )
          .returning();
        const [updated] = await tx
          .update(connectionGrants)
          .set({
            status: "revoked",
            isDefault: false,
            revokedAt: new Date(),
            revokedByAgentId:
              binding.actorType === "agent" ? binding.actorId : null,
            revokedByUserId:
              binding.actorType === "user" ? binding.actorId : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(connectionGrants.id, grantId),
              eq(connectionGrants.companyId, connection.companyId),
              eq(connectionGrants.connectionId, connection.id),
            ),
          )
          .returning();
        if (!updated) throw notFound("Connection grant not found");
        if (removedDelegations.length > 0) {
          await tx.insert(toolAccessAuditEvents).values(
            removedDelegations.map((delegation) => ({
              companyId: connection.companyId,
              connectionId: connection.id,
              actorType: binding.actorType ?? "system",
              actorId: binding.actorId,
              action: "connection_grant.delegation_revoked",
              outcome: "success",
              reasonCode: "grant_revoked",
              details: {
                grantId,
                delegationId: delegation.id,
                agentId: delegation.agentId,
              },
            })),
          );
        }
        return updated;
      });
      if (!grant) throw notFound("Connection grant not found");
      await db.insert(toolAccessAuditEvents).values({
        companyId: connection.companyId,
        connectionId: connection.id,
        actorType: binding.actorType ?? "system",
        actorId: binding.actorId,
        action: "connection_grant.revoked",
        outcome: "success",
        reasonCode: "grant_revoked",
        details: { grantId: grant.id, kind: grant.kind, providerRevocation },
      });
      return toConnectionGrant(grant);
    },

    getConnectionUsage: async (
      idOrUid: string,
      range: "7d" | "30d",
      companyId?: string,
    ) => {
      const connection = await getConnectionRow(idOrUid, companyId);
      const days = range === "30d" ? 30 : 7;
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - days + 1);
      const [issuances, invocations] = await Promise.all([
        db
          .select({
            createdAt: connectionTokenIssuances.createdAt,
            outcome: connectionTokenIssuances.outcome,
            path: connectionTokenIssuances.path,
          })
          .from(connectionTokenIssuances)
          .where(
            and(
              eq(connectionTokenIssuances.companyId, connection.companyId),
              eq(connectionTokenIssuances.connectionId, connection.id),
              gte(connectionTokenIssuances.createdAt, start),
            ),
          ),
        db
          .select({
            createdAt: toolInvocations.createdAt,
            riskLevel: toolInvocations.riskLevel,
          })
          .from(toolInvocations)
          .where(
            and(
              eq(toolInvocations.companyId, connection.companyId),
              eq(toolInvocations.connectionId, connection.id),
              gte(toolInvocations.createdAt, start),
            ),
          ),
      ]);
      const buckets = Array.from({ length: days }, (_, offset) => {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + offset);
        return {
          date: date.toISOString().slice(0, 10),
          issuances: {
            total: 0,
            byOutcome: {} as Record<string, number>,
            byPath: {} as Record<string, number>,
          },
          invocations: { total: 0, byRiskLevel: {} as Record<string, number> },
          deliveries: { received: 0, forwarded: 0 },
        };
      });
      const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
      for (const row of issuances) {
        const bucket = byDate.get(row.createdAt.toISOString().slice(0, 10));
        if (!bucket) continue;
        bucket.issuances.total += 1;
        bucket.issuances.byOutcome[row.outcome] =
          (bucket.issuances.byOutcome[row.outcome] ?? 0) + 1;
        bucket.issuances.byPath[row.path] =
          (bucket.issuances.byPath[row.path] ?? 0) + 1;
      }
      for (const row of invocations) {
        const bucket = byDate.get(row.createdAt.toISOString().slice(0, 10));
        if (!bucket) continue;
        const riskLevel = row.riskLevel ?? "unknown";
        bucket.invocations.total += 1;
        bucket.invocations.byRiskLevel[riskLevel] =
          (bucket.invocations.byRiskLevel[riskLevel] ?? 0) + 1;
      }
      return {
        connection: { id: connection.id, uid: connection.uid },
        range,
        buckets,
      };
    },

    listConnectionInstalls,

    putConnectionInstalls: async (
      connectionId: string,
      input: PutToolConnectionInstalls,
      actor?: ActorInfo,
    ): Promise<ToolConnectionInstallSnapshot> => {
      const connection = await getConnectionRow(connectionId);
      const requested = new Map(
        input.installs.map((install) => [
          `${install.targetType}:${install.targetId}`,
          install,
        ]),
      );
      for (const install of requested.values()) {
        if (install.targetType === "company") {
          if (install.targetId !== connection.companyId)
            throw unprocessable(
              "Company installs must target the connection company",
            );
        } else {
          await assertOptionalAgent(
            connection.companyId,
            install.targetId,
            "Tool connection install agent",
          );
        }
      }
      const markMcpAccessConfigured = connection.transport === "mcp_remote"
        && connection.config.mcpAgentAccessConfigured !== true;
      const accessExtensions: Array<{
        targetType: "company" | "agent";
        targetId: string;
        profileId: string;
      }> = [];
      await db.transaction(async (tx) => {
        await lockToolConnectionRuntimeInputs(tx, connection.companyId, connection.id);
        if (markMcpAccessConfigured) {
          // Preserve an explicit zero-agent selection through OAuth. Merge the
          // marker in SQL so concurrent credential/config changes are retained.
          await tx.update(toolConnections).set({
            config: sql`${toolConnections.config} || '{"mcpAgentAccessConfigured":true}'::jsonb`,
            transportConfig: sql`${toolConnections.transportConfig} || '{"mcpAgentAccessConfigured":true}'::jsonb`,
            updatedAt: now(),
          }).where(and(
            eq(toolConnections.companyId, connection.companyId),
            eq(toolConnections.id, connection.id),
          ));
        }
        const existing = await tx
          .select()
          .from(toolConnectionInstalls)
          .where(
            and(
              eq(toolConnectionInstalls.companyId, connection.companyId),
              eq(toolConnectionInstalls.connectionId, connection.id),
            ),
          );
        const existingKeys = new Set(
          existing.map(
            (install) => `${install.targetType}:${install.targetId}`,
          ),
        );
        const bindings = await tx.select({ targetType: toolProfileBindings.targetType, targetId: toolProfileBindings.targetId })
          .from(toolProfileBindings).innerJoin(toolProfiles, eq(toolProfiles.id, toolProfileBindings.profileId))
          .where(and(eq(toolProfileBindings.companyId, connection.companyId), eq(toolProfiles.companyId, connection.companyId), eq(toolProfiles.profileKey, `app:${connection.id}`)));
        await lockToolAssignmentAgents(tx, connection.companyId, [...existing, ...requested.values(), ...bindings]);
        const removals = existing.filter(
          (install) =>
            !requested.has(`${install.targetType}:${install.targetId}`),
        );
        const removeIds = removals.map((install) => install.id);
        if (removeIds.length > 0) {
          await tx
            .delete(toolConnectionInstalls)
            .where(inArray(toolConnectionInstalls.id, removeIds));
          // Uninstalling must also drop the binding this path created. Installing
          // writes both an install row and a profile binding, so deleting only the
          // install row leaves a binding that no surface can see or remove. The
          // install row is the reach gate (`mintConnectionTokenForAgent` fails with
          // `installation_required`, and the heartbeat only hands over installed
          // connections), so a stale binding grants no reach on its own — but it
          // still makes `finishApp`, which rebuilds `access` from the bindings,
          // read a target the operator already removed.
          //
          // Only bindings tagged `source: "tool_connection_install"` are removed.
          // A binding the operator authored through the access model carries a
          // different source and must survive an uninstall.
          const [installProfile] = await tx
            .select({ id: toolProfiles.id })
            .from(toolProfiles)
            .where(
              and(
                eq(toolProfiles.companyId, connection.companyId),
                eq(toolProfiles.profileKey, `app:${connection.id}`),
              ),
            )
            .limit(1);
          if (installProfile) {
            for (const install of removals) {
              await tx
                .delete(toolProfileBindings)
                .where(
                  and(
                    eq(toolProfileBindings.companyId, connection.companyId),
                    eq(toolProfileBindings.profileId, installProfile.id),
                    eq(toolProfileBindings.targetType, install.targetType),
                    eq(toolProfileBindings.targetId, install.targetId),
                    sql`${toolProfileBindings.metadata}->>'source' = 'tool_connection_install'`,
                  ),
                );
            }
          }
        }
        const additions = [...requested.entries()]
          .filter(([key]) => !existingKeys.has(key))
          .map(([, install]) => install);
        if (additions.length > 0) {
          await tx.insert(toolConnectionInstalls).values(
            additions.map((install) => ({
              companyId: connection.companyId,
              connectionId: connection.id,
              targetType: install.targetType,
              targetId: install.targetId,
              createdByAgentId:
                actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
              createdByUserId:
                actor?.actorType === "user" ? (actor.actorId ?? null) : null,
            })),
          );
        }
        if (requested.size > 0 && connection.connectionPurpose !== "ai") {
          const profile = await appProfileForConnection(tx, connection);
          for (const install of requested.values()) {
            const [binding] = await tx
              .insert(toolProfileBindings)
              .values({
                companyId: connection.companyId,
                profileId: profile.id,
                targetType: install.targetType,
                targetId: install.targetId,
                priority: 100,
                metadata: {
                  source: "tool_connection_install",
                  connectionId: connection.id,
                },
                createdByAgentId:
                  actor?.actorType === "agent" ? (actor.actorId ?? null) : null,
                createdByUserId:
                  actor?.actorType === "user" ? (actor.actorId ?? null) : null,
              })
              .onConflictDoNothing()
              .returning({ id: toolProfileBindings.id });
            if (binding)
              accessExtensions.push({
                targetType: install.targetType,
                targetId: install.targetId,
                profileId: profile.id,
              });
          }
        }
        if (markMcpAccessConfigured || removeIds.length > 0 || additions.length > 0) {
          const binding = actorBinding(actor);
          await tx.insert(toolAccessAuditEvents).values({
            companyId: connection.companyId,
            connectionId: connection.id,
            actorType: binding.actorType ?? "system",
            actorId: binding.actorId,
            action: "connection_installs.changed",
            outcome: "success",
            reasonCode: "installs_changed",
            details: {
              ...(markMcpAccessConfigured ? { mcpAgentAccessConfigured: true } : {}),
              added: additions.map((install) => ({
                targetType: install.targetType,
                targetId: install.targetId,
              })),
              removed: existing
                .filter((install) => removeIds.includes(install.id))
                .map((install) => ({
                  targetType: install.targetType,
                  targetId: install.targetId,
                })),
            },
          });
        }
      });
      for (const extension of accessExtensions) {
        await logActivity(db, {
          companyId: connection.companyId,
          actorType: actor?.actorType ?? "system",
          actorId: actor?.actorId ?? "system",
          action: "tool_connection.install_access_extended",
          entityType: "tool_connection",
          entityId: connection.id,
          details: extension,
        });
      }
      return {
        connectionId: connection.id,
        installs: await listConnectionInstalls(
          connection.id,
          connection.companyId,
        ),
      };
    },

    updateConnection: async (
      connectionId: string,
      input: UpdateToolConnection,
    ): Promise<ToolConnection> => {
      const existing = await getConnectionRow(connectionId);
      if (existing.connectionPurpose === "ai" && (input.config || input.transportConfig || input.credentialRefs || input.credentialSecretRefs || (input.credentialPolicy && input.credentialPolicy !== existing.credentialPolicy))) throw badRequest("Use AI account reconnect to change credentials. Provider, sign-in method, and ownership cannot be changed.");
      const config = normalizeGoogleSheetsConnectionConfig(
        input.config ?? input.transportConfig ?? existing.config,
      );
      if (input.config?.methodConfig !== undefined && typeof config.sourceTemplateKey === "string") {
        const app = getConnectableAppDefinition(config.sourceTemplateKey);
        if (app) normalizeConnectionMethodConfig(connectionMethodForConnection(app, { ...existing, config }), asRecord(config.methodConfig));
      }
      if (existing.transport === "mcp_remote")
        await assertRemoteConnectionEndpointsAllowed(config);
      if (existing.transport === "local_stdio")
        await stdioTemplateId(existing.companyId, config);
      assertLocalStdioCanBeEnabled(
        existing.transport,
        input.enabled ?? existing.enabled,
        config,
      );
      await assertGoogleSheetsSpreadsheetOwnership(existing.companyId, config, {
        excludeConnectionId: existing.id,
      });
      await assertSecretRefs(existing.companyId, [
        ...(input.credentialRefs ?? existing.credentialRefs),
        ...(input.credentialSecretRefs ?? existing.credentialSecretRefs),
      ]);
      const write = (database: Db) => database
        .update(toolConnections)
        .set({
          name: input.name ?? existing.name,
          status: input.status ?? existing.status,
          enabled: input.enabled ?? existing.enabled,
          ...(input.agentInstructions !== undefined ? { agentInstructions: input.agentInstructions } : {}),
          config,
          transportConfig: isGoogleSheetsConnectionConfig(config)
            ? config
            : (input.transportConfig ?? config),
          credentialRefs: input.credentialRefs ?? existing.credentialRefs,
          credentialSecretRefs:
            input.credentialSecretRefs ?? existing.credentialSecretRefs,
          credentialPolicy: input.credentialPolicy ?? existing.credentialPolicy,
          updatedAt: new Date(),
        })
        .where(eq(toolConnections.id, connectionId))
        .returning();
      const [row] = existing.transport === "chat_sdk"
        ? await db.transaction(async tx => {
            await notifyChatEndpointWork(tx, existing.id);
            const rows = await write(tx as unknown as Db);
            // Credential resolution must never observe the binding rebuild's
            // delete/insert gap after a configuration wake.
            await syncCredentialBindings(rows[0]!, [], tx);
            return rows;
          })
        : await write(db);
      if (existing.transport !== "chat_sdk") await syncCredentialBindings(row);
      await ensureRuntimeSlot(row);
      emitConnectionUpdated(row, existing, "api");
      return toConnection(row);
    },

    archiveConnection: removeConnection,

    checkHealth: checkConnectionHealth,

    refreshCatalog,

    configureRailwaySsh: async (connectionId: string, companyId: string, input: ConfigureRailwaySsh, actor: ActorInfo): Promise<RailwaySshSetup | null> => {
      const knownHosts = input.action === "enable" ? validateRailwayKnownHosts(input.knownHosts) : "";
      const setup = await db.transaction(async (tx) => {
        const [grant] = await tx.select().from(connectionGrants).where(and(eq(connectionGrants.id, input.grantId), eq(connectionGrants.connectionId, connectionId), eq(connectionGrants.companyId, companyId))).for("update");
        const [connection] = await tx.select().from(toolConnections).where(and(eq(toolConnections.id, connectionId), eq(toolConnections.companyId, companyId))).for("update");
        if (!connection || !isRailwayConnection(connection) || (connection.status !== "active" && input.action !== "remove")) throw unprocessable("Connect Railway before configuring container access.");
        if (!grant || (grant.status !== "active" && input.action !== "remove")) throw unprocessable("Select an active Railway authorization.");
        if (grant.kind === "user" && (actor.actorType !== "user" || actor.actorId !== grant.subjectUserId)) throw forbidden("Only this authorization's owner can configure its SSH key.");
        const existing = asRecord(connection.config.railwaySsh);
        if (existing.grantId && existing.grantId !== grant.id) throw conflict("Remove the existing container key before choosing another authorization.");
        const currentRef = grant.credentialSecretRefs.find((ref) => ref.configPath === RAILWAY_SSH_SECRET_PATH);
        let next: RailwaySshSetup | null = null;
        let refs = grant.credentialSecretRefs;
        if (input.action === "remove") {
          if (currentRef) await secretService(tx).remove(currentRef.secretId);
          refs = refs.filter((ref) => ref.configPath !== RAILWAY_SSH_SECRET_PATH);
        } else if (input.action === "prepare") {
          if (currentRef && typeof existing.publicKey === "string") return existing as unknown as RailwaySshSetup;
          const key = await generateRailwaySshKey();
          const ref = await createOrRotateOAuthSecret({ companyId, connection, configPath: RAILWAY_SSH_SECRET_PATH, label: "Railway container SSH key", value: key.privateKey, existingRefs: [], ownerUserId: grant.kind === "user" ? grant.subjectUserId ?? undefined : undefined, actor }, { dbClient: tx, secretClient: secretService(tx) });
          refs = [...refs.filter((ref) => ref.configPath !== RAILWAY_SSH_SECRET_PATH), ref];
          next = { grantId: grant.id, publicKey: key.publicKey, knownHosts: "", enabled: false };
        } else {
          if (!currentRef || typeof existing.publicKey !== "string") throw unprocessable("Generate and register a container key first.");
          next = { grantId: grant.id, publicKey: existing.publicKey, knownHosts, enabled: true };
        }
        await tx.update(connectionGrants).set({ credentialSecretRefs: refs, updatedAt: now() }).where(and(eq(connectionGrants.id, grant.id), eq(connectionGrants.companyId, companyId)));
        const config = { ...connection.config, railwaySsh: next };
        const [updated] = await tx.update(toolConnections).set({ config, transportConfig: config, updatedAt: now() }).where(and(eq(toolConnections.id, connectionId), eq(toolConnections.companyId, companyId))).returning();
        await syncCredentialBindings(updated, [], tx);
        return next;
      });
      await audit({ companyId, connectionId, action: "tool_connection.railway_ssh_updated", outcome: "success", actor, details: { action: input.action, grantId: input.grantId, enabled: setup?.enabled ?? false } });
      return setup;
    },

    listAppsNeedingAttention,

    sweepConnectionHealth,

    sweepGitHubConnectionContinuity,

    listCatalog: async (
      connectionId: string,
      companyId?: string,
      actor?: ActorInfo,
    ): Promise<ToolCatalogEntry[]> => {
      const connection = await getConnectionRow(connectionId, companyId);
      let rows = await db
        .select()
        .from(toolCatalogEntries)
        .where(eq(toolCatalogEntries.connectionId, connection.id))
        .orderBy(desc(toolCatalogEntries.updatedAt));
      // Native provider catalogs change with the deployed code. Upgrade saved
      // Daytona connections too; their first small catalog must not survive
      // merely because REST discovery has no remote MCP cache timer.
      const nativeDaytona = isDaytonaConnection(connection);
      const rowsByName = new Map(rows.map((row) => [row.toolName, row]));
      const daytonaCatalogChanged = nativeDaytona && connection.status === "active" && (
        rows.some((row) => row.status !== "removed" && !isDaytonaToolName(row.toolName))
        || DAYTONA_TOOLS.some((tool) => {
          const existing = rowsByName.get(tool.name);
          return !existing || existing.versionHash !== descriptorHash(tool, daytonaRisk(tool.name));
        })
      );
      const cacheExpired = daytonaCatalogChanged || (
        connection.transport === "mcp_remote" &&
        connection.status !== "archived" &&
        (rows.length === 0 ||
          !connection.lastCatalogRefreshAt ||
          connection.lastCatalogRefreshAt.getTime() <=
            now().getTime() - catalogCacheTtlMs));
      if (cacheExpired) {
        try {
          await singleFlight(catalogRefreshFlights, connection.id, () =>
            refreshCatalog(connection.id, nativeDaytona && actor ? actor : {
              actorType: "system",
              actorId: "tool_catalog_cache",
            }),
          );
          rows = await db
            .select()
            .from(toolCatalogEntries)
            .where(eq(toolCatalogEntries.connectionId, connection.id))
            .orderBy(desc(toolCatalogEntries.updatedAt));
        } catch (error) {
          // A stale catalog remains useful when the remote server is temporarily
          // unavailable. Empty caches still fail so callers never mistake “no
          // actions discovered” for a successful lookup.
          if (rows.length === 0) throw error;
        }
      }
      // Even failed discovery must not keep retired native tools visible.
      // Their database rows remain available to historical invocation records.
      return rows
        .filter((row) => !nativeDaytona || (row.status !== "removed" && isDaytonaToolName(row.toolName)))
        .map((row) => toCatalogEntryForConnection(row, connection));
    },

    /** Recent tool-call events for one connection — drives App detail · Recent activity. */
    listConnectionActivity: async (
      connectionId: string,
      companyId?: string,
      limit = 20,
    ): Promise<ToolConnectionActivityResponse> => {
      const connection = await getConnectionRow(connectionId, companyId);
      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
      const rows = await db
        .select()
        .from(toolCallEvents)
        .where(
          and(
            eq(toolCallEvents.companyId, connection.companyId),
            eq(toolCallEvents.connectionId, connection.id),
          ),
        )
        .orderBy(desc(toolCallEvents.createdAt))
        .limit(safeLimit);
      const events = rows.map(toToolCallEvent);

      const issueIds = [
        ...new Set(rows.map((row) => row.issueId).filter(Boolean)),
      ] as string[];
      const issueRows = issueIds.length
        ? await db
            .select({
              id: issues.id,
              identifier: issues.identifier,
              title: issues.title,
            })
            .from(issues)
            .where(
              and(
                eq(issues.companyId, connection.companyId),
                inArray(issues.id, issueIds),
              ),
            )
        : [];
      const issueMap = Object.fromEntries(
        issueRows.map((issue) => [
          issue.id,
          {
            identifier: issue.identifier ?? issue.id,
            title: issue.title,
          },
        ]),
      );

      const actionRequestIds = [
        ...new Set(rows.map((row) => row.actionRequestId).filter(Boolean)),
      ] as string[];
      const requestRows = actionRequestIds.length
        ? await db
            .select({
              id: toolActionRequests.id,
              status: toolActionRequests.status,
              resolvedByAgentId: toolActionRequests.resolvedByAgentId,
              resolvedByUserId: toolActionRequests.resolvedByUserId,
            })
            .from(toolActionRequests)
            .where(
              and(
                eq(toolActionRequests.companyId, connection.companyId),
                inArray(toolActionRequests.id, actionRequestIds),
              ),
            )
        : [];

      const resolverAgentIds = [
        ...new Set(
          requestRows.map((row) => row.resolvedByAgentId).filter(Boolean),
        ),
      ] as string[];
      const resolverUserIds = [
        ...new Set(
          requestRows.map((row) => row.resolvedByUserId).filter(Boolean),
        ),
      ] as string[];
      const resolverAgents = resolverAgentIds.length
        ? await db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(
              and(
                eq(agents.companyId, connection.companyId),
                inArray(agents.id, resolverAgentIds),
              ),
            )
        : [];
      const resolverUsers = resolverUserIds.length
        ? await db
            .select({
              id: authUsers.id,
              name: authUsers.name,
              email: authUsers.email,
            })
            .from(authUsers)
            .where(inArray(authUsers.id, resolverUserIds))
        : [];
      const resolverAgentNames = new Map(
        resolverAgents.map((agent) => [agent.id, agent.name]),
      );
      const resolverUserNames = new Map(
        resolverUsers.map((user) => [
          user.id,
          user.name?.trim() || user.email?.trim() || user.id,
        ]),
      );
      const actionRequestMap = Object.fromEntries(
        requestRows.map((request) => [
          request.id,
          {
            status: request.status,
            resolverDisplayName: request.resolvedByAgentId
              ? (resolverAgentNames.get(request.resolvedByAgentId) ??
                request.resolvedByAgentId)
              : request.resolvedByUserId
                ? (resolverUserNames.get(request.resolvedByUserId) ??
                  userFallbackName(request.resolvedByUserId))
                : null,
            resolvedByAgentId: request.resolvedByAgentId,
            resolvedByUserId: request.resolvedByUserId,
          },
        ]),
      );

      const lifecycleEvents = await listConnectionLifecycleEvents(db, {
        companyId: connection.companyId,
        connectionIds: [connection.id],
        limit: safeLimit,
      });

      return {
        connectionId: connection.id,
        events,
        lifecycleEvents,
        issues: issueMap,
        actionRequests: actionRequestMap,
      };
    },

    /**
     * List "Ask first" action requests for the review queue, enriched with the
     * connection/app context the prosumer card renders. Defaults to pending.
     */
    listActionRequests: async (
      companyId: string,
      status: ToolActionRequestStatus = "pending",
    ): Promise<ToolActionRequestListItem[]> => {
      const requests = await db
        .select()
        .from(toolActionRequests)
        .where(
          and(
            eq(toolActionRequests.companyId, companyId),
            eq(toolActionRequests.status, status),
          ),
        )
        .orderBy(desc(toolActionRequests.createdAt));
      if (requests.length === 0) return [];

      const invocationIds = [
        ...new Set(requests.map((request) => request.invocationId)),
      ];
      const invocations = await db
        .select()
        .from(toolInvocations)
        .where(
          and(
            eq(toolInvocations.companyId, companyId),
            inArray(toolInvocations.id, invocationIds),
          ),
        );
      const invocationById = new Map(
        invocations.map((invocation) => [invocation.id, invocation]),
      );
      let visibleRequests = requests;
      if (status === "pending") {
        // A pending request that the creator has not signed yet is still being
        // set up. The gateway creates the row (signedArguments = null) and signs
        // it in a second step, so a review-queue read can observe the row inside
        // that window. Hide such a request from the queue, but do not cancel it —
        // cancelling here races the two-step create and makes the later approve
        // fail with action_not_pending. Only cancel a request that carries a
        // signature we cannot verify (secret rotation or tampering), or an
        // unsigned row whose creator has exceeded the signing grace period.
        const unsignedRequestIds = new Set<string>();
        const invalidRequestIds: string[] = [];
        for (const request of requests) {
          const invocation = invocationById.get(request.invocationId);
          if (!invocation) {
            invalidRequestIds.push(request.id);
            continue;
          }
          if (request.signedArguments === null) {
            if (
              Date.now() - request.createdAt.getTime() >=
              TOOL_ACTION_REQUEST_SIGNING_GRACE_MS
            ) {
              invalidRequestIds.push(request.id);
            } else {
              unsignedRequestIds.add(request.id);
            }
            continue;
          }
          let readable = false;
          try {
            readable = Boolean(
              readSignedToolArgumentsPayload({
                signedArguments: request.signedArguments,
                invocationId: invocation.id,
                toolName: invocation.toolName,
              }),
            );
          } catch {
            readable = false;
          }
          if (!readable) invalidRequestIds.push(request.id);
        }
        if (invalidRequestIds.length > 0) {
          await db
            .update(toolActionRequests)
            .set({
              status: "cancelled",
              resolvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(toolActionRequests.companyId, companyId),
                eq(toolActionRequests.status, "pending"),
                inArray(toolActionRequests.id, invalidRequestIds),
              ),
            );
        }
        const hiddenIds = new Set([
          ...invalidRequestIds,
          ...unsignedRequestIds,
        ]);
        if (hiddenIds.size > 0) {
          visibleRequests = requests.filter(
            (request) => !hiddenIds.has(request.id),
          );
        }
      }
      if (visibleRequests.length === 0) return [];

      const visibleInvocations = visibleRequests
        .map((request) => invocationById.get(request.invocationId))
        .filter(
          (invocation): invocation is typeof toolInvocations.$inferSelect =>
            Boolean(invocation),
        );
      const connectionIds = [
        ...new Set(
          visibleInvocations
            .map((invocation) => invocation.connectionId)
            .filter(Boolean),
        ),
      ] as string[];
      const connections = connectionIds.length
        ? await db
            .select()
            .from(toolConnections)
            .where(inArray(toolConnections.id, connectionIds))
        : [];
      const connectionById = new Map(
        connections.map((connection) => [connection.id, connection]),
      );

      const applicationIds = [
        ...new Set(
          connections
            .map((connection) => connection.applicationId)
            .filter(Boolean),
        ),
      ] as string[];
      const applications = applicationIds.length
        ? await db
            .select()
            .from(toolApplications)
            .where(inArray(toolApplications.id, applicationIds))
        : [];
      const applicationById = new Map(
        applications.map((application) => [application.id, application]),
      );

      const catalogEntryIds = [
        ...new Set(
          visibleInvocations
            .map((invocation) => invocation.catalogEntryId)
            .filter(Boolean),
        ),
      ] as string[];
      const catalogEntries = catalogEntryIds.length
        ? await db
            .select()
            .from(toolCatalogEntries)
            .where(inArray(toolCatalogEntries.id, catalogEntryIds))
        : [];
      const catalogById = new Map(
        catalogEntries.map((entry) => [entry.id, entry]),
      );

      return visibleRequests.map((request) => {
        const invocation = invocationById.get(request.invocationId);
        const connection = invocation?.connectionId
          ? connectionById.get(invocation.connectionId)
          : undefined;
        const application = connection?.applicationId
          ? applicationById.get(connection.applicationId)
          : undefined;
        const catalogEntry = invocation?.catalogEntryId
          ? catalogById.get(invocation.catalogEntryId)
          : undefined;
        return {
          request: toToolActionRequest(request),
          toolName: invocation?.toolName ?? catalogEntry?.toolName ?? "",
          toolTitle: catalogEntry?.title ?? null,
          connectionId: connection?.id ?? invocation?.connectionId ?? null,
          connectionName: connection?.name ?? null,
          applicationName: application?.name ?? null,
          riskLevel: catalogEntry?.riskLevel ?? null,
          requestedByAgentId: request.requestedByAgentId ?? null,
        };
      });
    },
    ...profileService,
    ...profileResolver,
    mintConnectionTokenForAgent,

    listRuntimeSlots: async (companyId: string): Promise<ToolRuntimeSlot[]> => {
      const rows = await db
        .select()
        .from(toolRuntimeSlots)
        .where(eq(toolRuntimeSlots.companyId, companyId))
        .orderBy(desc(toolRuntimeSlots.updatedAt));
      return rows.map(toRuntimeSlot);
    },

    stopRuntimeSlot: (
      companyId: string,
      slotId: string,
      actor?: ActorInfo,
    ): Promise<ToolRuntimeSlot> =>
      controlRuntimeSlot({ companyId, slotId, action: "stop", actor }),

    restartRuntimeSlot: (
      companyId: string,
      slotId: string,
      actor?: ActorInfo,
    ): Promise<ToolRuntimeSlot> =>
      controlRuntimeSlot({ companyId, slotId, action: "restart", actor }),

    getRuntimeHealth: runtimeHealth,

    getRunDecisionLookup: async (
      companyId: string,
      runId: string,
    ): Promise<ToolRunDecisionLookup> => {
      const [run] = await db
        .select({ id: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.id, runId),
            eq(heartbeatRuns.companyId, companyId),
          ),
        )
        .limit(1);
      if (!run) throw notFound("Run not found");

      const invocationRows = await db
        .select()
        .from(toolInvocations)
        .where(
          and(
            eq(toolInvocations.companyId, companyId),
            eq(toolInvocations.runId, runId),
          ),
        )
        .orderBy(desc(toolInvocations.createdAt));
      const invocationIds = invocationRows.map((row) => row.id);
      const [actionRequestRows, auditEventRows] =
        invocationIds.length > 0
          ? await Promise.all([
              db
                .select()
                .from(toolActionRequests)
                .where(
                  and(
                    eq(toolActionRequests.companyId, companyId),
                    inArray(toolActionRequests.invocationId, invocationIds),
                  ),
                ),
              db
                .select()
                .from(toolCallEvents)
                .where(
                  and(
                    eq(toolCallEvents.companyId, companyId),
                    eq(toolCallEvents.runId, runId),
                    inArray(toolCallEvents.invocationId, invocationIds),
                  ),
                )
                .orderBy(desc(toolCallEvents.createdAt)),
            ])
          : [[], []];

      const actionRequestByInvocation = new Map(
        actionRequestRows.map((row) => [row.invocationId, row]),
      );
      const auditEventsByInvocation = new Map<
        string,
        (typeof toolCallEvents.$inferSelect)[]
      >();
      for (const event of auditEventRows) {
        if (!event.invocationId) continue;
        const events = auditEventsByInvocation.get(event.invocationId) ?? [];
        events.push(event);
        auditEventsByInvocation.set(event.invocationId, events);
      }

      const decisions: ToolRunDecision[] = invocationRows.map((invocation) => {
        const actionRequest =
          actionRequestByInvocation.get(invocation.id) ?? null;
        const auditEvents = auditEventsByInvocation.get(invocation.id) ?? [];
        const latestAuditEvent = auditEvents[0] ?? null;
        const apiInvocation = toToolInvocation(invocation);
        const apiActionRequest = actionRequest
          ? toToolActionRequest(actionRequest)
          : null;
        const apiAuditEvents = auditEvents.map(toToolCallEvent);
        const apiLatestAuditEvent = latestAuditEvent
          ? toToolCallEvent(latestAuditEvent)
          : null;
        const pendingAction =
          actionRequest && actionRequest.status === "pending"
            ? {
                actionRequestId: actionRequest.id,
                issueId: actionRequest.issueId,
                interactionId: actionRequest.interactionId,
                approvalId: actionRequest.approvalId,
                status: actionRequest.status,
                previewMarkdown: actionRequest.previewMarkdown,
              }
            : null;
        return {
          invocation: apiInvocation,
          actionRequest: apiActionRequest,
          auditEvents: apiAuditEvents,
          latestAuditEvent: apiLatestAuditEvent,
          decision: latestAuditEvent?.decision ?? invocation.policyDecision,
          outcome: latestAuditEvent?.outcome ?? null,
          reasonCode: latestAuditEvent?.reasonCode ?? invocation.errorCode,
          denialReason: denialReasonForDecision(invocation, latestAuditEvent),
          pendingAction,
        } satisfies ToolRunDecision;
      });

      return { runId, decisions };
    },

    previewMcpJsonImport: async (
      input: ImportMcpJson,
    ): Promise<McpJsonImportPreview> => {
      let raw: unknown;
      try {
        raw =
          typeof input.mcpJson === "string"
            ? (JSON.parse(input.mcpJson) as unknown)
            : input.mcpJson;
      } catch {
        throw badRequest("mcp.json must be valid JSON");
      }
      const mcpServers = asRecord(asRecord(raw).mcpServers);
      const drafts = Object.entries(mcpServers).map(([name, rawServer]) => {
        const server = asRecord(rawServer);
        const warnings: string[] = [];
        if (
          typeof server.url === "string" ||
          typeof server.endpoint === "string"
        ) {
          const headers = asRecord(server.headers);
          const credentialFields = Object.keys(headers)
            .sort()
            .map((key) => {
              warnings.push(
                `Header ${key} will be stored as a Paperclip secret before activation.`,
              );
              return {
                configPath: `headers.${key}`,
                label: key,
                placement: "header" as const,
                key,
                prefix: null,
                required: true,
              };
            });
          return {
            name,
            transport: "mcp_remote" as const,
            status: "draft" as const,
            config: { url: server.url ?? server.endpoint },
            credentialRefs: [] as McpConnectionCredentialRef[],
            credentialFields,
            warnings,
          };
        }
        if (typeof server.command === "string") {
          warnings.push(
            "Imported stdio commands stay draft-only unless mapped to an approved Paperclip template.",
          );
          return {
            name,
            transport: "local_stdio" as const,
            status: "draft" as const,
            config: {
              importedCommand: server.command,
              importedArgs: Array.isArray(server.args) ? server.args : [],
            },
            credentialRefs: [],
            credentialFields: [],
            warnings,
          };
        }
        warnings.push("Unsupported MCP server entry.");
        return {
          name,
          transport: "mcp_remote" as const,
          status: "draft" as const,
          config: {},
          credentialRefs: [],
          credentialFields: [],
          warnings,
        };
      });
      if (drafts.length === 0)
        throw badRequest("mcp.json must include an mcpServers object");
      return { drafts };
    },

    assertConnectionCompany: async (
      connectionId: string,
      companyId: string,
    ) => {
      const connection = await getConnectionRow(connectionId, companyId);
      return toConnection(connection);
    },

    ensureNoDuplicateNameError: (error: unknown) => {
      const maybeRecord =
        typeof error === "object" && error !== null
          ? (error as Record<string, unknown>)
          : null;
      const cause = maybeRecord?.cause;
      const maybeCause =
        typeof cause === "object" && cause !== null
          ? (cause as Record<string, unknown>)
          : null;
      const message = [
        error instanceof Error ? error.message : String(error),
        maybeRecord && typeof maybeRecord.detail === "string"
          ? maybeRecord.detail
          : null,
        maybeCause instanceof Error ? maybeCause.message : null,
        maybeCause && typeof maybeCause.detail === "string"
          ? maybeCause.detail
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      const code =
        maybeRecord && typeof maybeRecord.code === "string"
          ? maybeRecord.code
          : maybeCause && typeof maybeCause.code === "string"
            ? maybeCause.code
            : null;
      const constraint =
        maybeRecord && typeof maybeRecord.constraint === "string"
          ? maybeRecord.constraint
          : maybeRecord && typeof maybeRecord.constraint_name === "string"
            ? maybeRecord.constraint_name
            : maybeCause && typeof maybeCause.constraint === "string"
              ? maybeCause.constraint
              : maybeCause && typeof maybeCause.constraint_name === "string"
                ? maybeCause.constraint_name
                : null;
      if (
        code === "23505" ||
        constraint?.includes("tool_applications") ||
        /duplicate key value|unique constraint|tool_applications_company_id_name_unique/i.test(
          message,
        )
      ) {
        throw conflict("A tool access record with that name already exists", {
          code: "tool_access_name_conflict",
        });
      }
      throw error;
    },
  };
}
