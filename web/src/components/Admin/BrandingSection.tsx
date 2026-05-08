import { Flex, Text, TextInput, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, locale, useFormActions, useFormField } from "dirk-cfx-react";
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
      <AdminPageTitle icon={Tag} title={locale("dirk_lib_branding_title")} color={color} />

      <GroupLabel label={locale("dirk_lib_branding_identity_group")} />
      <TextInput
        label={<InfoLabel label={locale("dirk_lib_branding_name_label")} tooltip={locale("dirk_lib_branding_name_tooltip")} />}
        size="xs"
        value={config.serverName}
        onChange={(e) => set("serverName", e.currentTarget.value)}
      />
      <TextInput
        label={<InfoLabel label={locale("dirk_lib_branding_logo_label")} tooltip={locale("dirk_lib_branding_logo_tooltip")} />}
        size="xs"
        value={config.logo}
        onChange={(e) => set("logo", e.currentTarget.value)}
      />

      <GroupLabel label={locale("dirk_lib_branding_assets_group")} />
      <TextInput
        label={<InfoLabel label={locale("dirk_lib_branding_imgpath_label")} tooltip={locale("dirk_lib_branding_imgpath_tooltip")} />}
        size="xs"
        value={config.itemImgPath}
        onChange={(e) => set("itemImgPath", e.currentTarget.value)}
      />
    </Flex>
  );
}
