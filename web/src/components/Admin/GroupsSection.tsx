import { Flex, NumberInput, Text, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { Users } from "lucide-react";
import type { GroupsSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

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

export default function GroupsSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("groups") as GroupsSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.groups);
  const config = (formConfig ?? storeConfig) as GroupsSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof GroupsSettings>(key: K, val: GroupsSettings[K]) =>
    setValue("groups", { ...config, [key]: val });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Users} title={locale("dirk_lib_groups_title")} color={color} />

      <GroupLabel label={locale("dirk_lib_groups_membership_group")} />
      <NumberInput
        label={<InfoLabel label={locale("dirk_lib_groups_max_label")} tooltip={locale("dirk_lib_groups_max_tooltip")} />}
        size="xs"
        min={1}
        max={50}
        value={config.maxMembers}
        onChange={(v) => set("maxMembers", Number(v))}
      />

      <GroupLabel label={locale("dirk_lib_groups_invites_group")} />
      <NumberInput
        label={<InfoLabel label={locale("dirk_lib_groups_dist_label")} tooltip={locale("dirk_lib_groups_dist_tooltip")} />}
        size="xs"
        min={1}
        max={100}
        value={config.maxDistanceInvite}
        onChange={(v) => set("maxDistanceInvite", Number(v))}
      />
      <NumberInput
        label={<InfoLabel label={locale("dirk_lib_groups_valid_label")} tooltip={locale("dirk_lib_groups_valid_tooltip")} />}
        size="xs"
        min={1}
        max={60}
        value={config.inviteValidTime}
        onChange={(v) => set("inviteValidTime", Number(v))}
      />

      <GroupLabel label={locale("dirk_lib_groups_lifecycle_group")} />
      <NumberInput
        label={<InfoLabel label={locale("dirk_lib_groups_logoff_label")} tooltip={locale("dirk_lib_groups_logoff_tooltip")} />}
        size="xs"
        min={1}
        max={60}
        value={config.maxLogOffTime}
        onChange={(v) => set("maxLogOffTime", Number(v))}
      />
    </Flex>
  );
}
