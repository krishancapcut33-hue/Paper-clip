import type { UIAdapterModule } from "../types";
import { parseMuseStdoutLine, buildMuseLocalConfig } from "@paperclipai/adapter-muse-local/ui";
import { MuseLocalConfigFields } from "./config-fields";

export const museLocalUIAdapter: UIAdapterModule = {
  type: "muse_local",
  label: "Muse Code",
  parseStdoutLine: parseMuseStdoutLine,
  ConfigFields: MuseLocalConfigFields,
  buildAdapterConfig: buildMuseLocalConfig,
};
