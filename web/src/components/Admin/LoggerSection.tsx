import { Flex, PasswordInput, Select, Text, TextInput, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { Eye, EyeOff, ScrollText } from "lucide-react";
import type { LoggerService, LoggerSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

const SERVICE_OPTIONS: { value: LoggerService; label: string }[] = [
  { value: "off",        label: "Off (Discord webhooks only)" },
  { value: "datadog",    label: "Datadog" },
  { value: "loki",       label: "Grafana Loki" },
  { value: "fivemanage", label: "Fivemanage" },
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

// Shared visibility-toggle icon, mirroring DiscordSection's PasswordInput so
// every secret field looks/behaves the same across the panel.
const visibilityToggleIcon = ({ reveal }: { reveal: boolean }) =>
  reveal ? <EyeOff size="2vh" color="rgba(255,255,255,0.7)" /> : <Eye size="2vh" color="rgba(255,255,255,0.7)" />;
const visibilityToggleStyles = { visibilityToggle: { marginRight: "0.6vh" } } as const;

export default function LoggerSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("logger") as LoggerSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.logger);
  const config = (formConfig ?? storeConfig) as LoggerSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof LoggerSettings>(key: K, val: LoggerSettings[K]) =>
    setValue("logger", { ...config, [key]: val });

  const setLoki = <K extends keyof LoggerSettings["loki"]>(key: K, val: LoggerSettings["loki"][K]) =>
    setValue("logger", { ...config, loki: { ...config.loki, [key]: val } });

  const setDatadog = <K extends keyof LoggerSettings["datadog"]>(key: K, val: LoggerSettings["datadog"][K]) =>
    setValue("logger", { ...config, datadog: { ...config.datadog, [key]: val } });

  const setFivemanage = <K extends keyof LoggerSettings["fivemanage"]>(key: K, val: LoggerSettings["fivemanage"][K]) =>
    setValue("logger", { ...config, fivemanage: { ...config.fivemanage, [key]: val } });

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={ScrollText} title={locale("dirk_lib_logger_title")} color={color} />

      <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.45)">
        {locale("dirk_lib_logger_intro")}
      </Text>

      <GroupLabel label={locale("dirk_lib_logger_backend_group")} />
      <Select
        label={<InfoLabel label={locale("dirk_lib_logger_service_label")} tooltip={locale("dirk_lib_logger_service_tooltip")} />}
        size="xs"
        value={config.service}
        data={SERVICE_OPTIONS}
        allowDeselect={false}
        onChange={(v) => v && set("service", v as LoggerService)}
      />

      {config.service !== "off" && (
        <TextInput
          label={<InfoLabel label={locale("dirk_lib_logger_hostname_label")} tooltip={locale("dirk_lib_logger_hostname_tooltip")} />}
          size="xs"
          value={config.hostname}
          onChange={(e) => set("hostname", e.currentTarget.value)}
          placeholder={locale("dirk_lib_logger_hostname_placeholder")}
        />
      )}

      {config.service === "datadog" && (
        <>
          <GroupLabel label={locale("dirk_lib_logger_datadog_group")} />
          <PasswordInput
            label={<InfoLabel label={locale("dirk_lib_logger_datadog_key_label")} tooltip={locale("dirk_lib_logger_datadog_key_tooltip")} />}
            size="xs"
            value={config.datadog.apiKey}
            onChange={(e) => setDatadog("apiKey", e.currentTarget.value)}
            placeholder="API Key"
            visibilityToggleIcon={visibilityToggleIcon}
            styles={visibilityToggleStyles}
          />
          <TextInput
            label={<InfoLabel label={locale("dirk_lib_logger_datadog_site_label")} tooltip={locale("dirk_lib_logger_datadog_site_tooltip")} />}
            size="xs"
            value={config.datadog.site}
            onChange={(e) => setDatadog("site", e.currentTarget.value)}
            placeholder="datadoghq.com"
          />
        </>
      )}

      {config.service === "loki" && (
        <>
          <GroupLabel label={locale("dirk_lib_logger_loki_group")} />
          <TextInput
            label={<InfoLabel label={locale("dirk_lib_logger_loki_endpoint_label")} tooltip={locale("dirk_lib_logger_loki_endpoint_tooltip")} />}
            size="xs"
            value={config.loki.endpoint}
            onChange={(e) => setLoki("endpoint", e.currentTarget.value)}
            placeholder="logs-prod.grafana.net"
          />
          <TextInput
            label={<InfoLabel label={locale("dirk_lib_logger_loki_user_label")} tooltip={locale("dirk_lib_logger_loki_user_tooltip")} />}
            size="xs"
            value={config.loki.user}
            onChange={(e) => setLoki("user", e.currentTarget.value)}
            placeholder={locale("dirk_lib_logger_loki_user_placeholder")}
          />
          <PasswordInput
            label={<InfoLabel label={locale("dirk_lib_logger_loki_password_label")} tooltip={locale("dirk_lib_logger_loki_password_tooltip")} />}
            size="xs"
            value={config.loki.password}
            onChange={(e) => setLoki("password", e.currentTarget.value)}
            placeholder="Password / API Key"
            visibilityToggleIcon={visibilityToggleIcon}
            styles={visibilityToggleStyles}
          />
          <TextInput
            label={<InfoLabel label={locale("dirk_lib_logger_loki_tenant_label")} tooltip={locale("dirk_lib_logger_loki_tenant_tooltip")} />}
            size="xs"
            value={config.loki.tenant}
            onChange={(e) => setLoki("tenant", e.currentTarget.value)}
            placeholder={locale("dirk_lib_logger_loki_tenant_placeholder")}
          />
        </>
      )}

      {config.service === "fivemanage" && (
        <>
          <GroupLabel label={locale("dirk_lib_logger_fivemanage_group")} />
          <PasswordInput
            label={<InfoLabel label={locale("dirk_lib_logger_fivemanage_key_label")} tooltip={locale("dirk_lib_logger_fivemanage_key_tooltip")} />}
            size="xs"
            value={config.fivemanage.apiKey}
            onChange={(e) => setFivemanage("apiKey", e.currentTarget.value)}
            placeholder="API Key"
            visibilityToggleIcon={visibilityToggleIcon}
            styles={visibilityToggleStyles}
          />
        </>
      )}
    </Flex>
  );
}
