/**
 * Talking to somebody.
 *
 * NOT A PANEL. Whoever you are speaking to is on camera while this is open and
 * their face is doing half the talking, so there is no card and no scrim — a
 * gradient along the bottom with the conversation laid on it.
 *
 * NOTHING MOVES. Their line gets a fixed band whether it runs to one line or
 * four, and the replies are dealt four at a time into a 2x2 that pages rather
 * than grows — a short page keeps its empty cells. A conversation whose buttons
 * walk up the screen between reads is one you misclick.
 *
 * The one thing ALLOWED to move is an emphasised readout, because watching a
 * number change is the payoff for the line you just picked.
 *
 * ── the right-hand column ───────────────────────────────────────────────────
 *
 * `metadata` is whatever the caller wants it to be. A haggle puts the asking
 * price, the price on the table and the seller's mood there; a scrapyard could
 * put your rep and how full the basket is. Three flags shape a row and nothing
 * about any particular script is known here:
 *
 *   emphasis  the big one — rendered large and scale-pops when its value changes
 *   strike    struck through, for a figure that has been beaten
 *   tone      ok | warn | bad | muted, for colour
 *
 * ── who decides ─────────────────────────────────────────────────────────────
 *
 * Both. A dialogue whose responses carry `action` is client-driven and behaves
 * as it always has. One that declares `onSelect` is SERVER-DRIVEN: the pick
 * goes up, a whole new state comes back, and this renders it. The second is
 * what anything with money in it wants, because then nothing on this side of
 * the wire can be argued with.
 */
import { alpha, Flex, Text, useMantineTheme } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../utils/fetchNui";
import { locale } from "../../stores/locales";
import type { ResourceTheme } from "../Themed";
import { setUiTheme } from "../../stores/uiTheme";

export type DialogTone = "ok" | "warn" | "bad" | "muted";

export type MetadataProps = {
  label: string;
  /** `value` is the field. `data` is the old name and still read. */
  value?: string;
  data?: string;
  tone?: DialogTone;
  emphasis?: boolean;
  strike?: boolean;
};

export type ResponseProps = {
  index: number;
  label: string;
  /** Held in slot one of EVERY page. For the way out of a conversation. */
  pin?: boolean;
  disabled?: boolean;
  empty?: boolean;
  dontClose?: boolean;
};

export type IDialogProps = {
  id: string;
  /**
   * The calling resource's palette, sent by the Lua side. Absent for a
   * resource with no override of its own, which then renders in dirk_lib's
   * theme exactly as before.
   */
  theme?: ResourceTheme | null;
  /** Who is talking. */
  title: string;
  /** Where you are, what this is about — the quiet line under the name. */
  subtitle?: string;
  /** What they just said. */
  dialog: string;
  /** Tone for that line, for a refusal that should not read like a greeting. */
  dialogTone?: DialogTone;
  metadata?: MetadataProps[];
  responses?: ResponseProps[];
  /** Replaces the replies when there is nothing left to say. */
  note?: string;
  noteTone?: DialogTone;
  /** Hides the way out — for the moment between committing and finding out. */
  locked?: boolean;
  cantClose?: boolean;
  closeLabel?: string;
  clickSounds?: boolean;
  hoverSounds?: boolean;
};

/**
 * Four cells, and a pinned reply always holds the first.
 *
 * Accepting is not one option among the others — it is the way out, and it has
 * to be one click from wherever you are. Left in the paged list, a long list
 * buries it on page two and you have to page BACK to agree to something you had
 * already decided to do.
 */
const PER_PAGE = 4;

/** Lua's json.encode writes `{}` for an empty table, so an empty list arrives as an object. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Small caps label, used for every field name in the band. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      fontFamily: "Akrobat Bold, sans-serif", fontSize: "0.95vh", fontWeight: 700,
      letterSpacing: "0.18em", textTransform: "uppercase",
      color: "rgba(255,255,255,0.42)", lineHeight: 1.2,
    }}>
      {children}
    </Text>
  );
}

function useTone() {
  const theme = useMantineTheme();
  const accent = theme.colors[theme.primaryColor][5];
  return (tone?: DialogTone, fallback = "#fff") => {
    switch (tone) {
      case "ok": return accent;
      case "warn": return theme.colors.yellow[5];
      case "bad": return theme.colors.red[6];
      case "muted": return "rgba(255,255,255,0.7)";
      default: return fallback;
    }
  };
}

/* ── one thing you can say ────────────────────────────────────────────────── */

function ReplyTile({ reply, disabled, onPick }: {
  reply: ResponseProps; disabled: boolean; onPick: (index: number) => void;
}) {
  const theme = useMantineTheme();
  const accent = theme.colors[theme.primaryColor][5];
  const hot = !!reply.pin;
  const off = disabled || !!reply.disabled;

  return (
    <motion.button
      type="button"
      disabled={off}
      onClick={() => onPick(reply.index)}
      whileHover={off ? undefined : { background: alpha(accent, hot ? 0.18 : 0.13) }}
      whileTap={off ? undefined : { scale: 0.98 }}
      style={{
        display: "flex", alignItems: "center",
        height: "100%", width: "100%", textAlign: "left",
        padding: "0.9vh 1.3vh",
        background: hot ? alpha(accent, 0.1) : "rgba(255,255,255,0.05)",
        border: `0.1vh solid ${hot ? alpha(accent, 0.45) : "rgba(255,255,255,0.1)"}`,
        borderRadius: theme.radius.xs,
        cursor: off ? "not-allowed" : "pointer",
        opacity: off ? 0.4 : 1,
      }}
    >
      <Text style={{
        fontSize: "1.4vh", lineHeight: 1.28,
        color: hot ? accent : "#fff",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {reply.label}
      </Text>
    </motion.button>
  );
}

/** An empty slot, so a page of three still has four cells and nothing reflows. */
function EmptyTile() {
  return (
    <div style={{
      border: "0.1vh dashed rgba(255,255,255,0.05)",
      borderRadius: "0.3vh", height: "100%",
    }} />
  );
}

function Pager({ dir, shown, onClick }: {
  dir: "left" | "right"; shown: boolean; onClick: () => void;
}) {
  const theme = useMantineTheme();
  return (
    <motion.button
      // Remounted when it appears or disappears.
      //
      // It is hidden rather than removed, so the pointer never "leaves" it and
      // framer keeps the hover background it had when it went. It then came
      // back on the next page still lit, wherever the mouse actually was.
      key={shown ? "on" : "off"}
      type="button"
      onClick={onClick}
      whileTap={shown ? { scale: 0.94 } : undefined}
      whileHover={shown ? { background: "rgba(255,255,255,0.09)" } : undefined}
      style={{
        // Hidden, never removed. Taking the arrow out of the flow on the first
        // page would slide every reply sideways the moment you paged.
        visibility: shown ? "visible" : "hidden",
        // And not a hit target while it is hidden.
        pointerEvents: shown ? "auto" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "2.6vh", flex: "none", alignSelf: "stretch",
        background: "rgba(0,0,0,0.3)",
        border: "0.1vh solid rgba(255,255,255,0.12)",
        borderRadius: theme.radius.xs,
        color: "rgba(255,255,255,0.5)",
        fontSize: "1.5vh", lineHeight: 1,
        cursor: "pointer",
      }}
    >
      {dir === "left" ? "‹" : "›"}
    </motion.button>
  );
}

/** Text in one of the four tones. */
function ToneText({ tone: t, fallback, style, children }: {
  tone?: DialogTone; fallback: string;
  style?: React.CSSProperties; children: React.ReactNode;
}) {
  const tone = useTone();
  return <Text style={{ ...style, color: tone(t, fallback) }}>{children}</Text>;
}

/* ── one readout on the right ─────────────────────────────────────────────── */

function Readout({ row }: { row: MetadataProps }) {
  const tone = useTone();
  const value = row.value ?? row.data ?? "";

  const body = (
    <Text style={{
      fontFamily: "Akrobat Bold, sans-serif",
      fontWeight: 700,
      fontSize: row.emphasis ? "3vh" : "1.75vh",
      lineHeight: row.emphasis ? 1.05 : 1.15,
      color: tone(row.tone, row.strike ? "rgba(255,255,255,0.34)" : "#fff"),
      textDecoration: row.strike ? "line-through" : undefined,
    }}>
      {value}
    </Text>
  );

  return (
    <Flex direction="column" align="flex-end" gap="0.2vh">
      <Key>{row.label}</Key>
      {row.emphasis ? (
        // Keyed on the VALUE, so it pops when the number changes and sits still
        // when the state updates for any other reason.
        <motion.div
          key={value}
          initial={{ scale: 1.16 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {body}
        </motion.div>
      ) : body}
    </Flex>
  );
}

/* ── the band ─────────────────────────────────────────────────────────────── */

export default function Dialog() {
  const theme = useMantineTheme();
  const bad = theme.colors.red[6];

  const [data, setData] = useState<IDialogProps | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);

  useNuiEvent<IDialogProps | null>("DIALOG_STATE", (next) => {
    // Reported rather than applied here: `App` wraps this whole component, so
    // the hooks in its body see the caller's palette too.
    setUiTheme("dialog", next?.theme);
    setData(next ?? null);
    setBusy(false);
    // A brand new conversation starts on page one; a state update within the
    // same one leaves you where you were reading.
    setPage((p) => (next && data && next.id === data.id ? p : 0));
  });

  const locked = busy || !!data?.locked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!data || locked || data.cantClose) return;
      setData(null);
      fetchNui("DIALOG_SELECTED", { index: "close" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, locked]);

  if (!data) return null;

  const rows = asArray<MetadataProps>(data.metadata);
  const all = asArray<ResponseProps>(data.responses).filter((r) => !r.empty);

  const pinned = all.find((r) => r.pin);
  const rest = all.filter((r) => !r.pin);
  const perPage = pinned ? PER_PAGE - 1 : PER_PAGE;

  const pages = Math.max(1, Math.ceil(rest.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = rest.slice(current * perPage, current * perPage + perPage);
  const filled = shown.length + (pinned ? 1 : 0);

  const pick = (index: number) => {
    if (locked) return;
    // Held until something arrives. Every pick ends in either a close or a
    // fresh DIALOG_STATE, and both clear it — so a second click cannot land
    // while a server-driven answer is still in flight.
    setBusy(true);
    fetchNui("DIALOG_SELECTED", { index });
  };

  const close = () => {
    if (locked) return;
    setData(null);
    fetchNui("DIALOG_SELECTED", { index: "close" });
  };

  return (
    <AnimatePresence>
      <motion.div
        key="dialog"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9000,
          // Nothing here is text you copy. Dragging across a conversation and
          // highlighting half of it reads like a web page, not a game.
          userSelect: "none",
          // Only where the words are. Their face is the other half of this.
          background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.76) 34%,"
            + " rgba(0,0,0,0.3) 70%, transparent 100%)",
          paddingTop: "9vh",
          pointerEvents: "none",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          style={{
            width: "100%", maxWidth: "128vh", margin: "0 auto",
            padding: "0 4vh 3.6vh", pointerEvents: "auto",
          }}
        >
          {/* ── who, and whatever the caller wants beside them ── */}
          <Flex justify="space-between" align="flex-end" gap="3vh">
            <Flex direction="column" gap="0.3vh" style={{ minWidth: 0 }}>
              <Text style={{
                fontFamily: "Akrobat Bold, sans-serif", fontSize: "2.1vh",
                lineHeight: 1.1, color: "#fff",
              }} truncate>
                {data.title}
              </Text>
              {!!data.subtitle && (
                <Text style={{
                  fontFamily: "Akrobat SemiBold, sans-serif", fontSize: "1.05vh",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.42)",
                }} truncate>
                  {data.subtitle}
                </Text>
              )}
            </Flex>

            {rows.length > 0 && (
              <Flex align="flex-end" gap="2.4vh" style={{ flex: "none" }}>
                {rows.map((row, i) => <Readout key={`${row.label}-${i}`} row={row} />)}
              </Flex>
            )}
          </Flex>

          {/* ── what they just said ──
              Fixed height: a four-line answer and a one-line answer take the
              same room, so nothing below them ever moves. */}
          <Flex align="center" style={{ height: "7.4vh", marginTop: "1.2vh" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={data.dialog}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                style={{ width: "100%" }}
              >
                <ToneText
                  tone={data.dialogTone}
                  fallback="rgba(255,255,255,0.9)"
                  style={{
                    fontSize: "1.85vh", lineHeight: 1.4, fontStyle: "italic",
                    maxWidth: "62ch",
                    textShadow: "0 0.1vh 1.4vh rgba(0,0,0,0.9)",
                  }}
                >
                  {`“${data.dialog}”`}
                </ToneText>
              </motion.div>
            </AnimatePresence>
          </Flex>

          {/* ── what you can say ── */}
          <Flex gap="0.8vh" style={{ height: "11.4vh", marginTop: "0.6vh" }}>
            <Pager
              dir="left"
              shown={pages > 1 && current > 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            />

            <div style={{
              flex: 1, minWidth: 0, maxWidth: "74vh",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: "0.8vh",
            }}>
              {data.note ? (
                <Flex align="center" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}>
                  <ToneText
                    tone={data.noteTone}
                    fallback="rgba(255,255,255,0.45)"
                    style={{ fontSize: "1.6vh" }}
                  >
                    {data.note}
                  </ToneText>
                </Flex>
              ) : (
                <>
                  {pinned && (
                    <ReplyTile key={`pin-${pinned.index}`} reply={pinned} disabled={locked} onPick={pick} />
                  )}
                  {shown.map((r) => (
                    <ReplyTile key={r.index} reply={r} disabled={locked} onPick={pick} />
                  ))}
                  {Array.from({ length: Math.max(0, PER_PAGE - filled) }, (_, i) => (
                    <EmptyTile key={`gap${i}`} />
                  ))}
                </>
              )}
            </div>

            <Pager
              dir="right"
              shown={pages > 1 && current < pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            />
          </Flex>

          {/* ── out ── */}
          {!data.cantClose && (
            <Flex justify="flex-end" style={{ marginTop: "1.2vh" }}>
              <motion.button
                type="button"
                onClick={close}
                disabled={locked}
                whileHover={locked ? undefined : { background: alpha(bad, 0.16) }}
                whileTap={locked ? undefined : { scale: 0.97 }}
                style={{
                  // Hidden, never unmounted. Pulling it out of the flow would
                  // move the row it sits in at the exact moment a deal lands.
                  visibility: locked ? "hidden" : "visible",
                  fontFamily: "Akrobat Bold, sans-serif", fontSize: "1.25vh",
                  letterSpacing: "0.09em", textTransform: "uppercase",
                  padding: "0.8vh 1.5vh", borderRadius: theme.radius.xs,
                  background: "rgba(0,0,0,0.3)",
                  border: `0.1vh solid ${alpha(bad, 0.34)}`,
                  color: alpha(bad, 0.92),
                  cursor: "pointer",
                }}
              >
                {data.closeLabel || locale("dialog.close")}
              </motion.button>
            </Flex>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
