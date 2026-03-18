import { alpha, Flex, Text, useMantineTheme } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";

interface GizmoKeys {
  translate?: string;
  rotate?: string;
  localWorld?: string;
  orbit?: string;
  select?: string;
  confirm?: string;
  cancel?: string;
}

const DEFAULT_CONTROLS = [
  { keyField: "translate", fallback: "T", label: "Translate" },
  { keyField: "rotate", fallback: "R", label: "Rotate" },
  { keyField: "localWorld", fallback: "L", label: "Local / World" },
  { keyField: "orbit", fallback: "ALT", label: "Orbit Camera" },
  { keyField: "select", fallback: "LMB", label: "Drag Handle" },
  { keyField: "confirm", fallback: "ENTER", label: "Confirm" },
  { keyField: "cancel", fallback: "BACKSPACE", label: "Cancel" },
] as const;

export default function GizmoOverlay() {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<GizmoKeys>({});

  useNuiEvent<GizmoKeys>("SHOW_GIZMO_CONTROLS", (data) => {
    setKeys(data || {});
    setOpen(true);
  });
  useNuiEvent("HIDE_GIZMO_CONTROLS", () => setOpen(false));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: "3vh",
            right: "3vh",
            zIndex: 1000,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <Flex
            direction="column"
            gap="0.6vh"
            style={{
              background: alpha(theme.colors.dark[9], 0.55),
              border: "0.1vh solid rgba(255,255,255,0.07)",
              borderRadius: theme.radius.sm,
              boxShadow: "0 0.74vh 2.96vh rgba(0,0,0,0.5)",
              padding: "1.2vh 1.4vh",
              minWidth: "18vh",
            }}
          >
            <Text
              style={{
                fontFamily: "Akrobat Bold, sans-serif",
                fontSize: "1.25vh",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: pc[6],
                textShadow: `0 0 0.8vh ${alpha(pc[7], 0.5)}, 0 0 1.6vh ${alpha(pc[9], 0.3)}`,
                marginBottom: "0.2vh",
              }}
            >
              Gizmo Controls
            </Text>

            {DEFAULT_CONTROLS.map((c) => {
              const displayKey = keys[c.keyField] || c.fallback;
              return (
              <Flex key={c.keyField} align="center" gap="0.8vh">
                <Flex
                  justify="center"
                  align="center"
                  style={{
                    background: alpha(pc[9], 0.25),
                    border: "0.1vh solid rgba(255,255,255,0.07)",
                    borderRadius: theme.radius.xs,
                    minWidth: "3.8vh",
                    height: "2.6vh",
                    padding: "0 0.6vh",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Akrobat Bold, sans-serif",
                      fontSize: "1.15vh",
                      fontWeight: 700,
                      color: pc[6],
                      letterSpacing: "0.06em",
                      textShadow: `0 0 0.6vh ${alpha(pc[7], 0.4)}`,
                    }}
                  >
                    {displayKey}
                  </Text>
                </Flex>
                <Text
                  style={{
                    fontFamily: "Akrobat Bold, sans-serif",
                    fontSize: "1.15vh",
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {c.label}
                </Text>
              </Flex>
              );
            })}
          </Flex>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
