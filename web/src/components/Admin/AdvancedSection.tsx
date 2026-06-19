import { Flex, Select, Text, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { Wrench } from "lucide-react";
import type { AdvancedSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

const IDENTIFIER_OPTIONS = ["license", "license2", "steam", "discord", "fivem", "ip"].map((v) => ({ value: v, label: v }));

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

export default function AdvancedSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("advanced") as AdvancedSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.advanced);
  const config = (formConfig ?? storeConfig) as AdvancedSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof AdvancedSettings>(key: K, val: AdvancedSettings[K]) =>
    setValue("advanced", { ...config, [key]: val });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Wrench} title={locale("dirk_lib_advanced_title")} color={color} />

      <GroupLabel label={locale("dirk_lib_advanced_id_group")} />
      <Select
        label={<InfoLabel label={locale("dirk_lib_advanced_primary_label")} tooltip={locale("dirk_lib_advanced_primary_tooltip")} />}
        size="xs"
        value={config.primaryIdentifier}
        data={IDENTIFIER_OPTIONS}
        allowDeselect={false}
        onChange={(v) => v && set("primaryIdentifier", v)}
      />
    </Flex>
  );
}
