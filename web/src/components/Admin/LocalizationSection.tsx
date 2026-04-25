import { Flex, Select, Text, TextInput, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, useFormActions, useFormField } from "dirk-cfx-react";
import { Languages } from "lucide-react";
import type { LocalizationSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English (en)" },
  { value: "es", label: "Español (es)" },
  { value: "fr", label: "Français (fr)" },
  { value: "de", label: "Deutsch (de)" },
  { value: "pt", label: "Português (pt)" },
  { value: "nl", label: "Nederlands (nl)" },
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

export default function LocalizationSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("localization") as LocalizationSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.localization);
  const config = (formConfig ?? storeConfig) as LocalizationSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof LocalizationSettings>(key: K, val: LocalizationSettings[K]) =>
    setValue("localization", { ...config, [key]: val });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Languages} title="Localization" color={color} />

      <GroupLabel label="Strings" />
      <Select
        label={<InfoLabel label="Language" tooltip="Locale code used when resolving /locales strings" />}
        size="xs"
        value={config.language}
        data={LANGUAGE_OPTIONS}
        allowDeselect={false}
        searchable
        onChange={(v) => v && set("language", v)}
      />

      <GroupLabel label="Currency" />
      <TextInput
        label={<InfoLabel label="Symbol" tooltip="Prefix used when rendering money values" />}
        size="xs"
        value={config.currency}
        onChange={(e) => set("currency", e.currentTarget.value)}
      />
    </Flex>
  );
}
