import { alpha, Flex, Text, useMantineTheme } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../utils/fetchNui";
import { setUiTheme } from '../../stores/uiTheme';

interface KeycodeData {
  code: string;
  title?: string;
  description?: string;
  multipleTries?: boolean;
  allowCancel?: boolean;
  length?: number;
}

type Flash = null | "ok" | "err";

export default function Keycode() {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KeycodeData | null>(null);
  const [entry, setEntry] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const respondedRef = useRef(false);

  const respond = useCallback((correct: boolean) => {
    if (respondedRef.current) return;
    respondedRef.current = true;
    setOpen(false);
    fetchNui("KEYCODE_RESULT", { correct });
  }, []);

  useNuiEvent<KeycodeData>("OPEN_KEYCODE", (incoming) => {
    // Whose colours this belongs to. `App` wraps this component in
    // <Themed>, so the whole thing — body and hooks included — renders
    // in the calling resource's palette.
    setUiTheme('keycode', (incoming as { theme?: never } | undefined)?.theme);

    respondedRef.current = false;
    setData(incoming);
    setEntry("");
    setFlash(null);
    setOpen(true);
  });

  // Allow callers (and the TestBed harness) to dismiss the keypad without
  // submitting. Mirrors the cancel-button path so focus state stays correct.
  useNuiEvent("CLOSE_KEYCODE", () => {
    setOpen(false);
    if (!respondedRef.current) {
      respondedRef.current = true;
      fetchNui("KEYCODE_RESULT", { correct: false });
    }
  });

  const submit = useCallback(
    (value: string) => {
      if (!data) return;
      if (value === data.code) {
        setFlash("ok");
        setTimeout(() => respond(true), 450);
      } else {
        setFlash("err");
        if (data.multipleTries) {
          setTimeout(() => {
            setFlash(null);
            setEntry("");
          }, 450);
        } else {
          setTimeout(() => respond(false), 500);
        }
      }
    },
    [data, respond]
  );

  const press = useCallback(
    (n: number) => {
      if (flash) return;
      setEntry((prev) => {
        const next = prev + String(n);
        if (data?.length && next.length >= data.length) {
          setTimeout(() => submit(next), 0);
        }
        return next;
      });
    },
    [data, flash, submit]
  );

  const back = useCallback(() => {
    if (flash) return;
    setEntry((p) => p.slice(0, -1));
  }, [flash]);

  // Keyboard input
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (data?.allowCancel !== false) respond(false);
        return;
      }
      if (e.key === "Backspace") return back();
      if (e.key === "Enter") return submit(entry);
      if (/^[0-9]$/.test(e.key)) return press(Number(e.key));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, data, entry, back, press, submit, respond]);

  const screenBg =
    flash === "ok"
      ? alpha("#22c55e", 0.35)
      : flash === "err"
      ? alpha("#ef4444", 0.35)
      : "rgba(0,0,0,0.55)";

  const screenBorder =
    flash === "ok"
      ? "#22c55e"
      : flash === "err"
      ? "#ef4444"
      : alpha(pc[7], 0.4);

  return (
    <AnimatePresence>
      {open && data && (
        <>
          <motion.div
            key="keycode-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => data.allowCancel !== false && respond(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 9998,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="keycode-panel"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ width: "32vh", pointerEvents: "auto" }}
            >
              <Flex
                direction="column"
                style={{
                  background: alpha(theme.colors.dark[9], 0.9),
                  border: "0.1vh solid rgba(255,255,255,0.07)",
                  borderRadius: theme.radius.sm,
                  boxShadow: `0 0.74vh 2.96vh rgba(0,0,0,0.6), 0 0 4vh ${alpha(pc[9], 0.18)}`,
                  overflow: "hidden",
                }}
              >
                {/* Top accent */}
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
                    }}
                    animate={{ left: ["-35%", "120%"] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                  />
                </div>

                {/* Header */}
                <Flex p="1.4vh 2vh 0.6vh" direction="column">
                  <Text
                    style={{
                      fontFamily: "Akrobat Bold, sans-serif",
                      fontSize: "1.55vh",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "white",
                      textShadow: `0 0 0.4vh ${alpha(pc[7], 0.5)}`,
                    }}
                  >
                    {data.title ?? "Security Panel"}
                  </Text>
                  {data.description && (
                    <Text
                      style={{
                        fontFamily: "Akrobat Regular, sans-serif",
                        fontSize: "1.15vh",
                        color: "rgba(255,255,255,0.55)",
                        marginTop: "0.4vh",
                      }}
                    >
                      {data.description}
                    </Text>
                  )}
                </Flex>

                <div
                  style={{
                    height: "0.08vh",
                    margin: "0 2vh",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />

                {/* Screen */}
                <Flex p="1.4vh 2vh" justify="center">
                  <motion.div
                    animate={{
                      x: flash === "err" ? [0, -6, 6, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: "100%",
                      height: "5vh",
                      borderRadius: theme.radius.xs,
                      background: screenBg,
                      border: `0.12vh solid ${screenBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "monospace",
                      fontSize: "2.6vh",
                      color: "white",
                      letterSpacing: "0.6vh",
                      textShadow: `0 0 0.6vh ${alpha(pc[6], 0.6)}`,
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                  >
                    {entry || "\u00A0"}
                  </motion.div>
                </Flex>

                {/* Keypad */}
                <Flex
                  p="0 2vh 1.6vh"
                  direction="column"
                  gap="0.8vh"
                >
                  {[
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                  ].map((row, ri) => (
                    <Flex key={ri} gap="0.8vh" justify="space-between">
                      {row.map((n) => (
                        <KeyButton key={n} label={String(n)} onClick={() => press(n)} />
                      ))}
                    </Flex>
                  ))}
                  <Flex gap="0.8vh" justify="space-between">
                    <KeyButton
                      label={<FontAwesomeIcon icon={["fas", "delete-left"]} />}
                      onClick={back}
                      tone="danger"
                    />
                    <KeyButton label="0" onClick={() => press(0)} />
                    <KeyButton
                      label={<FontAwesomeIcon icon={["fas", "circle-check"]} />}
                      onClick={() => submit(entry)}
                      tone="confirm"
                    />
                  </Flex>
                </Flex>
              </Flex>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function KeyButton({
  label,
  onClick,
  tone,
}: {
  label: React.ReactNode;
  onClick: () => void;
  tone?: "confirm" | "danger";
}) {
  const theme = useMantineTheme();
  const pc = theme.colors[theme.primaryColor];

  const color =
    tone === "confirm" ? "#22c55e" : tone === "danger" ? "#ef4444" : pc[5];
  const borderColor =
    tone === "confirm"
      ? alpha("#22c55e", 0.35)
      : tone === "danger"
      ? alpha("#ef4444", 0.35)
      : alpha(pc[7], 0.3);
  const bg =
    tone === "confirm"
      ? alpha("#22c55e", 0.12)
      : tone === "danger"
      ? alpha("#ef4444", 0.12)
      : "rgba(255,255,255,0.04)";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        flex: 1,
        aspectRatio: "1 / 1",
        cursor: "pointer",
        fontFamily: "Akrobat Bold, sans-serif",
        fontSize: "2vh",
        fontWeight: 700,
        color,
        background: bg,
        border: `0.12vh solid ${borderColor}`,
        borderRadius: theme.radius.xs,
        textShadow: `0 0 0.4vh ${alpha(color, 0.5)}`,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          tone === "confirm"
            ? alpha("#22c55e", 0.22)
            : tone === "danger"
            ? alpha("#ef4444", 0.22)
            : "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
      }}
    >
      {label}
    </motion.button>
  );
}
