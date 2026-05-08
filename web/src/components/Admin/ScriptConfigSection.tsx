// Script Config tab — manages access overrides for /dirk_config.
//
// Access model:
//   - Master group is the convar `dirk_lib_master_group` (defaults to
//     'admin'). It's the floor and can never be removed; this UI just
//     surfaces the current value as a read-only banner.
//   - `scriptConfig.overrides` (array) grants ADDITIONAL access per-resource:
//     ACE permission strings and/or specific player identifiers. Either match
//     grants edit access in addition to the master.
//   - dirk_lib's own scriptConfig is master-only by hard rule (server-side
//     guard) — cannot be added to overrides as a sanity net.
//
// Override list UI mirrors the druglabsv2 shells list pattern: a compact
// row per override (resource name + quick summary + pencil) and a modal
// for the full edit form. Avoids cramming three inputs onto every row.

import { alpha, Flex, Select, TagsInput, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, fetchNui, locale, Modal, useFormActions, useFormField } from "dirk-cfx-react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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

// Standalone Info-icon tooltip — same look as InfoLabel's right side.
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

// ── Override list row ──────────────────────────────────────────────────────

function OverrideRow({
  override,
  onEdit,
}: {
  override: ScriptConfigOverride;
  onEdit: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const groupCount = override.groups?.length ?? 0;
  const idCount = override.identifiers?.length ?? 0;
  const summary = [
    groupCount > 0 ? `${groupCount} ${groupCount === 1 ? "group" : "groups"}` : null,
    idCount > 0 ? `${idCount} ${idCount === 1 ? "player" : "players"}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || locale("script_config_section_no_grants") || "no grants";

  return (
    <Flex
      align="center"
      gap="xs"
      p="xs"
      onClick={onEdit}
      style={{
        background: alpha(theme.colors.dark[5], 0.35),
        border: `0.1vh solid rgba(255,255,255,0.05)`,
        borderLeft: `0.2vh solid ${alpha(color, 0.5)}`,
        borderRadius: theme.radius.xs,
        cursor: "pointer",
      }}
    >
      <Flex direction="column" gap="xxs" style={{ flex: 1, minWidth: 0 }}>
        <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)" lineClamp={1}>
          {override.resource || (locale("script_config_section_unset_resource") || "(no resource selected)")}
        </Text>
        <Text ff="Akrobat Bold" size="xxs" c="dimmed" lineClamp={1}>
          {summary}
        </Text>
      </Flex>
      <motion.button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        whileHover={{ background: alpha(color, 0.18) }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: "transparent",
          border: `0.1vh solid ${alpha(color, 0.3)}`,
          borderRadius: theme.radius.xs,
          padding: theme.spacing.xxs,
          cursor: "pointer",
          display: "flex",
          flexShrink: 0,
        }}
        aria-label={locale("script_config_section_edit_aria") || "Edit override"}
      >
        <Pencil size={14} color={alpha(color, 0.75)} />
      </motion.button>
    </Flex>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────

function OverrideEditModal({
  override,
  onChange,
  onDelete,
  onClose,
  resourceOptions,
  identifierOptions,
}: {
  override: ScriptConfigOverride;
  onChange: (next: Partial<ScriptConfigOverride>) => void;
  onDelete: () => void;
  onClose: () => void;
  resourceOptions: { value: string; label: string }[];
  identifierOptions: { value: string; label: string }[];
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Modal
      title={override.resource || (locale("script_config_section_modal_new") || "New Override")}
      onClose={onClose}
      width="60vh"
      maxHeight="70vh"
    >
      <Flex direction="column" gap="xs" p="sm" style={{ minHeight: 0, flex: 1 }}>
        <Flex direction="column" gap="xs" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <Select
            label={
              <InfoLabel
                label={locale("script_config_section_resource_label")}
                tooltip={locale("script_config_section_resource_tooltip")}
              />
            }
            size="xs"
            data={resourceOptions}
            value={override.resource || null}
            onChange={(v) => onChange({ resource: v ?? "" })}
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
            value={override.groups}
            onChange={(v) => onChange({ groups: v })}
            placeholder={locale("script_config_section_groups_placeholder")}
            comboboxProps={{ withinPortal: true, zIndex: 2000 }}
            styles={{ label: { width: "100%" } }}
          />

          {/* Identifiers TagsInput is free-form (no `data` prop) so the
              VALUE the user submits is exactly what gets stored — bare
              identifiers like `license:abc...`. The previous version used
              `data` with a formatted "Name (license:...)" label, which
              Mantine's TagsInput stored verbatim, breaking the
              GetPlayerIdentifiers comparison server-side. The online-player
              dropdown below the input lets the admin click a player to
              push their identifier into the tags list — gives the same
              "pick a player by name" UX without coupling display to
              storage. */}
          <TagsInput
            label={
              <InfoLabel
                label={locale("script_config_section_identifiers_label")}
                tooltip={locale("script_config_section_identifiers_tooltip")}
              />
            }
            size="xs"
            value={override.identifiers}
            onChange={(v) => onChange({ identifiers: v })}
            placeholder={locale("script_config_section_identifiers_placeholder")}
            comboboxProps={{ withinPortal: true, zIndex: 2000 }}
            styles={{ label: { width: "100%" } }}
          />

          {identifierOptions.length > 0 && (
            <Flex direction="column" gap="xxs">
              <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.4)" tt="uppercase" lts="0.06em">
                {locale("script_config_section_online_players_label") || "Online — click to add"}
              </Text>
              <Flex gap="xxs" wrap="wrap">
                {identifierOptions.map((p) => {
                  const already = override.identifiers.includes(p.value);
                  return (
                    <motion.button
                      key={p.value}
                      onClick={() => {
                        if (already) return;
                        onChange({ identifiers: [...override.identifiers, p.value] });
                      }}
                      whileHover={!already ? { background: alpha(color, 0.18) } : undefined}
                      whileTap={!already ? { scale: 0.95 } : undefined}
                      style={{
                        background: already ? alpha(color, 0.18) : alpha(color, 0.06),
                        border: `0.1vh solid ${alpha(color, already ? 0.5 : 0.25)}`,
                        borderRadius: theme.radius.xs,
                        padding: "0.3vh 0.7vh",
                        cursor: already ? "default" : "pointer",
                        opacity: already ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3vh",
                      }}
                      title={p.value}
                    >
                      <Text ff="Akrobat Bold" size="xxs" c={alpha(color, 0.85)}>
                        {p.label}
                      </Text>
                    </motion.button>
                  );
                })}
              </Flex>
            </Flex>
          )}
        </Flex>

        {/* Footer: Delete on the left, Done on the right. */}
        <Flex justify="space-between" gap="xs" pt="xs" style={{ flexShrink: 0 }}>
          <motion.button
            onClick={() => { onDelete(); onClose(); }}
            whileHover={{ background: alpha("#ef4444", 0.18) }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: alpha("#ef4444", 0.08),
              border: `0.1vh solid ${alpha("#ef4444", 0.3)}`,
              borderRadius: theme.radius.xs,
              padding: `${theme.spacing.xxs} ${theme.spacing.xs}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.xxs,
            }}
          >
            <Trash2 size={14} color="rgba(239,68,68,0.85)" />
            <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.06em" c="rgba(239,68,68,0.85)">
              {locale("script_config_section_delete")}
            </Text>
          </motion.button>

          <motion.button
            onClick={onClose}
            whileHover={{ background: alpha(color, 0.25) }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: alpha(color, 0.14),
              border: `0.1vh solid ${alpha(color, 0.4)}`,
              borderRadius: theme.radius.xs,
              padding: `${theme.spacing.xxs} ${theme.spacing.xs}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.xxs,
            }}
          >
            <Check color={color} />
            <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.05em" c={color}>
              {locale("script_config_section_done") || "Done"}
            </Text>
          </motion.button>
        </Flex>
      </Flex>
    </Modal>
  );
}

// ── Main section ───────────────────────────────────────────────────────────

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    const next = [...overrides, { ...BLANK_OVERRIDE }];
    setValue("scriptConfig", { ...config, overrides: next });
    // Open the modal at the newly-added row so the admin can fill it in.
    setEditingIndex(next.length - 1);
  };

  // Resource dropdown shows registered configs minus dirk_lib (master-only)
  // and minus resources already in another override row. The currently-being-
  // edited row's own resource is always allowed so the modal can re-display
  // its existing pick.
  const usedResources = new Set(overrides.map((o) => o.resource).filter(Boolean));
  const editingOverride = editingIndex != null ? overrides[editingIndex] : null;
  const resourceOptionsForEditing = resources
    .filter((r) => r.resource !== "dirk_lib")
    .filter((r) => r.resource === editingOverride?.resource || !usedResources.has(r.resource))
    .map((r) => ({ value: r.resource, label: r.resource }));

  // Online-player buttons. `value` is the bare identifier (what gets stored),
  // `label` is just the player name (button display) — keeping them
  // decoupled is what stops the previous "label baked into the stored
  // identifier" bug from recurring.
  const identifierOptions = players.flatMap((p) => {
    const primary = p.identifiers.find((id) => id.startsWith("license:")) || p.identifiers[0];
    if (!primary) return [];
    return [{ value: primary, label: p.name }];
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
          <OverrideRow
            key={i}
            override={o}
            onEdit={() => setEditingIndex(i)}
          />
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

      <AnimatePresence>
        {editingIndex != null && editingOverride && (
          <OverrideEditModal
            override={editingOverride}
            onChange={(patch) => setRow(editingIndex, patch)}
            onDelete={() => removeRow(editingIndex)}
            onClose={() => setEditingIndex(null)}
            resourceOptions={resourceOptionsForEditing}
            identifierOptions={identifierOptions}
          />
        )}
      </AnimatePresence>
    </Flex>
  );
}
