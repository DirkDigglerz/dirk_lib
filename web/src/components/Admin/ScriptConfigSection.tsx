// Script Config tab — manages access overrides for /dirk_config.
//
// Access model:
//   - Master group is the convar `dirk_lib_master_group` (defaults to
//     group.admin). It's the floor and can never be removed; this UI just
//     surfaces the current value as a read-only banner.
//   - `scriptConfig.overrides` (array) grants ADDITIONAL access per-resource:
//     either a list of ACE permission strings (group.mod, custom aces) and/or
//     specific player identifiers (license:..., steam:...). Either match
//     grants edit access in addition to the master.
//   - dirk_lib's own scriptConfig is master-only by hard rule (server-side
//     guard) — cannot be added to overrides as a sanity net.

import { alpha, Flex, Select, TagsInput, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, fetchNui, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { motion } from "framer-motion";
import { Info, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ScriptConfig, ScriptConfigOverride, ScriptConfigSettings } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

function GroupLabel({ label, rightSection }: { label: string; rightSection?: React.ReactNode }) {
  return (
    <Flex align="center" gap="xs" mt="xxs">
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c="rgba(255,255,255,0.2)">
        {label}
      </Text>
      <div style={{ flex: 1, height: "0.05vh", background: "rgba(255,255,255,0.06)" }} />
      {rightSection}
    </Flex>
  );
}

// Standalone Info-icon tooltip — same look as InfoLabel's right side, but
// renderable on its own (banner row, GroupLabel rightSection, etc.). Keeps
// every "hover for more" cue in this file consistent.
function InfoTooltip({ label }: { label: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  return (
    <Tooltip
      label={label}
      position="top-end"
      withArrow
      multiline
      maw="22vh"
      styles={{
        tooltip: {
          background: alpha(theme.colors.dark[7], 0.95),
          border: `0.1vh solid rgba(255,255,255,0.1)`,
          color: "rgba(255,255,255,0.75)",
          fontFamily: "Akrobat Bold",
          fontSize: "1.3vh",
          lineHeight: 1.3,
          padding: "0.6vh 0.8vh",
          letterSpacing: "0.03em",
        },
      }}
    >
      <Flex align="center" justify="center" style={{ cursor: "help" }}>
        <Info size="1.6vh" color={alpha(color, 0.45)} />
      </Flex>
    </Tooltip>
  );
}

type RegisteredResource = { resource: string; label?: string; version?: string };
type OnlinePlayer = { id: number; name: string; identifiers: string[] };

const BLANK_OVERRIDE: ScriptConfigOverride = {
  resource: "",
  groups: [],
  identifiers: [],
};

export default function ScriptConfigSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("scriptConfig") as ScriptConfigSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.scriptConfig);
  const config = (formConfig ?? storeConfig) as ScriptConfigSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const overrides = config?.overrides ?? [];

  const [masterGroup, setMasterGroup] = useState<string>("admin");
  const [resources, setResources] = useState<RegisteredResource[]>([]);
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);

  // Fetch the contextual data once on mount. None of these change often
  // enough to bother re-polling — re-open the panel to refresh.
  useEffect(() => {
    fetchNui<{ group: string }>("GET_SCRIPT_CONFIG_MASTER_GROUP", {}, { group: "admin" })
      .then((d) => d?.group && setMasterGroup(d.group))
      .catch(() => {});
    fetchNui<RegisteredResource[]>("GET_SCRIPT_CONFIG_RESOURCES", {}, [])
      .then((d) => Array.isArray(d) && setResources(d))
      .catch(() => {});
    fetchNui<OnlinePlayer[]>("GET_SCRIPT_CONFIG_ONLINE_PLAYERS", {}, [])
      .then((d) => Array.isArray(d) && setPlayers(d))
      .catch(() => {});
  }, []);

  const setRow = (i: number, patch: Partial<ScriptConfigOverride>) => {
    const next = overrides.map((o, j) => (j === i ? { ...o, ...patch } : o));
    setValue("scriptConfig", { ...config, overrides: next });
  };
  const removeRow = (i: number) => {
    setValue("scriptConfig", { ...config, overrides: overrides.filter((_, j) => j !== i) });
  };
  const addRow = () => {
    setValue("scriptConfig", { ...config, overrides: [...overrides, { ...BLANK_OVERRIDE }] });
  };

  // Resource dropdown shows registered configs minus dirk_lib (master-only by
  // hard rule) and minus resources already in another override (one entry
  // per resource — collapse all access into a single row).
  const usedResources = new Set(overrides.map((o) => o.resource).filter(Boolean));
  const resourceOptions = (currentResource: string) =>
    resources
      .filter((r) => r.resource !== "dirk_lib")
      .filter((r) => r.resource === currentResource || !usedResources.has(r.resource))
      .map((r) => ({ value: r.resource, label: r.resource }));

  // Identifier dropdown shows the primary identifier per online player
  // (license: prefixed if available, otherwise the first identifier the
  // server has on file). The TagsInput accepts the `value`, the label is
  // `Player Name (license:...)`.
  const identifierOptions = players.flatMap((p) => {
    const primary = p.identifiers.find((id) => id.startsWith("license:")) || p.identifiers[0];
    if (!primary) return [];
    return [{ value: primary, label: `${p.name} (${primary})` }];
  });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={ShieldCheck} title={locale("script_config_section_title")} color={color} />

      {/* Master group banner — read-only, sourced from server convar */}
      <Flex
        align="center"
        gap="xs"
        p="xs"
        style={{
          background: alpha(color, 0.08),
          border: `0.1vh solid ${alpha(color, 0.3)}`,
          borderRadius: theme.radius.xs,
        }}
      >
        <ShieldCheck size="1.6vh" color={color} />
        <Flex direction="column" gap="xxs" style={{ flex: 1 }}>
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c="rgba(255,255,255,0.5)">
            {locale("script_config_section_master_label")}
          </Text>
          <Text ff="monospace" size="xs" c="rgba(255,255,255,0.85)">
            {masterGroup}
          </Text>
        </Flex>
        <InfoTooltip label={locale("script_config_section_master_tooltip")} />
      </Flex>

      <GroupLabel
        label={locale("script_config_section_overrides_label")}
        rightSection={<InfoTooltip label={locale("script_config_section_overrides_tooltip")} />}
      />

      {overrides.length === 0 && (
        <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.3)" tt="uppercase" lts="0.05em" ta="center" py="xs">
          {locale("script_config_section_no_overrides")}
        </Text>
      )}

      <Flex direction="column" gap="xs">
        {overrides.map((o, i) => (
          <Flex
            key={i}
            direction="column"
            gap="xs"
            p="xs"
            style={{
              background: alpha(theme.colors.dark[5], 0.35),
              border: `0.1vh solid rgba(255,255,255,0.05)`,
              borderRadius: theme.radius.xs,
            }}
          >
            <Select
              label={
                <InfoLabel
                  label={locale("script_config_section_resource_label")}
                  tooltip={locale("script_config_section_resource_tooltip")}
                />
              }
              size="xs"
              data={resourceOptions(o.resource)}
              value={o.resource || null}
              onChange={(v) => setRow(i, { resource: v ?? "" })}
              placeholder={locale("script_config_section_resource_placeholder")}
              searchable
              comboboxProps={{ withinPortal: true, zIndex: 2000 }}
              styles={{ label: { width: "100%" } }}
            />

            <TagsInput
              label={
                <InfoLabel
                  label={locale("script_config_section_groups_label")}
                  tooltip={locale("script_config_section_groups_tooltip")}
                />
              }
              size="xs"
              value={o.groups}
              onChange={(v) => setRow(i, { groups: v })}
              placeholder={locale("script_config_section_groups_placeholder")}
              comboboxProps={{ withinPortal: true, zIndex: 2000 }}
              styles={{ label: { width: "100%" } }}
            />

            <TagsInput
              label={
                <InfoLabel
                  label={locale("script_config_section_identifiers_label")}
                  tooltip={locale("script_config_section_identifiers_tooltip")}
                />
              }
              size="xs"
              data={identifierOptions}
              value={o.identifiers}
              onChange={(v) => setRow(i, { identifiers: v })}
              placeholder={locale("script_config_section_identifiers_placeholder")}
              comboboxProps={{ withinPortal: true, zIndex: 2000 }}
              styles={{ label: { width: "100%" } }}
              maxDropdownHeight={240}
            />

            {/* Full-width Delete at the bottom of the card — keeps the
                row inputs uncluttered and makes the destructive action
                explicit rather than a small icon next to the resource
                input. */}
            <motion.button
              onClick={() => removeRow(i)}
              whileHover={{ background: alpha("#ef4444", 0.18) }}
              whileTap={{ scale: 0.97 }}
              style={{
                marginTop: theme.spacing.xxs,
                background: alpha("#ef4444", 0.08),
                border: `0.1vh solid ${alpha("#ef4444", 0.3)}`,
                borderRadius: theme.radius.xs,
                padding: theme.spacing.xs,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing.xxs,
              }}
              aria-label={locale("script_config_section_delete_aria")}
            >
              <Trash2 size={14} color="rgba(239,68,68,0.85)" />
              <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.06em" c="rgba(239,68,68,0.85)">
                {locale("script_config_section_delete")}
              </Text>
            </motion.button>
          </Flex>
        ))}
      </Flex>

      <motion.button
        onClick={addRow}
        whileHover={{ background: alpha(color, 0.15) }}
        whileTap={{ scale: 0.97 }}
        style={{
          background: alpha(color, 0.06),
          border: `0.1vh dashed ${alpha(color, 0.3)}`,
          borderRadius: theme.radius.xs,
          padding: theme.spacing.xs,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.xxs,
          marginTop: theme.spacing.xxs,
        }}
      >
        <Plus size={14} color={color} />
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={color}>
          {locale("script_config_section_add_override")}
        </Text>
      </motion.button>
    </Flex>
  );
}
