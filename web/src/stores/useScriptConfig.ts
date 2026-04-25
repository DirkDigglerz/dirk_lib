import { createScriptConfig, fetchNui } from "dirk-cfx-react";
import type { ScriptConfigHistoryRequest, ScriptConfigHistoryResponse } from "dirk-cfx-react/hooks";

export type AppearanceSettings = {
  primaryColor: string;
  primaryShade: number;
  customTheme: string[];
  serverName: string;
  logo: string;
};

export type LocalizationSettings = {
  language: string;
  currency: string;
};

export type ScriptConfig = {
  appearance: AppearanceSettings;
  localization: LocalizationSettings;
};

export const defaultScriptConfig: ScriptConfig = {
  appearance: {
    primaryColor: "dirk",
    primaryShade: 9,
    customTheme: [
      "#f8edff",
      "#e9d9f6",
      "#d0b2e8",
      "#b588da",
      "#9e65cf",
      "#914ec8",
      "#8a43c6",
      "#7734af",
      "#692d9d",
      "#5c258b",
    ],
    serverName: "DirkRP",
    logo: "https://via.placeholder.com/150",
  },
  localization: {
    language: "en",
    currency: "$",
  },
};

export const {
  store: useScriptConfig,
  updateScriptConfig,
  useScriptConfigHooks,
  fetchScriptConfig,
  resetConfig,
} = createScriptConfig<ScriptConfig>(defaultScriptConfig);

export const getScriptConfigHistory = async (
  params: ScriptConfigHistoryRequest = {},
): Promise<ScriptConfigHistoryResponse> => {
  return fetchNui<ScriptConfigHistoryResponse>("GET_SCRIPT_CONFIG_HISTORY", params);
};
