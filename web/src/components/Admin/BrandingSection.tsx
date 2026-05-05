import { Flex, Text, TextInput, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, useFormActions, useFormField } from "dirk-cfx-react";
import { Tag } from "lucide-react";
import type { BrandingSettings, ScriptConfig } from "../../stores/useScriptConfig";
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

export default function BrandingSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("branding") as BrandingSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.branding);
  const config = (formConfig ?? storeConfig) as BrandingSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof BrandingSettings>(key: K, val: BrandingSettings[K]) =>
    setValue("branding", { ...config, [key]: val });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Tag} title="Branding" color={color} />

      <GroupLabel label="Server Identity" />
      <TextInput
        label={<InfoLabel label="Server Name" tooltip="Displayed in NUIs that surface a server name" />}
        size="xs"
        value={config.serverName}
        onChange={(e) => set("serverName", e.currentTarget.value)}
      />
      <TextInput
        label={<InfoLabel label="Logo URL" tooltip="URL or nui:// path to the server logo shown in dirk_lib menus" />}
        size="xs"
        value={config.logo}
        onChange={(e) => set("logo", e.currentTarget.value)}
      />

      <GroupLabel label="Assets" />
      <TextInput
        label={<InfoLabel label="Item Image Path" tooltip="Inventory image path. 'auto' resolves from the detected inventory; override with a full nui://… or CDN URL." />}
        size="xs"
        value={config.itemImgPath}
        onChange={(e) => set("itemImgPath", e.currentTarget.value)}
      />
    </Flex>
  );
}
