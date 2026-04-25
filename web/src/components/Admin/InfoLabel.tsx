import { alpha, Flex, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { Info } from "lucide-react";

export function InfoLabel({ label, tooltip }: { label: string; tooltip: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  return (
    <Flex align="center" style={{ width: "100%" }}>
      <Text
        component="span"
        style={{
          fontSize: "var(--mantine-font-size-xs)",
          fontFamily: "Akrobat Bold",
          letterSpacing: "0.05em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </Text>
      <Tooltip
        label={tooltip}
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
        <Flex
          align="center"
          justify="center"
          style={{
            marginLeft: "auto",
            cursor: "help",
          }}
        >
          <Info size="1.6vh" color={alpha(color, 0.45)} />
        </Flex>
      </Tooltip>
    </Flex>
  );
}
