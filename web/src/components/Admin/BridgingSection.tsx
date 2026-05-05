import { Flex, Select, Text, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, useFormActions, useFormField } from "dirk-cfx-react";
import { Plug } from "lucide-react";
import type { BridgingSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

type FieldDef = {
  key: keyof BridgingSettings;
  label: string;
  tooltip: string;
  options: string[];
};

type FieldGroup = {
  label: string;
  fields: FieldDef[];
};

const withAuto = (opts: string[]) => ["auto", ...opts];

const GROUPS: FieldGroup[] = [
  {
    label: "User Interface",
    fields: [
      { key: "notify",      label: "Notify",       tooltip: "Provider for lib.notify (toast notifications).",       options: ["ox_lib", "dirk_lib"] },
      { key: "progress",    label: "Progress",     tooltip: "Provider for lib.progressBar / lib.progressCircle.",   options: ["ox_lib", "dirk_lib"] },
      { key: "showTextUI",  label: "Show Text UI", tooltip: "Provider for lib.showTextUI / hideTextUI.",            options: ["ox_lib", "dirk_lib"] },
      { key: "contextMenu", label: "Context Menu", tooltip: "Provider for lib.registerContext / showContext.",      options: ["ox_lib", "dirk_lib"] },
      { key: "alertDialog", label: "Alert Dialog", tooltip: "Provider for lib.alertDialog (confirm/cancel modals).", options: ["ox_lib", "dirk_lib"] },
      { key: "inputDialog", label: "Input Dialog", tooltip: "Provider for lib.inputDialog (form-style prompts).",   options: ["ox_lib", "dirk_lib"] },
    ],
  },
  {
    label: "Framework",
    fields: [
      { key: "framework", label: "Framework", tooltip: "Server framework dirk_lib reads player data from.", options: withAuto(["es_extended", "qbx_core", "qb-core", "nd-framework"]) },
    ],
  },
  {
    label: "Inventory & Targeting",
    fields: [
      { key: "inventory", label: "Inventory", tooltip: "Inventory system used for item lookups, give/remove, and image paths.", options: withAuto(["dirk_inventory", "ox_inventory", "qb-inventory", "qs-inventory", "codem-inventory", "tgiann_inventory", "mf-inventory", "core_inventory"]) },
      { key: "target",    label: "Target",    tooltip: "Targeting system for entity interactions.",                              options: withAuto(["ox_target", "qb-target", "q-target", "bt-target"]) },
      { key: "interact",  label: "Interact",  tooltip: "Interact-prompt system used as the alternative to target-based interactions.", options: withAuto(["redm-uiprompt", "sleepless_interact", "interact"]) },
    ],
  },
  {
    label: "Vehicles",
    fields: [
      { key: "keys",   label: "Vehicle Keys", tooltip: "Vehicle keys / lockpicking system.",        options: withAuto(["cd_garage", "MrNewbVehicleKeys", "t1ger_keys", "okokGarage", "qb-vehiclekeys", "qbx_vehiclekeys", "qs-vehiclekeys", "Renewed-Vehiclekeys", "vehicles_keys", "wasabi_carlock", "ludaro-keys"]) },
      { key: "fuel",   label: "Fuel",         tooltip: "Vehicle fuel system.",                       options: withAuto(["cdn-fuel", "LegacyFuel", "ox_fuel", "ps-fuel", "Renewed-Fuel", "ti_fuel", "x-fuel", "wasabi_fuel", "okokGasStation"]) },
      { key: "garage", label: "Garage",       tooltip: "Garage / vehicle storage system.",           options: withAuto(["qb-garages", "wasabi_garage", "renewed-garage"]) },
    ],
  },
  {
    label: "World",
    fields: [
      { key: "time",     label: "Time / Weather", tooltip: "Weather/time sync resource.", options: withAuto(["av_weather", "cd_easytime", "qb-weathersync", "Renewed-Weathersync", "vSync", "wasabi_wheather"]) },
      { key: "doorlock", label: "Doorlock",       tooltip: "Doorlock system.",            options: withAuto(["ox_doorlock", "qb-doorlock", "nui_doorlock", "doors_creator"]) },
      { key: "housing",  label: "Housing",        tooltip: "Player housing system.",      options: withAuto(["qs-housing", "rtx_housing", "bcs_housing", "origen_housing"]) },
    ],
  },
  {
    label: "Player Systems",
    fields: [
      { key: "phone",     label: "Phone",     tooltip: "Phone resource (used for messages, mail, etc.).", options: withAuto(["lb-phone", "qb-phone", "gksphone", "high-phone", "npwd"]) },
      { key: "clothing",  label: "Clothing",  tooltip: "Clothing / character appearance system.",         options: withAuto(["esx_skin", "qb-clothing", "rcore_clothing", "illenium-appearance", "fivem-appearance", "dirk_charCreator", "tgiann_clothing"]) },
      { key: "skills",    label: "Skills",    tooltip: "Skills / progression system.",                    options: withAuto(["sd_skills", "evolent_skills", "core_skills", "B1-skillz", "skill_system_v1.5", "skillsystem_v3", "boii_skills", "skillsystem_v2", "ot_skill_system"]) },
      { key: "ambulance", label: "Ambulance", tooltip: "Ambulance / death + revive system.",              options: withAuto(["qb-ambulancejob", "wasabi_ambulance", "core_ambulance"]) },
      { key: "prison",    label: "Prison",    tooltip: "Prison / jail system.",                           options: withAuto(["qb-prison", "rcore_prison", "wasabi_jail"]) },
      { key: "dispatch",  label: "Dispatch",  tooltip: "Dispatch / police alert system.",                 options: withAuto(["bub_mdt", "cd_dispatch", "linden_outlawalert", "qs_dispatch", "ps-dispatch", "tk_dispatch"]) },
    ],
  },
];

function GroupLabel({ label }: { label: string }) {
  return (
    <Flex align="center" gap="xs" mt="xxs">
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c="rgba(255,255,255,0.2)">
        {label}
      </Text>
      <div style={{ flex: 1, height: "0.05vh", background: "rgba(255,255,255,0.06)" }} />
    </Flex>
  );
}

export default function BridgingSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("bridging") as BridgingSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.bridging);
  const config = (formConfig ?? storeConfig) as BridgingSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof BridgingSettings>(key: K, val: BridgingSettings[K]) =>
    setValue("bridging", { ...config, [key]: val });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Plug} title="Bridging" color={color} />

      {GROUPS.map((group) => (
        <div key={group.label}>
          <GroupLabel label={group.label} />
          <Flex direction="column" gap="xs">
            {group.fields.map((field) => (
              <Select
                key={field.key as string}
                label={<InfoLabel label={field.label} tooltip={field.tooltip} />}
                size="xs"
                value={config[field.key] as string}
                data={field.options.map((o) => ({ value: o, label: o }))}
                allowDeselect={false}
                searchable
                onChange={(v) => v && set(field.key, v as BridgingSettings[typeof field.key])}
              />
            ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}
