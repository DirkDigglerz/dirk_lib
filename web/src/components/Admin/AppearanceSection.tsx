import { ActionIcon, ColorInput, Flex, NumberInput, Popover, Select, Switch, Text, TextInput, useMantineTheme } from "@mantine/core";
import { generateColors } from "@mantine/colors-generator";
import { AdminPageTitle, useFormActions, useFormField } from "dirk-cfx-react";
import { Palette, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { AppearanceSettings, ScriptConfig } from "../../stores/useScriptConfig";
import { defaultScriptConfig, useScriptConfig } from "../../stores/useScriptConfig";
import { InfoLabel } from "./InfoLabel";

const MANTINE_COLOR_OPTIONS = [
  "dirk",
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
].map((value) => ({ value, label: value }));

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

export default function AppearanceSection() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const formConfig = useFormField<ScriptConfig>("appearance") as AppearanceSettings | undefined;
  const storeConfig = useScriptConfig((s) => s.appearance);
  const config = (formConfig ?? storeConfig) as AppearanceSettings;
  const { setValue } = useFormActions<ScriptConfig>();

  const set = <K extends keyof AppearanceSettings>(key: K, val: AppearanceSettings[K]) =>
    setValue("appearance", { ...config, [key]: val });

  const useCustom = config.primaryColor === "custom";

  const setSwatch = (index: number, value: string) => {
    const next = [...config.customTheme];
    next[index] = value;
    set("customTheme", next);
  };

  const generateFromBase = (hex: string) => {
    try {
      const generated = generateColors(hex);
      set("customTheme", generated as unknown as string[]);
    } catch {
      // invalid color — ignore
    }
  };

  const resetPalette = () => set("customTheme", defaultScriptConfig.appearance.customTheme);

  return (
    <Flex direction="column" gap="xs" p="sm" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <AdminPageTitle icon={Palette} title="Appearance" color={color} />

      <GroupLabel label="Branding" />
      <Flex gap="xs">
        <TextInput
          label="Server Name"
          size="xs"
          style={{ flex: 1 }}
          value={config.serverName}
          onChange={(e) => set("serverName", e.currentTarget.value)}
        />
        <TextInput
          label="Logo URL"
          size="xs"
          style={{ flex: 2 }}
          value={config.logo}
          onChange={(e) => set("logo", e.currentTarget.value)}
        />
      </Flex>

      <GroupLabel label="Primary Color" />

      <Switch
        label="Use Custom Palette"
        size="md"
        checked={useCustom}
        onChange={(e) => set("primaryColor", e.currentTarget.checked ? "custom" : "dirk")}
        styles={{ label: { fontFamily: "Akrobat Bold", fontSize: "0.65em", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" } }}
      />

      <Flex gap="xs">
        {!useCustom && (
          <Select
            label="Palette"
            size="xs"
            style={{ flex: 1 }}
            value={config.primaryColor}
            data={MANTINE_COLOR_OPTIONS}
            allowDeselect={false}
            onChange={(v) => v && set("primaryColor", v)}
          />
        )}
        <NumberInput
          label={<InfoLabel label="Shade" tooltip="0 lightest, 9 darkest" />}
          size="xs"
          style={{ flex: 1 }}
          min={0}
          max={9}
          value={config.primaryShade}
          onChange={(v) => set("primaryShade", Number(v))}
        />
      </Flex>

      {useCustom && (
        <>
          <Flex align="center" justify="space-between" mt="xxs">
            <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c="rgba(255,255,255,0.2)">
              Custom Palette
            </Text>
            <ActionIcon size="sm" variant="subtle" onClick={resetPalette} title="Reset to defaults">
              <RotateCcw size="1.4vh" />
            </ActionIcon>
          </Flex>

          <ColorInput
            label={<InfoLabel label="Base Color" tooltip="Generates the full 10-shade palette. Click any shade below to fine-tune." />}
            size="xs"
            value={config.customTheme[config.primaryShade] ?? config.customTheme[5] ?? "#000000"}
            onChange={generateFromBase}
            eyeDropperIcon={<></>}
          />

          <Flex gap="xxs" mt="xxs">
            {config.customTheme.map((swatch, i) => (
              <SwatchTile
                key={i}
                index={i}
                value={swatch}
                isPrimary={i === config.primaryShade}
                onChange={(v) => setSwatch(i, v)}
              />
            ))}
          </Flex>
        </>
      )}
    </Flex>
  );
}

function SwatchTile({
  index, value, isPrimary, onChange,
}: {
  index: number;
  value: string;
  isPrimary: boolean;
  onChange: (v: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow zIndex={10000}>
      <Popover.Target>
        <button
          onClick={() => setOpened((o) => !o)}
          title={`Shade ${index}: ${value}`}
          style={{
            flex: 1,
            aspectRatio: "1 / 1",
            background: value,
            border: isPrimary
              ? "0.2vh solid rgba(255,255,255,0.85)"
              : "0.1vh solid rgba(255,255,255,0.15)",
            borderRadius: "0.4vh",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            position: "relative",
          }}
        >
          <span
            style={{
              fontFamily: "Akrobat Bold",
              fontSize: "0.9vh",
              lineHeight: 1,
              padding: "0.2vh 0.3vh",
              color: "rgba(0,0,0,0.55)",
              background: "rgba(255,255,255,0.55)",
              borderRadius: "0.25vh",
              margin: "0.2vh",
            }}
          >
            {index}
          </span>
        </button>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <ColorInput
          size="xs"
          value={value}
          onChange={onChange}
          format="hex"
          eyeDropperIcon={<></>}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
