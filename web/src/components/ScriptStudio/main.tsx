import { alpha, Flex, Text, TextInput, Tooltip, useMantineTheme } from '@mantine/core';
import { ConfirmModal, useSettings } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Anchor, Banknote, Box, Braces, Car, Droplets, Fish, Gamepad2, History, Home,
  Image, LayoutTemplate, Library, Lightbulb, Link as LinkIcon, ListRestart, Lock,
  Map as MapIcon, MessageCircle, Music, Package, Palette, Plug, Radar,
  Redo2, RefreshCw, RotateCcw, ScrollText, Search, Shield, Shovel, SlidersHorizontal, Sprout,
  Store, Target, TrendingUp, Trophy, Undo2, User, Users, Utensils, Waves, Wrench, X
} from 'lucide-react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { Fragment, memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNuiEvent } from '../../hooks/useNuiEvent';
import { fetchNui } from '../../utils/fetchNui';
import { ControlsControl, SettingControl, isWideType } from './Controls';
import { ListRows } from './ListRows';
import { SectionBody } from './SectionBody';
import { HistoryModal } from './HistoryModal';
import { LogsPage } from './LogsPage';
import { applyLivePayload, type LivePayload } from './live';
import { HomePage } from './HomePage';
import { problemsFor } from './validate';
import { DiscordSetup } from './DiscordSetup';
import { MissingItemsButton } from './MissingItems';
import { BridgesPage } from './BridgesPage';
import { AdminsPage } from './AdminsPage';
import { CataloguePage } from './CataloguePage';
import { MinigamesPage } from './MinigamesPage';
import { DesignPage } from './DesignPage';
import { JsonModal } from './JsonModal';
import { PaletteControl } from './PaletteControl';
import { GroupsControl, KeyValueControl } from './MapControls';
import { KeybindMapControl } from './KeybindMapControl';
import { GroupGradeControl } from './GroupGradeControl';
import { WeekdayControl } from './WeekdayControl';
import { PositionListControl } from './PositionListControl';
import { WeightMapControl } from './WeightMapControl';
import { RefListControl } from './RefListControl';
import { MantineColorControl, ShadeControl } from './ThemeControls';
import { PickerDrawer, opensPicker } from './PickerDrawer';
import { Chip, StudioButton } from './ui';
import {
  commitDraft, discardDraft, dirtyCount, effectiveValue, factoryReset,
  isEnabled, isModified, isStaged, matchesSearch, redo, revertToDefault, setValue, undo, useStudio,
} from './store';
import { sectionKey, settingKey, translate, useActiveLanguage, useBundles } from './studioLocale';
import type { SettingEntry, SettingGroup, StudioScript } from './types';

const ICONS: Record<string, React.ElementType> = {
  home: Home,
  fish: Fish, sprout: Sprout, library: Library, 'sliders-horizontal': SlidersHorizontal,
  palette: Palette, anchor: Anchor, map: MapIcon, store: Store, trophy: Trophy,
  target: Target, utensils: Utensils, user: User, shield: Shield,
  'scroll-text': ScrollText, droplets: Droplets, plug: Plug, banknote: Banknote,
  shovel: Shovel, waves: Waves, users: Users, wrench: Wrench,
  'message-circle': MessageCircle, 'trending-up': TrendingUp, radar: Radar,
  box: Box, package: Package, gamepad: Gamepad2, car: Car,
  // dirk_loading's sections
  image: Image, music: Music, lightbulb: Lightbulb, link: LinkIcon, layout: LayoutTemplate,
};

export function Icon({ name, size, color }: { name: string; size: string; color: string }) {
  const Cmp = ICONS[name] ?? SlidersHorizontal;
  return <Cmp size={size} color={color} />;
}

/** Wraps the matched run so a search hit is visible in place, like his does. */
function Highlight({ text, query }: { text: string; query: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span style={{ background: alpha(color, 0.25), color, borderRadius: '0.3vh' }}>
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

export default function ScriptStudio() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const open = useStudio((s) => s.open);
  const scripts = useStudio((s) => s.scripts);
  const activeResource = useStudio((s) => s.activeResource);
  const search = useStudio((s) => s.search);
  // Typing stays instant; the 100+ row filter runs on the deferred value.
  const deferredSearch = useDeferredValue(search);
  const canEdit = useStudio((s) => s.canEdit);
  const saving = useStudio((s) => s.saving);
  const activePage = useStudio((s) => s.activePage);
  const fullScreen = useStudio((s) => s.fullScreen);
  const editingDesign = useStudio((s) => s.editingDesign);
  // Setting text comes from each script's own bundle; changing the language
  // setting re-renders every label immediately, no reopen.
  const language = useActiveLanguage();
  const bundles = useBundles();

  // Live theme switching, the way the old per-resource panel had it: the shared
  // appearance settings feed dirk-cfx-react's settings store, which is what
  // DirkProvider builds the Mantine theme from - so a colour change repaints the
  // panel as you make it, before saving.
  const sharedScript = useMemo(() => scripts.find((entry) => entry.shared), [scripts]);
  const sharedDraft = useStudio((s) => (sharedScript ? s.draft[sharedScript.resource] : undefined));

  useEffect(() => {
    if (!sharedScript) return;
    const read = (suffix: string) => {
      const entry = sharedScript.entries.find((item) => item.path.endsWith(suffix));
      if (!entry) return undefined;
      const staged = sharedDraft?.[entry.path];
      return staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value;
    };

    const primaryColor = read('.primaryColor') ?? read('.primaryColour');
    const primaryShade = read('.primaryShade');
    const customTheme = read('.customTheme');

    useSettings.setState({
      ...(typeof primaryColor === 'string' ? { primaryColor } : {}),
      ...(typeof primaryShade === 'number' ? { primaryShade } : {}),
      ...(Array.isArray(customTheme) && customTheme.length === 10
        ? { customTheme: customTheme as never }
        : {}),
      ...(language ? { language } : {}),
    });
  }, [sharedScript, sharedDraft, language]);
  const draft = useStudio((s) => s.draft[s.activeResource]) ?? {};

  const [activeGroup, setActiveGroup] = useState('');
  // the pinned bar only shows once the real heading has scrolled out of view,
  // otherwise you read the same title twice
  const [headingGone, setHeadingGone] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [pickerEntry, setPickerEntry] = useState<SettingEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // In game the panel is opened by dirk_lib; in a browser it should just be
  // there, which is how this gets reviewed without launching FiveM.
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as unknown as { invokeNative?: unknown }).invokeNative) {
      useStudio.setState({ open: true });
    }
  }, []);

  // The server sends RAW schemas plus that resource's stored values, not
  // ready-made panel state: layout, controls and validation are all derived
  // from the schema here, which is why adding a script needs no dirk_lib change.
  useNuiEvent<{ scripts?: LivePayload[]; canEdit?: boolean; focus?: string }>('OPEN_SCRIPT_STUDIO', (data) => {
    if (data?.scripts?.length) applyLivePayload(data.scripts, data.focus);
    useStudio.setState({
      open: true,
      canEdit: data?.canEdit !== false,
    });
  });

  useNuiEvent('CLOSE_SCRIPT_STUDIO', () => useStudio.setState({ open: false }));

  const script = useMemo(
    () => scripts.find((s) => s.resource === activeResource) ?? scripts[0],
    [scripts, activeResource],
  );

  const query = deferredSearch.trim();

  const groupLabels = useMemo(
    () => new Map((script?.groups ?? []).map((g) => [
      g.id,
      translate(bundles, language, script?.resource ?? '', sectionKey(g.id, 'label'), g.label),
    ])),
    [script, bundles, language],
  );

  /** A group with its label and description resolved for the active language. */
  const localisedGroup = useCallback((group: SettingGroup): SettingGroup => ({
    ...group,
    label: translate(bundles, language, script?.resource ?? '', sectionKey(group.id, 'label'), group.label),
    description: group.description
      ? translate(bundles, language, script?.resource ?? '', sectionKey(group.id, 'description'), group.description)
      : undefined,
  }), [bundles, language, script]);

  // group id -> entries that survive the current search
  const byGroup = useMemo(() => {
    const map = new Map<string, SettingEntry[]>();
    for (const entry of script?.entries ?? []) {
      if (!matchesSearch(entry, groupLabels.get(entry.group) ?? entry.group, query)) continue;
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return map;
  }, [script, groupLabels, query]);

  const visibleGroups = useMemo(
    () => (script?.groups ?? []).filter((g) => (byGroup.get(g.id)?.length ?? 0) > 0),
    [script, byGroup],
  );

  // per-group modified counts drive the rail dots
  const modifiedByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of script?.entries ?? []) {
      if (!isModified(script!.resource, entry)) continue;
      map.set(entry.group, (map.get(entry.group) ?? 0) + 1);
    }
    return map;
  }, [script, draft]);

  useEffect(() => {
    setActiveGroup(visibleGroups[0]?.id ?? '');
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeResource]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickerEntry || resetOpen) return;
      handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pickerEntry, resetOpen]);

  const handleClose = () => {
    useStudio.setState({ open: false, search: '' });
    fetchNui('CLOSE_SCRIPT_STUDIO');
  };

  // ── Virtualised sections ──────────────────────────────────────────────
  //
  // A script is up to ~20 sections holding ~100 inputs and ~270 list rows.
  // Mounting all of that on a switch is what made the click hang, and paging
  // one list only nibbled at it. The pane now renders ONE SECTION PER VIRTUAL
  // ROW, so cost tracks what is on screen rather than how big the script is.
  //
  // Heights vary wildly (a toggle vs a 56vh map), so sections are measured as
  // they render rather than estimated - the same wrong-estimate trap that
  // `content-visibility` fell into earlier.
  //
  // Sections are remembered once measured. Unmeasured ones fall back to a
  // constant, and that constant is only ever a rough placeholder - TanStack
  // memoises estimateSize's output, so a self-adjusting estimate never
  // actually reaches it. Accuracy comes from `forcedIndex` below instead.
  //
  // Keyed by section id rather than index, so it survives search filtering and
  // switching scripts.
  const sizeCache = useRef<Map<string, number>>(new Map());

  // The section a rail click is travelling to, force-rendered no matter where
  // the viewport is. Without this a long jump cannot land: the pane can only
  // scroll as far as the CURRENT total size allows, and that total is built
  // from estimates for everything unmeasured - so reaching a distant section
  // meant crawling down a screenful at a time, measuring as it went, and under
  // any real CPU load it simply ran out of frames before arriving. Rendering
  // the target immediately means it measures immediately, and one correction
  // puts it exactly under the heading.
  const [forcedIndex, setForcedIndex] = useState<number | null>(null);

  // The section being measured in the background. Mounting the whole script at
  // once costs seconds - measured, not guessed - so the pane cannot simply
  // render everything. But an unmeasured section is one a rail click cannot
  // reliably reach, so the heights get collected anyway: one section per idle
  // tick, off-screen, after the panel has settled. It is invisible, it stops as
  // soon as every height is known, and by the time anyone reaches for the rail
  // the offsets are real numbers rather than estimates.
  const [warmIndex, setWarmIndex] = useState<number | null>(null);

  // Sections kept mounted beyond the scroll window: the few most recently
  // visited, plus whatever the pointer is currently resting on in the rail.
  //
  // Mounting one section is a single 250ms-1s task - it is the destination
  // rendering, not the scroll, that made a rail click feel heavy. Hovering a
  // rail item starts that work while the pointer is still travelling to the
  // click, so by the time the button is pressed there is nothing left to do.
  // Capped at four so search still only ever filters a handful of sections.
  const [pinned, setPinned] = useState<number[]>([]);
  const hoverTimer = useRef<number | undefined>(undefined);

  const pinSection = useCallback((index: number) => {
    setPinned((prev) => (prev[0] === index ? prev : [index, ...prev.filter((i) => i !== index)].slice(0, 4)));
  }, []);

  // A pointer sweeping down the rail should not mount everything it passes.
  const prefetchSection = useCallback((index: number) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => pinSection(index), 120);
  }, [pinSection]);

  const cancelPrefetch = useCallback(() => clearTimeout(hoverTimer.current), []);

  const jumpAnim = useRef<number | null>(null);
  const jumping = useRef(false);

  const virtualizer = useVirtualizer({
    count: visibleGroups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const id = visibleGroups[index]?.id;
      return (id && sizeCache.current.get(id)) || 700;
    },
    overscan: 2,
    // offsetHeight, NOT getBoundingClientRect: the panel animates scale 0.97 -> 1
    // on open, and a rect measured mid-animation is 3% short - which across a
    // ~18,000px list is a 500px error baked into the cache.
    measureElement: (el) => {
      const height = (el as HTMLElement).offsetHeight;
      const id = (el as HTMLElement).dataset.groupId;
      if (id && height > 0) sizeCache.current.set(id, height);
      return height;
    },
    getItemKey: (index) => visibleGroups[index]?.id ?? index,
    rangeExtractor: (range) => {
      const base = defaultRangeExtractor(range);
      const extra = [forcedIndex, warmIndex, ...pinned].filter(
        (index): index is number => index !== null && index < visibleGroups.length && !base.includes(index),
      );
      if (extra.length === 0) return base;
      return [...new Set([...base, ...extra])].sort((a, b) => a - b);
    },
  });

  const items = virtualizer.getVirtualItems();

  // Which section is being read: the last one starting above the fold. Comes
  // from measurements the virtualiser already holds, so no layout reads here.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || visibleGroups.length === 0) return;

    const onScroll = () => {
      // a rail jump drives scrollTop itself; letting this run mid-glide would
      // flick the rail highlight through every section on the way past
      if (jumping.current) return;
      const threshold = container.scrollTop + 90;
      const measured = virtualizer.getVirtualItems();
      let current = visibleGroups[0]?.id ?? '';
      for (const item of measured) {
        if (item.start <= threshold) current = visibleGroups[item.index]?.id ?? current;
      }
      if (current) setActiveGroup((prev) => (prev === current ? prev : current));

      // the pinned bar appears once the real heading has scrolled past
      const active = measured.find((item) => visibleGroups[item.index]?.id === current);
      setHeadingGone(active ? active.start + 44 < container.scrollTop : false);
    };

    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
    //  and  are deps because they decide whether the scroller
    // EXISTS. Without them this effect ran once, found scrollRef empty because
    // the pane had not mounted yet, bailed, and never re-ran - so the rail
    // silently stopped following the scroll position.
  }, [virtualizer, visibleGroups, open, activePage]);

  // Walk the unmeasured sections, one per idle tick, and let the virtualiser
  // measure each as it mounts. Yields to anything the user is doing: it stands
  // down while a jump is in flight and restarts from wherever it got to.
  useEffect(() => {
    if (!open || activePage || visibleGroups.length === 0) return;

    let cancelled = false;
    let index = 0;
    let timer: number | undefined;
    let idle: number | undefined;

    const step = () => {
      if (cancelled) return;
      if (jumping.current) return schedule();

      while (index < visibleGroups.length && sizeCache.current.has(visibleGroups[index]!.id)) index += 1;
      if (index >= visibleGroups.length) return setWarmIndex(null);

      setWarmIndex(index);
      index += 1;
      schedule();
    };

    // Two frames per section: one to mount it, one for its measurement to land.
    // Queued behind whatever else the browser is doing, so warming never
    // competes with typing or scrolling - the timeout only stops it stalling
    // forever on a busy page.
    const schedule = () => {
      const run = () => requestAnimationFrame(() => requestAnimationFrame(step));
      const onIdle = window.requestIdleCallback;
      if (onIdle) idle = onIdle.call(window, run, { timeout: 600 });
      else timer = window.setTimeout(run, 120);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (idle) window.cancelIdleCallback?.(idle);
      setWarmIndex(null);
    };
  }, [open, activePage, activeResource, visibleGroups]);

  /**
   * Jump the pane to a section.
   *
   * NOT `virtualizer.scrollToIndex`. That aims at an offset built from
   * estimates and re-aims every frame as sections measure; with CSS
   * `scroll-behavior: smooth` each re-aim restarted a fresh glide, so the pane
   * chased a moving target and visibly never arrived.
   *
   * Two phases. The glide is the visible motion, aimed at the virtualiser's
   * offset. The settle then stops trusting that model and corrects against
   * where the section's element ACTUALLY is - which is the only number that
   * cannot be wrong, and the one that matters on a first visit when nothing
   * below has been measured yet.
   */
  // jumpTo re-enters itself after closing a page, so it reaches its own latest
  // identity through a ref rather than listing itself as a dependency
  const jumpToRef = useRef<(groupId: string) => void>(() => {});

  const jumpTo = useCallback((groupId: string) => {
    const index = visibleGroups.findIndex((group) => group.id === groupId);
    if (index < 0) return;

    // A full page (Design, Bridges, …) replaces the settings pane entirely, so
    // its scroll container is not mounted and the jump below has nothing to
    // scroll — the click used to die here. Close the page, then jump once React
    // has put the pane back.
    if (useStudio.getState().activePage) {
      useStudio.setState({ activePage: null, editingDesign: null });
      requestAnimationFrame(() => requestAnimationFrame(() => jumpToRef.current(groupId)));
      return;
    }

    const container = scrollRef.current;
    if (!container) return;

    setActiveGroup(groupId);
    if (jumpAnim.current !== null) cancelAnimationFrame(jumpAnim.current);
    jumping.current = true;
    setForcedIndex(index);
    pinSection(index);

    const from = container.scrollTop;
    const startedAt = performance.now();
    const SETTLE = 1500;
    const pad = parseFloat(getComputedStyle(container).paddingTop) || 0;

    const clamp = (offset: number) =>
      Math.min(Math.max(0, offset), Math.max(0, container.scrollHeight - container.clientHeight));

    const modelOffset = () => clamp(virtualizer.getOffsetForIndex(index, 'start')?.[0] ?? from);
    const initialTarget = modelOffset;

    /** how far the section is from where it should sit, or null if unrendered */
    const realDelta = () => {
      const el = container.querySelector<HTMLElement>(`[data-group-id="${CSS.escape(groupId)}"]`);
      if (!el) return null;
      return el.getBoundingClientRect().top - container.getBoundingClientRect().top - pad;
    };

    // Gliding means physically scrolling THROUGH everything in between, and
    // every frame of that mounts and unmounts whatever the window passes over -
    // which on a 16,000px trip is the entire script, seventeen times. So the
    // glide is kept for short hops, where it reads as connected movement and
    // costs almost nothing, and long jumps cut straight there.
    const glide = Math.abs(initialTarget() - from) <= container.clientHeight * 1.5 ? 240 : 0;

    let settled = 0;

    const step = (now: number) => {
      const elapsed = now - startedAt;

      if (elapsed < glide) {
        const t = elapsed / glide;
        container.scrollTop = from + (modelOffset() - from) * (1 - (1 - t) ** 3);
        jumpAnim.current = requestAnimationFrame(step);
        return;
      }

      const delta = realDelta();
      if (delta === null) {
        // still outside the rendered window - keep pushing at the model
        container.scrollTop = modelOffset();
        settled = 0;
      } else {
        if (Math.abs(delta) >= 1) {
          container.scrollTop = clamp(container.scrollTop + delta);
          settled = 0;
        } else {
          settled += 1;
        }
      }

      if (settled >= 3 || elapsed > glide + SETTLE) {
        jumpAnim.current = null;
        jumping.current = false;
        setForcedIndex(null);
        setHeadingGone(false);
        return;
      }
      jumpAnim.current = requestAnimationFrame(step);
    };

    jumpAnim.current = requestAnimationFrame(step);
  }, [virtualizer, visibleGroups, pinSection]);
  jumpToRef.current = jumpTo;

  useEffect(() => () => {
    if (jumpAnim.current !== null) cancelAnimationFrame(jumpAnim.current);
    // MUST clear the flag, not just the frame. onScroll ignores events while a
    // jump is in flight, so a jump interrupted by leaving the pane (clicking a
    // page, switching script) left it stuck true and the rail stopped tracking
    // the scroll position entirely until a reload.
    jumping.current = false;
  }, []);

  // Same hazard when the pane itself remounts: the flag outlives the animation.
  useEffect(() => {
    jumping.current = false;
  }, [activeResource, activePage]);

  // Stable per-entry handler, otherwise memo(SettingRow) never hits and every
  // keystroke re-renders all ~108 rows.
  const openPicker = useCallback((entry: SettingEntry) => setPickerEntry(entry), []);

  const dirty = script ? dirtyCount(script.resource) : 0;
  // Recomputed whenever the draft moves, so an error clears as it is fixed
  // rather than at the next save attempt.
  const draftForScript = useStudio((state) => (script ? state.draft[script.resource] : undefined));
  const problems = useMemo(
    () => (script ? problemsFor(script.resource) : []),
    [script, draftForScript],
  );
  const problemsByPath = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of problems) {
      const list = map.get(problem.path) ?? [];
      list.push(problem.message);
      map.set(problem.path, list);
    }
    return map;
  }, [problems]);

  const undoDepth = useStudio((state) => (script ? state.undoStack[script.resource]?.length ?? 0 : 0));
  const redoDepth = useStudio((state) => (script ? state.redoStack[script.resource]?.length ?? 0 : 0));

  if (!script) return null;

  // The panel's BOX - not its entrance. Framer only applies keys listed in
  // `initial` on the first paint, so anything that lives solely in `animate`
  // is missing from the frame the browser shows first. With width/height/
  // background only in `animate`, that first frame was a panel with no size
  // and no background, and the only child painting anything was the sidebar:
  // a skinny, faint-black, full-height strip down the left. Same values in
  // both, so the first paint is already the right shape and only scale and
  // opacity animate - and toggling full screen still animates, because
  // `animate` recomputes while `initial` is mount-only.
  const panelBox = {
    width: fullScreen ? '100vw' : 'min(152vh, 96vw)',
    height: fullScreen ? '100vh' : '84vh',
    // No backdrop-filter: CEF renders it unreliably over the game, so the
    // panel stays near-opaque and the dim behind does the separating.
    backgroundColor: alpha(theme.colors.dark[9], fullScreen ? 0.93 : 0.97),
    borderRadius: fullScreen ? 0 : 6,
  };
  const dim = fullScreen ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, backgroundColor: dim }}
          animate={{ opacity: 1, backgroundColor: dim }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0, ...panelBox }}
            animate={{ scale: 1, opacity: 1, ...panelBox }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              display: 'flex', flexDirection: 'column',
              border: fullScreen ? 'none' : `0.1vh solid ${alpha(theme.colors.dark[6], 0.9)}`,
              boxShadow: fullScreen ? 'none' : '0 3vh 9vh rgba(0,0,0,0.65)',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            <Header
              script={script}
              page={activePage ? PAGES.find((entry) => entry.id === activePage) : undefined}
              query={search}
              onQuery={(v) => useStudio.setState({ search: v })}
              onClose={handleClose}
              onHistory={() => setHistoryOpen(true)}
              onJson={() => setJsonOpen(true)}
              missingItems={activePage ? undefined : <MissingItemsButton script={script} />}
              onReset={() => setResetOpen(true)}
              canEdit={canEdit}
            />

            <Flex flex={1} style={{ minHeight: 0 }}>
              {/* The rail drops ONLY while a design is open in the editor. Browsing
                  designs is an ordinary page and keeps it — the canvas is the one
                  thing that genuinely needs the width, and nobody browses settings
                  mid-design. The breadcrumb inside DesignPage is the way back. */}
              {!editingDesign && (
              <Sidebar
                scripts={scripts}
                script={script}
                groupLabels={groupLabels}
                visibleGroups={visibleGroups}
                byGroup={byGroup}
                modifiedByGroup={modifiedByGroup}
                activeGroup={activeGroup}
                activePage={activePage}
                onPickScript={(resource) => startTransition(() => useStudio.setState({ activeResource: resource, activePage: null, editingDesign: null }))}
                onPickPage={(id) => startTransition(() => useStudio.setState({ activePage: id, editingDesign: null }))}
                onPickGroup={jumpTo}
                onHoverGroup={prefetchSection}
                onLeaveGroup={cancelPrefetch}
              />
              )}

              <Flex direction="column" flex={1} style={{ minHeight: 0, position: 'relative' }}>
                {activePage === 'home' ? <HomePage />
                  : activePage === 'bridges' ? <BridgesPage />
                  : activePage === 'admins' ? <AdminsPage canEdit={canEdit} />
                  : activePage === 'logs' ? <LogsPage canEdit={canEdit} />
                  : activePage === 'items' ? <CataloguePage kind="items" query={query} />
                  : activePage === 'vehicles' ? <CataloguePage kind="vehicles" query={query} />
                  : activePage === 'design' ? <DesignPage resource={activeResource} />
                  : activePage === 'minigames' ? <MinigamesPage />
                  : activePage ? (
                  <Flex align="center" justify="center" style={{ flex: 1 }}>
                    <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.35)">
                      {activePage} page is not built yet
                    </Text>
                  </Flex>
                ) : (<>
                <CurrentSection
                  group={(() => {
                    const found = visibleGroups.find((g) => g.id === activeGroup) ?? visibleGroups[0];
                    return found ? localisedGroup(found) : undefined;
                  })()}
                  show={headingGone}
                />

                <Flex
                  ref={scrollRef as never}
                  className="studio-scroll"
                  direction="column"
                  flex={1}
                  gap="xl"
                  p="md"
                  style={{
                    overflowY: 'auto',
                    minHeight: 0,
                    position: 'relative',
                    scrollPaddingTop: '1.2vh',
                    // no `scrollBehavior: smooth` - jumpTo animates scrollTop
                    // itself, and the CSS glide fought every correction
                  }}
                >
                  {visibleGroups.length === 0 && (
                    <Flex direction="column" align="center" justify="center" gap="xs" style={{ flex: 1, paddingTop: '18vh' }}>
                      <Search size="3vh" color="rgba(255,255,255,0.18)" />
                      <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.4)">
                        Nothing matches "{query}"
                      </Text>
                      <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.25)">
                        Search covers names, paths, descriptions and options.
                      </Text>
                    </Flex>
                  )}

                  <Flex
                    direction="column"
                    style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}
                  >
                  {items.map((item) => {
                    const group = visibleGroups[item.index];
                    if (!group) return null;
                    return (
                    <Flex
                      key={group.id}
                      ref={((el: HTMLDivElement | null) => {
                        sectionRefs.current[group.id] = el;
                        if (el) virtualizer.measureElement(el);
                      }) as never}
                      data-index={item.index}
                      data-group-id={group.id}
                      direction="column"
                      gap="xs"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${item.start}px)`,
                        paddingBottom: '3vh',
                      }}
                    >
                      {/* flex-start, not center: a three-line description was
                          dragging the icon and title down to the middle of it,
                          so the heading stopped reading as a heading. */}
                      <Flex align="flex-start" gap="xs" mb="0.4vh">
                        <Icon name={group.icon} size="1.9vh" color={color} />
                        <Text
                          ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)" lts="0.01em"
                          style={{ flexShrink: 0 }}
                        >
                          {localisedGroup(group).label}
                        </Text>
                        {group.description && (
                          <Text
                            ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)"
                            style={{ marginTop: '0.35vh', flex: 1, minWidth: 0 }}
                          >
                            {localisedGroup(group).description}
                          </Text>
                        )}
                      </Flex>

                      <SectionBody
                        resource={script.resource}
                        entries={byGroup.get(group.id) ?? []}
                        query={query}
                        renderRow={(entry, rowFilter) => (
                          <SettingRow
                            resource={script.resource}
                            entry={entry}
                            query={query}
                            rowFilter={rowFilter}
                            canEdit={canEdit}
                            problems={problemsByPath.get(entry.path)}
                            onDrill={openPicker}
                          />
                        )}
                      />

                      {/* Anything a schema walk cannot produce for this block */}
                      {(() => {
                        const Extra = SECTION_EXTRAS[`${script.resource}:${group.id}`];
                        return Extra ? <Extra resource={script.resource} canEdit={canEdit} /> : null;
                      })()}
                    </Flex>
                    );
                  })}
                  </Flex>

                </Flex>

                </>)}

                {!activePage && <SaveBar
                  dirty={dirty}
                  saving={saving}
                  canEdit={canEdit}
                  problems={problems}
                  onShowProblem={(problem) => jumpTo(problem.group)}
                  canUndo={undoDepth > 0}
                  canRedo={redoDepth > 0}
                  onUndo={() => undo(script.resource)}
                  onRedo={() => redo(script.resource)}
                  onDiscard={() => discardDraft(script.resource)}
                  onSave={() => commitDraft(script.resource)}
                />}
              </Flex>
            </Flex>
          </motion.div>

          <AnimatePresence>
            {pickerEntry && (
              <PickerDrawer
                type={pickerEntry.type}
                label={pickerEntry.label}
                help={pickerEntry.help}
                value={effectiveValue(script.resource, pickerEntry)}
                disabled={!canEdit}
                onApply={(next) => setValue(script.resource, pickerEntry, next)}
                onClose={() => setPickerEntry(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {jsonOpen && (
              <JsonModal
                script={script}
                canEdit={canEdit}
                onClose={() => setJsonOpen(false)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {historyOpen && (
              <HistoryModal
                resource={activePage ? 'dirk_lib' : script.resource}
                canEdit={canEdit}
                onRevert={(changes) => {
                  for (const change of changes) {
                    const entry = script.entries.find((e) => e.path === change.path);
                    if (entry) setValue(script.resource, entry, change.value);
                  }
                  setHistoryOpen(false);
                }}
                onClose={() => setHistoryOpen(false)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {resetOpen && (
              <ConfirmModal
                title="Factory reset"
                description={`Every setting in ${script.label} goes back to how it shipped. Type the resource name to confirm — this stages the reset, you still have to save.`}
                confirmLabel="Reset everything"
                confirmText={script.resource}
                onConfirm={() => { factoryReset(script.resource); setResetOpen(false); }}
                onClose={() => setResetOpen(false)}
                zIndex={10200}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The section you are currently reading, pinned above the scroll area rather
 * than inside it. Sticky-inside-the-scroller kept leaving a strip where rows
 * showed through the pane's padding; a sibling of the scroller cannot.
 */
function CurrentSection({ group, show }: { group?: SettingGroup; show: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  if (!group) return null;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : -6 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
    <Flex
      align="center" gap="xs"
      px="md" py="sm"
      style={{
        background: theme.colors.dark[9],
        borderBottom: `0.1vh solid ${alpha(theme.colors.dark[6], 0.8)}`,
      }}
    >
      {/* icon + type scale match the in-flow section heading so the bar reads as
          the same thing, just pinned */}
      <Icon name={group.icon} size="1.9vh" color={color} />
      <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)" lts="0.01em">{group.label}</Text>
      {group.description && (
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)" truncate>
          {group.description}
        </Text>
      )}
    </Flex>
    </motion.div>
  );
}

function Header({
  script, page, query, onQuery, onClose, onHistory, onJson, onReset,
  missingItems, canEdit,
}: {
  script: StudioScript;
  /** set when a built-in page is open, so the header stops naming a script */
  page?: { id: string; label: string; icon: string };
  query: string;
  onQuery: (v: string) => void;
  onClose: () => void;
  onHistory: () => void;
  onJson: () => void;
  onReset: () => void;
  missingItems?: React.ReactNode;
  canEdit: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  // Local input state so a keystroke never waits on the panel-wide filter.
  const [local, setLocal] = useState(query);
  useEffect(() => { setLocal(query); }, [query]);

  return (
    <Flex
      align="center" justify="space-between" gap="md"
      px="md" py="sm"
      style={{
        borderBottom: `0.1vh solid ${alpha(theme.colors.dark[6], 0.8)}`,
        background: alpha(theme.colors.dark[8], 0.5),
        flexShrink: 0,
      }}
    >
      <Flex align="center" gap="sm" style={{ width: '32vh', minWidth: 0 }}>
        <Flex
          align="center" justify="center"
          style={{
            aspectRatio: '1 / 1',
            height: '4.4vh',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: theme.radius.xs,
            outline: `0.2vh solid ${alpha(theme.colors[theme.primaryColor][9], 0.8)}`,
            boxShadow: `inset 0 0 2vh ${alpha(theme.colors[theme.primaryColor][7], 0.5)}`,
            flexShrink: 0,
          }}
        >
          <Icon name={page?.icon ?? script.icon} size="2.2vh" color={color} />
        </Flex>
        <Flex direction="column" style={{ minWidth: 0, lineHeight: 1.15 }}>
          <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)" truncate>
            {page?.label ?? script.label}
          </Text>
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)" truncate>
            {page ? 'dirk_lib' : script.resource}
          </Text>
        </Flex>
      </Flex>

      {/* Pages that own their filtering (Logs, Admins, Bridges) get a blank
          space here instead: two search boxes on one screen is a question about
          which one you are typing into. */}
      {!SEARCHABLE_PAGES.has(page?.id ?? '') ? (
        <Flex style={{ flex: 1, maxWidth: '54vh' }} />
      ) : (
      <TextInput
        value={local}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setLocal(next);              // paints immediately
          startTransition(() => onQuery(next));  // filtering yields to typing
        }}
        placeholder={page?.id === 'items' ? 'Search items...'
          : page?.id === 'vehicles' ? 'Search vehicles...'
            : 'Search these settings...'}
        leftSection={<Search size="1.6vh" color="rgba(255,255,255,0.35)" />}
        rightSection={local ? (
          <motion.button
            type="button"
            onClick={() => { setLocal(''); startTransition(() => onQuery('')); }}
            whileTap={{ scale: 0.85 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            }}
            aria-label="Clear search"
          >
            <X size="1.5vh" color="rgba(255,255,255,0.45)" />
          </motion.button>
        ) : null}
        styles={{
          input: {
            background: alpha(theme.colors.dark[9], 0.8),
            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'Akrobat SemiBold',
            fontSize: '1.5vh',
            height: '3.6vh',
            minHeight: '3.6vh',
            borderRadius: theme.radius.xs,
            // the icon sits in a 4.2vh well; without matching padding the
            // caret starts almost touching it
            paddingLeft: '4.2vh',
            paddingRight: '3.8vh',
          },
          section: { width: '4.2vh' },
        }}
        style={{ flex: 1, maxWidth: '54vh' }}
      />
      )}

      <Flex align="center" gap="xs" justify="flex-end" style={{ width: '32vh' }}>
        {!canEdit && (
          <Flex
            align="center" gap="xxs" px="0.8vh" py="0.3vh"
            style={{
              background: alpha('#E0B15F', 0.14),
              border: `0.1vh solid ${alpha('#E0B15F', 0.4)}`,
              borderRadius: '0.3vh',
            }}
          >
            <Lock size="1.2vh" color="#E0B15F" />
            <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c="#E0B15F">View only</Text>
          </Flex>
        )}
        {missingItems}
        {!page && <IconButton icon={Braces} label="View or import JSON" onClick={onJson} />}
        <IconButton icon={History} label="Change history" onClick={onHistory} />
        <IconButton icon={RotateCcw} label="Reset everything to defaults" danger onClick={canEdit ? onReset : undefined} />
        <IconButton icon={RefreshCw} label="Refresh from server" />
        <IconButton icon={X} label="Close" danger onClick={onClose} />
      </Flex>
    </Flex>
  );
}

function IconButton({
  icon: Cmp, label, onClick, danger,
}: { icon: React.ElementType; label: string; onClick?: () => void; danger?: boolean }) {
  const theme = useMantineTheme();
  const accent = danger ? '#ef4444' : theme.colors[theme.primaryColor][5];

  return (
    <Tooltip
      label={label}
      position="bottom"
      withArrow
      zIndex={10000}
      styles={{
        tooltip: {
          background: alpha(theme.colors.dark[7], 0.95),
          border: '0.1vh solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.75)',
          fontFamily: 'Akrobat Bold',
          fontSize: '1.2vh',
          padding: '0.5vh 0.8vh',
        },
      }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ background: alpha(accent, 0.16), borderColor: alpha(accent, 0.5) }}
        whileTap={{ scale: 0.95 }}
        style={{
          aspectRatio: '1 / 1', height: '3.4vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent',
          border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
          borderRadius: theme.radius.xs,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.65)',
        }}
        aria-label={label}
      >
        <Cmp size="1.7vh" />
      </motion.button>
    </Tooltip>
  );
}

/**
 * Extra UI a section needs that its fields cannot express - the beginnings of
 * the x-section registry. Keyed `resource:group` so two scripts can use the
 * same block name without colliding.
 *
 * A bot token is the case that forces this: no arrangement of inputs can tell
 * you whether the credential you pasted actually works, so the block gets a
 * test button and the six steps for obtaining one.
 */
const SECTION_EXTRAS: Record<string, React.ComponentType<{ resource: string; canEdit: boolean }>> = {
  'dirk_lib:discord': DiscordSetup,
};

/** Which views the header's search box actually drives. */
const SEARCHABLE_PAGES = new Set(['', 'items', 'vehicles']);

/** One of the shared layer's sections, sitting straight under GENERIC. */
function SharedSectionRow({
  group, label, count, active, onClick,
}: {
  resource: string;
  group: SettingGroup;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.8vh',
        padding: '0.7vh 0.8vh',
        background: active ? alpha(color, 0.14) : 'transparent',
        border: 'none',
        borderLeft: `0.2vh solid ${active ? color : 'transparent'}`,
        borderRadius: `0 ${theme.radius.xs} ${theme.radius.xs} 0`,
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <Icon name={group.icon} size="1.6vh" color={active ? color : 'rgba(255,255,255,0.4)'} />
      <Text
        ff="Akrobat SemiBold" size="sm"
        c={active ? color : 'rgba(255,255,255,0.7)'}
        style={{ flex: 1, minWidth: 0 }}
        truncate
      >
        {label}
      </Text>
      <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">{count}</Text>
    </motion.button>
  );
}

const PAGES: { id: string; label: string; icon: string; band: 'access' | 'library' }[] = [
  { id: 'admins', label: 'Admins', icon: 'users', band: 'access' },
  { id: 'logs', label: 'Logs', icon: 'scroll-text', band: 'access' },
  { id: 'bridges', label: 'Bridges', icon: 'plug', band: 'access' },
  { id: 'items', label: 'Items', icon: 'package', band: 'library' },
  { id: 'vehicles', label: 'Vehicles', icon: 'car', band: 'library' },
  { id: 'minigames', label: 'Minigames', icon: 'gamepad', band: 'library' },
];

/**
 * Grouped rail: the scripts you configure, the shared layer, and the pages that
 * are about the server rather than any one script. Separate bands stop
 * "Bridges" reading like one more fishing section.
 */
function Sidebar({
  scripts, script, groupLabels, visibleGroups, byGroup, modifiedByGroup, activeGroup, activePage,
  onPickScript, onPickPage, onPickGroup, onHoverGroup, onLeaveGroup,
}: {
  scripts: StudioScript[];
  script: StudioScript;
  groupLabels: Map<string, string>;
  visibleGroups: SettingGroup[];
  byGroup: Map<string, SettingEntry[]>;
  modifiedByGroup: Map<string, number>;
  activeGroup: string;
  activePage: string | null;
  onPickScript: (resource: string) => void;
  onPickPage: (id: string) => void;
  onPickGroup: (groupId: string) => void;
  onHoverGroup: (index: number) => void;
  onLeaveGroup: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const userScripts = useMemo(() => scripts.filter((entry) => !entry.shared), [scripts]);
  const sharedScripts = useMemo(() => scripts.filter((entry) => entry.shared), [scripts]);

  const renderScript = (entry: StudioScript) => {
    // Design is a page BELONGING to this script, not a global one like Admins or
    // Items — so the script stays expanded while you are on it and the tree does
    // not collapse under you. Global pages still collapse everything, which is
    // right: they have nothing to do with the selected script.
    const active =
      entry.resource === script.resource && (!activePage || activePage === 'design');
    return (
      <Flex key={entry.resource} direction="column" gap="xxs">
        <motion.button
          type="button"
          onClick={() => onPickScript(entry.resource)}
          whileTap={{ scale: 0.99 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.8vh',
            padding: '0.75vh 0.8vh',
            background: active ? alpha(color, 0.14) : 'transparent',
            border: 'none',
            borderLeft: `0.2vh solid ${active ? color : 'transparent'}`,
            borderRadius: `0 ${theme.radius.xs} ${theme.radius.xs} 0`,
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}
        >
          <Icon name={entry.icon} size="1.7vh" color={active ? color : 'rgba(255,255,255,0.4)'} />
          <Text
            ff="Akrobat Bold" size="sm" tt="uppercase" lts="0.05em"
            c={active ? color : 'rgba(255,255,255,0.75)'}
            style={{ flex: 1, minWidth: 0 }}
            truncate
          >
            {entry.label}
          </Text>
        </motion.button>

        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <Flex direction="column" gap="0.15vh" pl="1.6vh" pb="0.4vh">
                                {/* Design leads the script's own groups — it is what you opened the
                    script for, and the settings below it are what you tune after.
                    It stays inside the script rather than in the global ACCESS /
                    LIBRARY bands because designs belong to a script: dirk_loading's
                    are not dirk_multichar's. Only shown for scripts declaring one. */}
                {entry.designs && (
                  <motion.button
                    type="button"
                    onClick={() => onPickPage('design')}
                    whileTap={{ scale: 0.99 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.7vh',
                      padding: '0.5vh 0.7vh',
                      background: activePage === 'design' ? alpha(color, 0.1) : 'transparent',
                      border: 'none',
                      borderRadius: theme.radius.xs,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <Icon name="layout" size="1.4vh" color={color} />
                    <Text ff="Akrobat SemiBold" size="sm" c={color} style={{ flex: 1, minWidth: 0 }} truncate>
                      Design
                    </Text>
                    <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">5</Text>
                  </motion.button>
                )}

                {visibleGroups.map((group, groupIndex) => {
                  // activeGroup tracks whatever section the settings pane is
                  // scrolled to, and it keeps that value while a full page is
                  // open — so without this guard, Design and Backgrounds would
                  // both read as selected at once.
                  const isActive = !activePage && group.id === activeGroup;
                  const count = byGroup.get(group.id)?.length ?? 0;
                  const modified = modifiedByGroup.get(group.id) ?? 0;
                  return (
                    <motion.button
                      key={group.id}
                      type="button"
                      onClick={() => onPickGroup(group.id)}
                      // start rendering the destination while the pointer is
                      // still on its way to the click
                      onPointerEnter={() => onHoverGroup(groupIndex)}
                      onPointerLeave={onLeaveGroup}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.7vh',
                        padding: '0.5vh 0.7vh',
                        background: isActive ? alpha(color, 0.1) : 'transparent',
                        border: 'none',
                        borderRadius: theme.radius.xs,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <Icon name={group.icon} size="1.4vh" color={isActive ? color : 'rgba(255,255,255,0.3)'} />
                      <Text
                        ff="Akrobat SemiBold" size="sm"
                        c={isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'}
                        style={{ flex: 1, minWidth: 0 }}
                        truncate
                      >
                        {groupLabels.get(group.id) ?? group.label}
                      </Text>
                      <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">{count}</Text>
                      {modified > 0 && (
                        <Flex w="0.6vh" h="0.6vh" style={{ background: color, borderRadius: '50%', flexShrink: 0 }} />
                      )}
                    </motion.button>
                  );
                })}
              </Flex>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>
    );
  };

  const renderPage = (page: { id: string; label: string; icon: string }) => {
    const active = activePage === page.id;
    return (
      <motion.button
        key={page.id}
        type="button"
        onClick={() => onPickPage(page.id)}
        whileTap={{ scale: 0.99 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.8vh',
          padding: '0.7vh 0.8vh',
          background: active ? alpha(color, 0.14) : 'transparent',
          border: 'none',
          borderLeft: `0.2vh solid ${active ? color : 'transparent'}`,
          borderRadius: `0 ${theme.radius.xs} ${theme.radius.xs} 0`,
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
      >
        <Icon name={page.icon} size="1.6vh" color={active ? color : 'rgba(255,255,255,0.4)'} />
        <Text
          ff="Akrobat SemiBold" size="sm"
          c={active ? color : 'rgba(255,255,255,0.7)'}
          style={{ flex: 1, minWidth: 0 }}
        >
          {page.label}
        </Text>
      </motion.button>
    );
  };

  return (
    <Flex
      direction="column"
      w="28vh"
      style={{
        borderRight: `0.1vh solid ${alpha(theme.colors.dark[6], 0.8)}`,
        background: alpha(theme.colors.dark[8], 0.35),
        flexShrink: 0,
        minHeight: 0,
      }}
    >
      <Flex
        direction="column" gap="xxs" px="xs" pt="xs"
        className="studio-scroll"
        style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
      >
        {/* Band-less and first: Overview is the way back to where /dirk_config
            lands, not a member of any category. */}
        {renderPage({ id: 'home', label: 'Overview', icon: 'home' })}

        <RailLabel>Scripts</RailLabel>
        {userScripts.map(renderScript)}

        {/* GENERIC is the shared layer, and there is only ever one shared
            script — so listing it as a script you must click, inside a band
            with exactly one child, was a level of nesting that bought nothing.
            Its sections sit directly under the band instead. */}
        {sharedScripts.length > 0 && (
          <>
            <RailLabel>Generic</RailLabel>
            {sharedScripts.map((entry) => (
              <Fragment key={entry.resource}>
                {entry.groups.map((group) => (
                  <SharedSectionRow
                    key={`${entry.resource}:${group.id}`}
                    resource={entry.resource}
                    group={group}
                    label={groupLabels.get(group.id) ?? group.label}
                    count={entry.entries.filter((e) => e.group === group.id).length}
                    active={!activePage && script.resource === entry.resource && activeGroup === group.id}
                    onClick={() => {
                      if (script.resource !== entry.resource) {
                        onPickScript(entry.resource);
                        // the pane has to mount before it can be scrolled
                        setTimeout(() => onPickGroup(group.id), 60);
                      } else {
                        onPickGroup(group.id);
                      }
                    }}
                  />
                ))}
              </Fragment>
            ))}
          </>
        )}

        <RailLabel>Access</RailLabel>
        {PAGES.filter((page) => page.band === 'access').map(renderPage)}

        <RailLabel>Library</RailLabel>
        {PAGES.filter((page) => page.band === 'library').map(renderPage)}
      </Flex>

      <Flex
        align="center" justify="space-between" px="sm" py="xs"
        style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[6], 0.7)}`, flexShrink: 0 }}
      >
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.28)" truncate>{script.resource}</Text>
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.28)">v{script.version}</Text>
      </Flex>
    </Flex>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.16em"
      c="rgba(255,255,255,0.28)" px="0.6vh" pt="xs" pb="0.2vh"
    >
      {children}
    </Text>
  );
}

const SettingRow = memo(function SettingRow({
  resource, entry, query, rowFilter, canEdit: allowed, problems, onDrill,
}: {
  resource: string;
  entry: SettingEntry;
  query: string;
  /** what is wrong with this setting's current value, if anything */
  problems?: string[];
  /** search text applied to the rows of a list, not just its label */
  rowFilter?: string;
  canEdit: boolean;
  onDrill: (entry: SettingEntry) => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  // subscribing to the draft keeps this row live as the value changes
  const staged = useStudio((s) => s.draft[resource]?.[entry.path]);
  // ...and keeps the master-switch check live too: flipping `theme.useOverride`
  // greys its block immediately rather than after a save.
  const gate = useStudio((s) => (entry.enabledWhen ? s.draft[resource]?.[entry.enabledWhen.path] : undefined));
  const live = entry.enabledWhen ? isEnabled(resource, entry) : true;
  void gate;

  // A setting its master switch has turned off is read-only for the same
  // reason a view-only admin's is: editing it would change nothing.
  const canEdit = allowed && live;
  // Label and help come from the owning script's bundle, with the schema's
  // English as the fallback - so a script needs no translations to work.
  const language = useActiveLanguage();
  const bundles = useBundles();
  const label = translate(bundles, language, resource, settingKey(entry.path, 'label'), entry.label);
  const help = entry.help
    ? translate(bundles, language, resource, settingKey(entry.path, 'description'), entry.help)
    : undefined;
  const value = effectiveValue(resource, entry);
  const modified = isModified(resource, entry);
  const wide = isWideType(entry.type);

  return (
    <Flex
      direction={wide ? 'column' : 'row'}
      align={wide ? 'stretch' : 'center'}
      justify="space-between"
      gap="sm"
      px="sm" py="xs"
      style={{
        background: alpha(theme.colors.dark[8], staged ? 0.75 : 0.45),
        border: `0.1vh solid ${problems?.length
          ? alpha('#ef4444', 0.6)
          : staged ? alpha(color, 0.35) : alpha(theme.colors.dark[5], 0.35)}`,
        borderRadius: theme.radius.xs,
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
        position: wide ? 'relative' : undefined,
        // Dimmed rather than hidden: knowing the setting exists and why it is
        // inert is the useful part. Hiding it just makes people hunt for it.
        opacity: live ? 1 : 0.42,
      }}
    >
      <Flex direction="column" gap="0.2vh" style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap="xs" wrap="wrap">
          <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.9)">
            <Highlight text={label} query={query} />
          </Text>

          {modified && (
            <Chip label="Modified" color={color} dot />
          )}
          {entry.restartRequired && (
            <Chip label="Restart required" color="#E0B15F" icon={RotateCcw} />
          )}
          {entry.serverOnly && (
            <Chip label="Server only" color="#4CC3DE" icon={Lock} />
          )}
        </Flex>

        {help && (
          <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.45)" style={{ maxWidth: '82vh' }}>
            <Highlight text={help} query={query} />
          </Text>
        )}

        <Flex align="center" gap="xs">
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.22)">
            <Highlight text={entry.path} query={query} />
          </Text>
          {modified && (
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">
              default: {formatDefault(entry.default)}
            </Text>
          )}
          {problems?.map((problem) => (
            <Flex key={problem} align="center" gap="0.4vh">
              <AlertTriangle size="1.1vh" color="#ef4444" />
              <Text ff="Akrobat Bold" size="xxs" c="#ef4444">{problem}</Text>
            </Flex>
          ))}
          {!live && entry.enabledWhen && (
            <Flex align="center" gap="0.4vh">
              <Lock size="1.1vh" color="#E0B15F" />
              <Text ff="Akrobat SemiBold" size="xxs" c="#E0B15F">
                needs {entry.enabledWhen.path} {formatDefault(entry.enabledWhen.equals)}
              </Text>
            </Flex>
          )}
        </Flex>
      </Flex>

      <Flex
        align="center" gap="xs"
        justify="flex-end"
        style={{ flexShrink: 0, position: wide ? 'absolute' : 'static', top: '1vh', right: '1vh' }}
      >
        {!wide && (
          <SettingControl
            type={entry.type}
            entry={entry}
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
            onDrill={opensPicker(entry.type) ? () => onDrill(entry) : undefined}
          />
        )}

        <Flex w="3vh" justify="flex-end" style={{ flexShrink: 0 }}>
          {modified && canEdit && (
            <Tooltip
              label="Back to default"
              position="top"
              withArrow
              zIndex={10000}
              styles={{
                tooltip: {
                  background: alpha(theme.colors.dark[7], 0.95),
                  border: '0.1vh solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'Akrobat Bold',
                  fontSize: '1.2vh',
                  padding: '0.5vh 0.8vh',
                },
              }}
            >
              <motion.button
                type="button"
                onClick={() => revertToDefault(resource, entry)}
                whileHover={{ background: alpha(color, 0.16), borderColor: alpha(color, 0.5) }}
                whileTap={{ scale: 0.94 }}
                style={{
                  aspectRatio: '1 / 1', height: '3vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                  borderRadius: theme.radius.xs,
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.55)',
                }}
                aria-label="Back to default"
              >
                <ListRestart size="1.5vh" />
              </motion.button>
            </Tooltip>
          )}
        </Flex>
      </Flex>

      {wide && (
        entry.type === 'weightMap' ? (
          <WeightMapControl
            resource={resource}
            value={value}
            disabled={!canEdit}
            min={entry.min}
            max={entry.max}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'positions' ? (
          <PositionListControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'weekdays' ? (
          <WeekdayControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'refs' ? (
          <RefListControl
            resource={resource}
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'groupGrades' ? (
          <GroupGradeControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'keybindMap' ? (
          <KeybindMapControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'mantineColor' ? (
          <MantineColorControl
            value={value}
            resource={resource}
            path={entry.path}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'shade' ? (
          <ShadeControl
            value={value}
            resource={resource}
            path={entry.path}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'keyvalue' ? (
          <KeyValueControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'groups' ? (
          <GroupsControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'controls' ? (
          <ControlsControl
            value={value}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : entry.type === 'palette' ? (
          <PaletteControl
            shades={(value as string[]) ?? []}
            disabled={!canEdit}
            onChange={(next) => setValue(resource, entry, next)}
          />
        ) : (
          <ListRows
            entry={entry}
            resource={resource}
            rows={(value as Record<string, unknown>[]) ?? []}
            disabled={!canEdit}
            rowFilter={rowFilter}
            onChange={(next) => setValue(resource, entry, next)}
          />
        )
      )}
    </Flex>
  );
});

function SaveBar({
  dirty, saving, canEdit, onDiscard, onSave, onUndo, onRedo, canUndo, canRedo,
  problems, onShowProblem,
}: {
  dirty: number;
  saving: boolean;
  canEdit: boolean;
  problems: { path: string; label: string; group: string; message: string }[];
  onShowProblem: (problem: { group: string }) => void;
  onDiscard: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex
      align="center" justify="space-between"
      px="md" py="xs"
      style={{
        borderTop: `0.1vh solid ${alpha(theme.colors.dark[6], 0.8)}`,
        background: alpha(theme.colors.dark[8], 0.5),
        flexShrink: 0,
        minHeight: '5.2vh',
      }}
    >
      <Flex align="center" gap="xs" style={{ minWidth: 0, flex: 1 }}>
        <AnimatePresence mode="wait">
          {problems.length > 0 ? (
            <motion.div
              key="problems"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.7vh', minWidth: 0 }}
            >
              <AlertTriangle size="1.5vh" color="#ef4444" />
              <Text ff="Akrobat Bold" size="xs" c="#ef4444" style={{ flexShrink: 0 }}>
                {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
              </Text>
              {/* name the first one and offer to go there - a count alone
                  leaves you hunting through twenty sections */}
              <motion.button
                type="button"
                onClick={() => onShowProblem(problems[0]!)}
                whileHover={{ opacity: 1 }}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  cursor: 'pointer', opacity: 0.75, minWidth: 0, textAlign: 'left',
                }}
              >
                <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.6)" truncate>
                  {problems[0]!.label}: {problems[0]!.message} →
                </Text>
              </motion.button>
            </motion.div>
          ) : dirty > 0 ? (
            <motion.div
              key="dirty"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.7vh' }}
            >
              <Flex w="0.7vh" h="0.7vh" style={{ background: color, borderRadius: '50%' }} />
              <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.8)">
                {dirty} unsaved {dirty === 1 ? 'change' : 'changes'}
              </Text>
            </motion.div>
          ) : (
            <motion.div
              key="clean"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">
                Changes are staged until you save.
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>

      <Flex align="center" gap="xs">
        {/* Step back and forward through staged edits, as the old config panel
            did. Sits beside Discard because it is the same kind of decision -
            what happens to what you have changed but not yet saved. */}
        <StepButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo || saving || !canEdit} />
        <StepButton icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo || saving || !canEdit} />

        <Flex w="0.1vh" h="2.4vh" style={{ background: alpha(theme.colors.dark[4], 0.6), flexShrink: 0 }} />

        <StudioButton label="Discard" onClick={onDiscard} disabled={dirty === 0 || saving} />
        <StudioButton
          label={saving ? 'Saving...' : 'Save changes'}
          primary
          onClick={onSave}
          disabled={dirty === 0 || saving || !canEdit || problems.length > 0}
        />
      </Flex>
    </Flex>
  );
}

/** Square icon button sized to sit in the row of StudioButtons. */
function StepButton({
  icon: Icon, label, onClick, disabled,
}: { icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Tooltip
      label={label}
      position="top"
      withArrow
      zIndex={10000}
      styles={{
        tooltip: {
          background: alpha(theme.colors.dark[7], 0.95),
          border: '0.1vh solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.75)',
          fontFamily: 'Akrobat Bold',
          fontSize: '1.2vh',
          padding: '0.5vh 0.8vh',
        },
      }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? undefined : { background: alpha(color, 0.14) }}
        whileTap={disabled ? undefined : { scale: 0.94 }}
        style={{
          aspectRatio: '1 / 1', height: '3.2vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent',
          border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
          borderRadius: theme.radius.xs,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          flexShrink: 0,
        }}
        aria-label={label}
      >
        <Icon size="1.5vh" color="rgba(255,255,255,0.7)" />
      </motion.button>
    </Tooltip>
  );
}

function formatDefault(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (Array.isArray(value)) return `${value.length} entries`;
  if (typeof value === 'object') {
    const c = value as { x?: number; y?: number; z?: number };
    if (typeof c.x === 'number') return `${c.x.toFixed(1)}, ${c.y?.toFixed(1)}, ${c.z?.toFixed(1)}`;
    return 'object';
  }
  return String(value) || 'empty';
}
