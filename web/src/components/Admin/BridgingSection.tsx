import { Flex, Select, Text, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { Plug } from "lucide-react";
import type { BridgingSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

// Field/group definitions store *locale keys* now, not literal strings.
// Resolved at render via locale(...) so server owners can translate the
// whole panel by editing /locales/{lang}.json without touching code.
type FieldDef = {
  key: keyof BridgingSettings;
  labelKey: string;
  tooltipKey: string;
  options: string[];
};

type FieldGroup = {
  labelKey: string;
  fields: FieldDef[];
};

const withAuto = (opts: string[]) => ["auto", ...opts];

const GROUPS: FieldGroup[] = [
  {
    labelKey: "dirk_lib_bridging_group_ui",
    fields: [
      { key: "notify",      labelKey: "dirk_lib_bridging_notify_label",   tooltipKey: "dirk_lib_bridging_notify_tooltip",   options: ["ox_lib", "dirk_lib"] },
      { key: "progress",    labelKey: "dirk_lib_bridging_progress_label", tooltipKey: "dirk_lib_bridging_progress_tooltip", options: ["ox_lib", "dirk_lib"] },
      { key: "showTextUI",  labelKey: "dirk_lib_bridging_textui_label",   tooltipKey: "dirk_lib_bridging_textui_tooltip",   options: ["ox_lib", "dirk_lib"] },
      { key: "contextMenu", labelKey: "dirk_lib_bridging_context_label",  tooltipKey: "dirk_lib_bridging_context_tooltip",  options: ["ox_lib", "dirk_lib"] },
      { key: "alertDialog", labelKey: "dirk_lib_bridging_alert_label",    tooltipKey: "dirk_lib_bridging_alert_tooltip",    options: ["ox_lib", "dirk_lib"] },
      { key: "inputDialog", labelKey: "dirk_lib_bridging_input_label",    tooltipKey: "dirk_lib_bridging_input_tooltip",    options: ["ox_lib", "dirk_lib"] },
    ],
  },
  {
    labelKey: "dirk_lib_bridging_group_framework",
    fields: [
      { key: "framework", labelKey: "dirk_lib_bridging_framework_label", tooltipKey: "dirk_lib_bridging_framework_tooltip", options: withAuto(["es_extended", "qbx_core", "qb-core", "nd-framework"]) },
    ],
  },
  {
    labelKey: "dirk_lib_bridging_group_inventory",
    fields: [
      { key: "inventory", labelKey: "dirk_lib_bridging_inventory_label", tooltipKey: "dirk_lib_bridging_inventory_tooltip", options: withAuto(["dirk_inventory", "ox_inventory", "qb-inventory", "qs-inventory", "codem-inventory", "tgiann-inventory", "mf-inventory", "core_inventory", "ak47_inventory"]) },
      { key: "target",    labelKey: "dirk_lib_bridging_target_label",    tooltipKey: "dirk_lib_bridging_target_tooltip",    options: withAuto(["ox_target", "qb-target", "q-target", "bt-target"]) },
      { key: "interact",  labelKey: "dirk_lib_bridging_interact_label",  tooltipKey: "dirk_lib_bridging_interact_tooltip",  options: withAuto(["redm-uiprompt", "sleepless_interact", "interact"]) },
    ],
  },
  {
    labelKey: "dirk_lib_bridging_group_vehicles",
    fields: [
      { key: "keys",   labelKey: "dirk_lib_bridging_keys_label",   tooltipKey: "dirk_lib_bridging_keys_tooltip",   options: withAuto(["cd_garage", "MrNewbVehicleKeys", "t1ger_keys", "okokGarage", "qb-vehiclekeys", "qbx_vehiclekeys", "qs-vehiclekeys", "Renewed-Vehiclekeys", "vehicles_keys", "wasabi_carlock", "ludaro-keys"]) },
      { key: "fuel",   labelKey: "dirk_lib_bridging_fuel_label",   tooltipKey: "dirk_lib_bridging_fuel_tooltip",   options: withAuto(["cdn-fuel", "LegacyFuel", "ox_fuel", "ps-fuel", "Renewed-Fuel", "ti_fuel", "x-fuel", "wasabi_fuel", "okokGasStation"]) },
      { key: "garage", labelKey: "dirk_lib_bridging_garage_label", tooltipKey: "dirk_lib_bridging_garage_tooltip", options: withAuto(["qb-garages", "wasabi_garage", "renewed-garage"]) },
    ],
  },
  {
    labelKey: "dirk_lib_bridging_group_world",
    fields: [
      { key: "time",     labelKey: "dirk_lib_bridging_time_label",     tooltipKey: "dirk_lib_bridging_time_tooltip",     options: withAuto(["av_weather", "cd_easytime", "qb-weathersync", "Renewed-Weathersync", "vSync", "wasabi_wheather"]) },
      { key: "doorlock", labelKey: "dirk_lib_bridging_doorlock_label", tooltipKey: "dirk_lib_bridging_doorlock_tooltip", options: withAuto(["ox_doorlock", "qb-doorlock", "nui_doorlock", "doors_creator"]) },
      { key: "housing",  labelKey: "dirk_lib_bridging_housing_label",  tooltipKey: "dirk_lib_bridging_housing_tooltip",  options: withAuto(["qs-housing", "rtx_housing", "bcs_housing", "origen_housing"]) },
    ],
  },
  {
    labelKey: "dirk_lib_bridging_group_player",
    fields: [
      { key: "phone",     labelKey: "dirk_lib_bridging_phone_label",     tooltipKey: "dirk_lib_bridging_phone_tooltip",     options: withAuto(["lb-phone", "qb-phone", "gksphone", "high-phone", "npwd"]) },
      { key: "clothing",  labelKey: "dirk_lib_bridging_clothing_label",  tooltipKey: "dirk_lib_bridging_clothing_tooltip",  options: withAuto(["esx_skin", "qb-clothing", "rcore_clothing", "illenium-appearance", "fivem-appearance", "dirk_charCreator", "tgiann-clothing"]) },
      { key: "skills",    labelKey: "dirk_lib_bridging_skills_label",    tooltipKey: "dirk_lib_bridging_skills_tooltip",    options: withAuto(["sd_skills", "evolent_skills", "core_skills", "B1-skillz", "skill_system_v1.5", "skillsystem_v3", "boii_skills", "skillsystem_v2", "ot_skill_system"]) },
      { key: "ambulance", labelKey: "dirk_lib_bridging_ambulance_label", tooltipKey: "dirk_lib_bridging_ambulance_tooltip", options: withAuto(["qb-ambulancejob", "wasabi_ambulance", "core_ambulance"]) },
      { key: "prison",    labelKey: "dirk_lib_bridging_prison_label",    tooltipKey: "dirk_lib_bridging_prison_tooltip",    options: withAuto(["qb-prison", "rcore_prison", "wasabi_jail"]) },
      { key: "dispatch",  labelKey: "dirk_lib_bridging_dispatch_label",  tooltipKey: "dirk_lib_bridging_dispatch_tooltip",  options: withAuto(["bub_mdt", "cd_dispatch", "linden_outlawalert", "qs_dispatch", "ps-dispatch", "tk_dispatch"]) },
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
      <AdminPageTitle icon={Plug} title={locale("dirk_lib_bridging_title")} color={color} />

      {GROUPS.map((group) => (
        <div key={group.labelKey}>
          <GroupLabel label={locale(group.labelKey)} />
          <Flex direction="column" gap="xs">
            {group.fields.map((field) => (
              <Select
                key={field.key as string}
                label={<InfoLabel label={locale(field.labelKey)} tooltip={locale(field.tooltipKey)} />}
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
