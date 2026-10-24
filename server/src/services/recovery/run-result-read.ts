import { heartbeatRuns } from "@paperclipai/db";
import { sql } from "drizzle-orm";

const recoveryResultKeys = [
  "errorFamily", "workspaceValidation", "configurationIncomplete",
  "cancelledByActorType", "retryNotBefore", "transientRetryNotBefore",
  "providerQuotaRetryNotBefore", "finalizationReasonCode",
] as const;

/** These three classifiers inspect arbitrary provider error text. Other
 * recovery decisions consume the structured fields below, not model output.
 * Keep the full stored result and all execution/detail reads unchanged. */
export const recoveryRunResultColumn = sql<Record<string, unknown> | null>`
  case
    when ${heartbeatRuns.resultJson} is null then null
    when ${heartbeatRuns.errorCode} in ('adapter_failed', 'provider_quota', 'configuration_incomplete')
      then ${heartbeatRuns.resultJson}
    else (
      select coalesce(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
      from jsonb_each(case when jsonb_typeof(${heartbeatRuns.resultJson}) = 'object'
        then ${heartbeatRuns.resultJson} else '{}'::jsonb end) as field(key, value)
      where field.key in (${sql.join(recoveryResultKeys.map(key => sql`${key}`), sql`, `)})
    )
  end
`;
