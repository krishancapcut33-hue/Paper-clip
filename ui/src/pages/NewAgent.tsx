import { useEffect } from "react";
import { t, useTranslation } from "@/i18n";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { NewAgentSetup } from "../components/new-agent/NewAgentSetup";

export function NewAgent() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useTranslation();
  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: "New agent" },
    ]);
  }, [setBreadcrumbs, t]);
  return <NewAgentSetup />;
}
