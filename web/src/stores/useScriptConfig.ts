import { createScriptConfig, fetchNui } from "dirk-cfx-react";
import type { ScriptConfigHistoryRequest, ScriptConfigHistoryResponse } from "dirk-cfx-react/hooks";

export type AppearanceSettings = {
  primaryColor: string;
  primaryShade: number;
  customTheme: string[];
};

export type LocalizationSettings = {
  language: string;
  currency: string;
};

export type BrandingSettings = {
  serverName: string;
  logo: string;
  itemImgPath: string;
};

export type BridgingSettings = {
  // UI providers
  notify:      string;
  progress:    string;
  showTextUI:  string;
  contextMenu: string;
  alertDialog: string;
  inputDialog: string;
  // Resource providers
  framework: string;
  inventory: string;
  target:    string;
  interact:  string;
  time:      string;
  keys:      string;
  fuel:      string;
  phone:     string;
  garage:    string;
  clothing:  string;
  ambulance: string;
  prison:    string;
  dispatch:  string;
  doorlock:  string;
  skills:    string;
  housing:   string;
};

export type GroupsSettings = {
  maxMembers:        number;
  maxDistanceInvite: number;
  inviteValidTime:   number;
  maxLogOffTime:     number;
};

export type AdvancedSettings = {
  primaryIdentifier: string;
  debug: boolean;
};

export type ScriptConfig = {
  appearance:   AppearanceSettings;
  localization: LocalizationSettings;
  branding:     BrandingSettings;
  bridging:     BridgingSettings;
  groups:       GroupsSettings;
  advanced:     AdvancedSettings;
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
  },
  localization: {
    language: "en",
    currency: "$",
  },
  branding: {
    serverName: "DirkRP",
    logo: "https://via.placeholder.com/150",
    itemImgPath: "auto",
  },
  bridging: {
    notify:      "ox_lib",
    progress:    "ox_lib",
    showTextUI:  "ox_lib",
    contextMenu: "ox_lib",
    alertDialog: "ox_lib",
    inputDialog: "ox_lib",
    framework: "auto",
    inventory: "auto",
    target:    "auto",
    interact:  "auto",
    time:      "auto",
    keys:      "auto",
    fuel:      "auto",
    phone:     "auto",
    garage:    "auto",
    clothing:  "auto",
    ambulance: "auto",
    prison:    "auto",
    dispatch:  "auto",
    doorlock:  "auto",
    skills:    "auto",
    housing:   "auto",
  },
  groups: {
    maxMembers:        5,
    maxDistanceInvite: 5,
    inviteValidTime:   5,
    maxLogOffTime:     5,
  },
  advanced: {
    primaryIdentifier: "license",
    debug: false,
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
