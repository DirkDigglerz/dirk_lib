import { Box, Flex, Loader, PasswordInput, Text, TextInput, alpha, useMantineTheme } from "@mantine/core";
import { AdminPageTitle, fetchNui, locale, useFormActions, useFormField } from "dirk-cfx-react";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Eye, EyeOff, MessageCircle, PlugZap, XCircle } from "lucide-react";
import { useState } from "react";
import type { DiscordSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

type DiagnoseCheck = {
  id: string;
  ok: boolean;
  message: string;
};

type DiagnoseResult = {
  ok: boolean;
  bot?: { id?: string; username?: string };
  guild?: { id?: string; name?: string };
  checks: DiagnoseCheck[];
};

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

function CheckRow({ check, okColor }: { check: DiagnoseCheck; okColor: string }) {
  const color = check.ok ? okColor : "#ef4444";
  const Icon = check.ok ? CheckCircle2 : XCircle;
  const labelKey = `dirk_lib_discord_check_${check.id}`;
  const label = locale(labelKey);
  return (
    <Flex align="flex-start" gap="xs" py="xxs">
      <Icon size="1.6vh" color={color} style={{ flexShrink: 0, marginTop: "0.15vh" }} />
      <Flex direction="column" gap="0" style={{ flex: 1 }}>
        <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)" tt="uppercase" lts="0.05em">
          {label !== labelKey ? label : check.id}
        </Text>
        <Text ff="Akrobat" size="xxs" c={alpha(color, 0.85)}>
          {check.message}
        </Text>
      </Flex>
    </Flex>
  );
}

function GuideStep({ index, title, body, link }: { index: number; title: string; body: string; link?: { href: string; label: string } }) {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];
  return (
    <Flex gap="xs" align="flex-start">
      <Flex
        align="center" justify="center"
        style={{
          flexShrink: 0,
          width: "2vh", height: "2vh",
          borderRadius: "50%",
          background: alpha(pc[6], 0.15),
          border: `0.1vh solid ${alpha(pc[6], 0.35)}`,
        }}
      >
        <Text ff="Akrobat Bold" size="xxs" c={pc[6]}>{index}</Text>
      </Flex>
      <Flex direction="column" gap="0" style={{ flex: 1 }}>
        <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)" tt="uppercase" lts="0.05em">
          {title}
        </Text>
        <Text ff="Akrobat" size="xxs" c="rgba(255,255,255,0.55)">
          {body}
        </Text>
        {link && (
          <a
            href={link.href} target="_blank" rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4vh",
              marginTop: "0.4vh",
              color: pc[5],
              fontFamily: "Akrobat Bold",
              fontSize: "1.3vh",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
            }}
          >
            {link.label}
            <ExternalLink size="1.3vh" />
          </a>
        )}
      </Flex>
    </Flex>
  );
}

export default function DiscordSection() {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];
  const color = pc[5];
  const okColor = pc[5];

  const formConfig = useFormField<ScriptConfig>("discord") as DiscordSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.discord);
  const config = (formConfig ?? storeConfig) as DiscordSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof DiscordSettings>(key: K, val: DiscordSettings[K]) =>
    setValue("discord", { ...config, [key]: val });

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      // Forward in-flight form values so the diagnose tests what the admin
      // just typed, not the on-disk config. Without this, a fresh install
      // (or any unsaved edit) always reports "fields empty" even when the
      // user can clearly see them populated above.
      const data = await fetchNui<DiagnoseResult>(
        "DISCORD_DIAGNOSE",
        { botToken: config.botToken, guildId: config.guildId },
        {
          ok: false,
          checks: [{ id: "transport", ok: false, message: "Dev browser — fetchNui mocked" }],
        },
      );
      setResult(data);
    } finally {
      setTesting(false);
    }
  };

  const headerColor = result ? (result.ok ? okColor : "#ef4444") : "rgba(255,255,255,0.5)";
  const HeaderIcon = result ? (result.ok ? CheckCircle2 : XCircle) : PlugZap;

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={MessageCircle} title={locale("dirk_lib_discord_title")} color={color} />

      <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.45)">
        {locale("dirk_lib_discord_intro")}
      </Text>

      <GroupLabel label={locale("dirk_lib_discord_credentials_group")} />
      <PasswordInput
        label={<InfoLabel label={locale("dirk_lib_discord_token_label")} tooltip={locale("dirk_lib_discord_token_tooltip")} />}
        size="xs"
        value={config.botToken}
        onChange={(e) => set("botToken", e.currentTarget.value)}
        placeholder="Bot Token"
        visibilityToggleIcon={({ reveal }) =>
          reveal ? <EyeOff size="2vh" color="rgba(255,255,255,0.7)" /> : <Eye size="2vh" color="rgba(255,255,255,0.7)" />
        }
        styles={{ visibilityToggle: { marginRight: "0.6vh" } }}
      />
      <TextInput
        label={<InfoLabel label={locale("dirk_lib_discord_guild_label")} tooltip={locale("dirk_lib_discord_guild_tooltip")} />}
        size="xs"
        value={config.guildId}
        onChange={(e) => set("guildId", e.currentTarget.value)}
        placeholder="000000000000000000"
      />

      <GroupLabel label={locale("dirk_lib_discord_test_group")} />
      <motion.button
        onClick={runTest}
        disabled={testing}
        whileHover={!testing ? { background: alpha(pc[6], 0.18) } : undefined}
        whileTap={!testing ? { scale: 0.97 } : undefined}
        style={{
          background: alpha(pc[6], 0.08),
          border: `0.1vh dashed ${alpha(pc[6], 0.3)}`,
          borderRadius: theme.radius.xs,
          padding: theme.spacing.xs,
          cursor: testing ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.6vh",
          opacity: testing ? 0.7 : 1,
        }}
      >
        {testing ? <Loader size="1.3vh" color={pc[6]} /> : <PlugZap size="1.4vh" color={pc[6]} />}
        <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.07em" c={pc[6]}>
          {testing ? locale("dirk_lib_discord_test_running") : locale("dirk_lib_discord_test_button")}
        </Text>
      </motion.button>

      {result && (
        <Box
          p="xs"
          style={{
            background: alpha(theme.colors.dark[5], 0.45),
            border: `0.1vh solid ${alpha(headerColor, 0.25)}`,
            borderLeft: `0.2vh solid ${headerColor}`,
            borderRadius: theme.radius.xs,
          }}
        >
          <Flex align="center" gap="xs" mb="xxs">
            <HeaderIcon size="1.6vh" color={headerColor} />
            <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.05em" c={headerColor}>
              {result.ok ? locale("dirk_lib_discord_result_ok") : locale("dirk_lib_discord_result_fail")}
            </Text>
            {result.bot?.username && (
              <Text ff="Akrobat" size="xxs" c="rgba(255,255,255,0.4)" style={{ marginLeft: "auto" }}>
                {result.bot.username}{result.guild?.name ? ` → ${result.guild.name}` : ""}
              </Text>
            )}
          </Flex>
          {result.checks.map((c) => (
            <CheckRow key={c.id} check={c} okColor={okColor} />
          ))}
        </Box>
      )}

      <GroupLabel label={locale("dirk_lib_discord_guide_group")} />
      <Flex direction="column" gap="xs" p="sm" style={{ background: alpha(theme.colors.dark[5], 0.25), borderRadius: theme.radius.xs }}>
        <GuideStep
          index={1}
          title={locale("dirk_lib_discord_guide_step1_title")}
          body={locale("dirk_lib_discord_guide_step1_body")}
          link={{ href: "https://discord.com/developers/applications", label: locale("dirk_lib_discord_guide_step1_link") }}
        />
        <GuideStep
          index={2}
          title={locale("dirk_lib_discord_guide_step2_title")}
          body={locale("dirk_lib_discord_guide_step2_body")}
        />
        <GuideStep
          index={3}
          title={locale("dirk_lib_discord_guide_step3_title")}
          body={locale("dirk_lib_discord_guide_step3_body")}
        />
        <GuideStep
          index={4}
          title={locale("dirk_lib_discord_guide_step4_title")}
          body={locale("dirk_lib_discord_guide_step4_body")}
        />
        <GuideStep
          index={5}
          title={locale("dirk_lib_discord_guide_step5_title")}
          body={locale("dirk_lib_discord_guide_step5_body")}
        />
        <GuideStep
          index={6}
          title={locale("dirk_lib_discord_guide_step6_title")}
          body={locale("dirk_lib_discord_guide_step6_body")}
        />
      </Flex>
    </Flex>
  );
}
