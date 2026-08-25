import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { create } from 'zustand';

/**
 * Short-lived confirmations, bottom-right.
 *
 * The panel had no way to say "that worked". Everything it does is staged and
 * confirmed by the save bar, so nothing needed one - until actions arrived
 * that happen IMMEDIATELY and elsewhere: giving yourself an item puts it in
 * your inventory, which is behind the panel and therefore invisible. A button
 * that appears to do nothing is indistinguishable from a broken one.
 *
 * Deliberately small: three kinds, one line of text, gone in a few seconds.
 * Anything that needs more than that is not a toast.
 */

export type ToastKind = 'success' | 'error' | 'info';

type Toast = { id: number; kind: ToastKind; message: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    // Cap the stack. A loop that fires one per frame should not bury the panel.
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }].slice(-4) }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Raise a toast from anywhere, including a script's own control. */
export function notify(kind: ToastKind, message: string) {
  useToasts.getState().push(kind, message);
}

const ICON = { success: Check, error: AlertTriangle, info: Info };

export function Toasts() {
  const theme = useMantineTheme();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  const colorFor = (kind: ToastKind) => (
    kind === 'success' ? theme.colors[theme.primaryColor][5]
      : kind === 'error' ? '#ef4444'
        : 'rgba(255,255,255,0.6)'
  );

  return (
    <Flex
      direction="column"
      gap="0.6vh"
      style={{
        // FIXED and above everything.
        //
        // Sitting inside the panel at z-index 400 put these underneath every
        // modal the panel opens - which is exactly when something is most
        // likely to need saying, since a modal is where the actions are.
        // Modals here run to 10300, so this clears them.
        position: 'fixed',
        bottom: '7.5vh',
        right: '1.6vh',
        zIndex: 10500,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const color = colorFor(toast.kind);
          const Icon = ICON[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={() => dismiss(toast.id)}
            >
              <Flex
                align="center"
                gap="0.8vh"
                px="1.2vh"
                py="0.8vh"
                style={{
                  // No backdrop-filter: it does not render in this CEF build.
                  background: alpha(theme.colors.dark[9], 0.96),
                  border: `0.1vh solid ${alpha(color, 0.45)}`,
                  borderLeft: `0.3vh solid ${color}`,
                  borderRadius: theme.radius.xs,
                  maxWidth: '38vh',
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                }}
              >
                <Icon size="1.6vh" color={color} style={{ flexShrink: 0 }} />
                <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.85)">
                  {toast.message}
                </Text>
              </Flex>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Flex>
  );
}
