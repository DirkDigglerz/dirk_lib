import { alpha, Flex, Text, useMantineTheme } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../utils/fetchNui";

interface AlertDialogData {
  header: string;
  content: string;
  centered?: boolean;
  cancel?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  labels?: {
    cancel?: string;
    confirm?: string;
  };
}

const SIZE_MAP: Record<string, string> = {
  xs: "28vh",
  sm: "34vh",
  md: "42vh",
  lg: "52vh",
  xl: "64vh",
};

export default function AlertDialog() {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AlertDialogData | null>(null);

  const respond = useCallback(
    (result: "confirm" | "cancel") => {
      setOpen(false);
      fetchNui("ALERT_DIALOG_RESULT", result);
    },
    []
  );

  useNuiEvent<AlertDialogData>("SHOW_ALERT_DIALOG", (incoming) => {
    setData(incoming);
    setOpen(true);
  });

  useNuiEvent("CLOSE_ALERT_DIALOG", () => {
    setOpen(false);
    fetchNui("ALERT_DIALOG_RESULT", null);
  });

  // ESC key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond("cancel");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, respond]);

  const width = data?.size ? SIZE_MAP[data.size] ?? SIZE_MAP.md : SIZE_MAP.md;

  return (
    <AnimatePresence>
      {open && data && (
        <>
          {/* Backdrop */}
          <motion.div
            key="alert-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => respond("cancel")}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 9998,
            }}
          />

          {/* Dialog */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: data.centered ? "center" : "flex-start",
              justifyContent: "center",
              paddingTop: data.centered ? undefined : "20vh",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
          <motion.div
            key="alert-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              width,
              pointerEvents: "auto",
            }}
          >
            <Flex
              direction="column"
              style={{
                background: alpha(theme.colors.dark[9], 0.88),
                border: `0.1vh solid rgba(255,255,255,0.07)`,
                borderRadius: theme.radius.sm,
                boxShadow: `0 0.74vh 2.96vh rgba(0,0,0,0.6), 0 0 4vh ${alpha(pc[9], 0.15)}`,
                overflow: "hidden",
              }}
            >
              {/* Top accent bar */}
              <div
                style={{
                  height: "0.35vh",
                  background: `linear-gradient(90deg, ${pc[9]}, ${pc[7]})`,
                  boxShadow: `0 0 0.8vh ${pc[6]}88`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  style={{
                    position: "absolute",
                    top: 0,
                    width: "35%",
                    height: "100%",
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                    pointerEvents: "none",
                  }}
                  animate={{ left: ["-35%", "120%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* Header */}
              <Flex p="1.6vh 2vh 0.6vh" direction="column">
                <Text
                  style={{
                    fontFamily: "Akrobat Bold, sans-serif",
                    fontSize: "1.6vh",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "white",
                    textShadow: `0 0 0.4vh ${alpha(pc[7], 0.5)}, 0 0 1vh ${alpha(pc[9], 0.3)}`,
                  }}
                >
                  {data.header}
                </Text>
              </Flex>

              {/* Divider */}
              <div
                style={{
                  height: "0.08vh",
                  margin: "0 2vh",
                  background: "rgba(255,255,255,0.06)",
                }}
              />

              {/* Content (markdown) */}
              <Flex
                p="1.2vh 2vh 1.8vh"
                direction="column"
                style={{
                  maxHeight: "40vh",
                  overflowY: "auto",
                }}
              >
                <SimpleMarkdown content={data.content} accentColor={pc[6]} />
              </Flex>

              {/* Buttons */}
              <Flex
                p="0 2vh 1.6vh"
                gap="1vh"
                justify="flex-end"
              >
                {data.cancel && (
                  <AlertButton
                    label={data.labels?.cancel ?? "Cancel"}
                    variant="cancel"
                    onClick={() => respond("cancel")}
                  />
                )}
                <AlertButton
                  label={data.labels?.confirm ?? "Confirm"}
                  variant="confirm"
                  onClick={() => respond("confirm")}
                />
              </Flex>
            </Flex>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function SimpleMarkdown({ content, accentColor }: { content: string; accentColor: string }) {
  const parts = useMemo(() => {
    // Split by newline (support \n and markdown double-space + \n)
    const lines = content.split(/\\n|\n/);
    return lines.map((line, li) => {
      // Parse inline bold (**text**) and italic (*text*)
      const tokens: React.ReactNode[] = [];
      const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
      let lastIndex = 0;
      let match;
      let ki = 0;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          tokens.push(line.slice(lastIndex, match.index));
        }
        if (match[2]) {
          // bold
          tokens.push(
            <strong key={ki++} style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Akrobat Bold, sans-serif" }}>
              {match[2]}
            </strong>
          );
        } else if (match[3]) {
          // italic
          tokens.push(
            <em key={ki++} style={{ color: accentColor }}>
              {match[3]}
            </em>
          );
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < line.length) {
        tokens.push(line.slice(lastIndex));
      }
      return (
        <p key={li} style={{ margin: "0 0 0.4vh" }}>
          {tokens.length ? tokens : "\u00A0"}
        </p>
      );
    });
  }, [content, accentColor]);

  return (
    <div
      style={{
        fontFamily: "Akrobat Regular, sans-serif",
        fontSize: "1.25vh",
        color: "rgba(255,255,255,0.55)",
        letterSpacing: "0.03em",
        lineHeight: "1.7",
      }}
    >
      {parts}
    </div>
  );
}

function AlertButton({
  label,
  variant,
  onClick,
}: {
  label: string;
  variant: "confirm" | "cancel";
  onClick: () => void;
}) {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];
  const isConfirm = variant === "confirm";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        fontFamily: "Akrobat Bold, sans-serif",
        fontSize: "1.15vh",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        border: `0.1vh solid ${isConfirm ? alpha(pc[7], 0.35) : "rgba(255,255,255,0.08)"}`,
        borderRadius: theme.radius.xs,
        padding: "0.8vh 2vh",
        color: isConfirm ? pc[5] : "rgba(255,255,255,0.4)",
        background: isConfirm ? alpha(pc[9], 0.2) : "rgba(255,255,255,0.04)",
        textShadow: isConfirm
          ? `0 0 0.4vh ${alpha(pc[7], 0.4)}`
          : undefined,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isConfirm
          ? alpha(pc[9], 0.35)
          : "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isConfirm
          ? alpha(pc[9], 0.2)
          : "rgba(255,255,255,0.04)";
      }}
    >
      {label}
    </motion.button>
  );
}
