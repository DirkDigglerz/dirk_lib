import { createScriptConfig, fetchNui } from "dirk-cfx-react";
import type { ScriptConfigHistoryRequest, ScriptConfigHistoryResponse } from "dirk-cfx-react/hooks";

export type AppearanceSettings = {
  primaryColor: string;
  primaryShade: number;
  customTheme: string[];
};

export type BasicSettings = {
  serverName: string;
  language: string;
  currency: string;
  debug: boolean;
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
  framework:   string;
  inventory:   string;
  itemImgPath: string;
  target:      string;
  interact:    string;
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

export type DiscordSettings = {
  botToken: string;
  guildId:  string;
};

export type LoggerService = "off" | "datadog" | "loki" | "fivemanage";

export type LoggerSettings = {
  service:  LoggerService;
  hostname: string;
  loki: {
    endpoint: string;
    user:     string;
    password: string;
    tenant:   string;
  };
  datadog: {
    apiKey: string;
    site:   string;
  };
  fivemanage: {
    apiKey: string;
  };
};

export type AdvancedSettings = {
  primaryIdentifier: string;
};

export type ScriptConfigOverride = {
  resource: string;
  groups: string[];
  identifiers: string[];
};

export type ScriptConfigSettings = {
  overrides: ScriptConfigOverride[];
};

export type ScriptConfig = {
  basic:        BasicSettings;
  appearance:   AppearanceSettings;
  bridging:     BridgingSettings;
  groups:       GroupsSettings;
  scriptConfig: ScriptConfigSettings;
  discord:      DiscordSettings;
  logger:       LoggerSettings;
  advanced:     AdvancedSettings;
};

export const defaultScriptConfig: ScriptConfig = {
  basic: {
    serverName: "DirkRP",
    language: "en",
    currency: "$",
    debug: false,
  },
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
  bridging: {
    notify:      "ox_lib",
    progress:    "ox_lib",
    showTextUI:  "ox_lib",
    contextMenu: "ox_lib",
    alertDialog: "ox_lib",
    inputDialog: "ox_lib",
    framework:   "auto",
    inventory:   "auto",
    itemImgPath: "auto",
    target:      "auto",
    interact:    "auto",
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
  scriptConfig: {
    overrides: [],
  },
  discord: {
    botToken: "",
    guildId:  "",
  },
  logger: {
    service:  "off",
    hostname: "",
    loki: {
      endpoint: "",
      user:     "",
      password: "",
      tenant:   "",
    },
    datadog: {
      apiKey: "",
      site:   "datadoghq.com",
    },
    fivemanage: {
      apiKey: "",
    },
  },
  advanced: {
    primaryIdentifier: "license",
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
