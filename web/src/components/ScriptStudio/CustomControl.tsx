import * as mantine from '@mantine/core';
import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import * as cfxReact from 'dirk-cfx-react';
import { PANE_HEIGHT } from './Controls';
import { fetchNui, copyToClipboard } from 'dirk-cfx-react';
import * as motion from 'framer-motion';
import { motion as m } from 'framer-motion';
import * as leaflet from 'leaflet';
import * as lucide from 'lucide-react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import * as React from 'react';
import * as reactDom from 'react-dom';
import { useEffect, useState } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactLeaflet from 'react-leaflet';

/**
 * A control the OWNING SCRIPT supplies, rendered inline in its section.
 *
 * Built-in controls cover the shapes every script shares. Some things are only
 * meaningful to one script — dirk_phone's places want the phone's own map, with
 * its categories and its pins — and until now there was nowhere for those to
 * go. The alternative was per-script components inside dirk_lib, which is the
 * one thing this design refuses.
 *
 * The Studio is dirk_lib's bundle, so it cannot bundle another resource's
 * component. It can IMPORT one at runtime: `nui://<resource>/<path>` is the
 * same scheme the panel already uses for item images out of ox_inventory, so
 * this is an ordinary dynamic import rather than anything clever.
 *
 * The component builds with React, Mantine and the rest marked external and
 * mapped to `window.__dirkStudio.*`, so it ships as a small file that shares
 * the panel's own React - two copies of React in one page would break hooks.
 *
 * Declared as:
 *   "places": { "x-component": "web/build/studio/places-map.js" }
 *
 * The file default-exports a component taking `{ value, onChange, canEdit }` -
 * the same props ZoneMap already takes per layer.
 */

/**
 * What version of this contract the panel offers.
 *
 * Bump it when a shared dependency changes in a way that could break a
 * component built against the old one - a React or Mantine major. A component
 * can read `window.__dirkStudio.version` and refuse rather than fail halfway
 * through rendering, which is the difference between a clear message and a
 * white panel.
 */
const CONTRACT_VERSION = 3;

/** What a remote component is handed instead of importing it itself. */
function sharedDeps() {
  return {
    version: CONTRACT_VERSION,
    React,
    react: React,
    jsxRuntime,
    'react/jsx-runtime': jsxRuntime,
    mantine,
    '@mantine/core': mantine,
    cfxReact,
    'dirk-cfx-react': cfxReact,
    lucide,
    'lucide-react': lucide,
    motion,
    'framer-motion': motion,
    // react-leaflet is shared for the same reason React is: its hooks read a
    // context that <Map> provides. A component bundling its own copy gets a
    // DIFFERENT context, so useMap() returns null and the panel white-screens
    // rather than failing cleanly. cfx-react re-exports Map/Marker/ZoomControls
    // but not the hooks, so this is the only way to reach them.
    reactLeaflet,
    'react-leaflet': reactLeaflet,
    leaflet,
    // createPortal, for putting a React node inside a leaflet marker.
    // Portalling from a SECOND ReactDOM into a tree this one owns is the same
    // breakage react-leaflet is shared to avoid.
    reactDom,
    'react-dom': reactDom,
  };
}

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; Component: React.ComponentType<CustomProps> }
  | { state: 'failed'; reason: string };

export type CustomProps = {
  value: unknown;
  onChange: (next: unknown) => void;
  canEdit: boolean;
};

// One cache per resource+path: a section re-renders constantly, and evaluating
// a bundle on every render would be absurd.
const CACHE = new Map<string, Promise<React.ComponentType<CustomProps>>>();

function load(resource: string, path: string): Promise<React.ComponentType<CustomProps>> {
  const key = `${resource}:${path}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const pending = (async () => {
    // A bundler that leaves `process.env.NODE_ENV` in its output produces a
    // file that dies on the first line in a browser - "process is not
    // defined" - and every React-adjacent toolchain does it unless told not
    // to. The author should define it away at build time, but one stray
    // reference should not be the difference between an editor and a red box,
    // so a minimal shim stands in. Only ever ADDED, never replacing a real one.
    const w = window as unknown as Record<string, unknown>;
    if (!w.process) w.process = { env: { NODE_ENV: 'production' } };

    // The deps are handed over as one global rather than left to the remote
    // file to import. It cannot import React itself - there is no module
    // resolver in a browser - so it builds with React, Mantine and the rest
    // marked external and mapped to `window.__dirkStudio.*`. That is why the
    // file is ~10KB and not a second copy of React.
    (window as unknown as Record<string, unknown>).__dirkStudio = sharedDeps();

    // A real ES module import, not an eval. dirk_lib's panel already loads
    // assets out of other resources this way (item images come from
    // nui://ox_inventory/web/images/), and a probe component served from
    // dirk_fishing loads through exactly this path.
    const url = `nui://${resource}/${path}`;

    let module_: { default?: React.ComponentType<CustomProps> };
    try {
      module_ = await import(/* @vite-ignore */ url);
    } catch (error) {
      // The browser's message for a failed module fetch is "Failed to fetch
      // dynamically imported module" and nothing else - true, and useless. Lua
      // can actually look: whether the resource is running, whether the path is
      // inside its web build, whether it declares scriptConfig, and whether the
      // file is in its fxmanifest files{}. Ask it, and report THAT.
      throw new Error(await diagnose(resource, path, error));
    }

    const Component = module_?.default;
    if (typeof Component !== 'function') throw new Error('NoDefaultExport');
    return Component;
  })();

  CACHE.set(key, pending);
  // A failure must not be cached forever - a restarted resource should be
  // retried rather than staying broken for the life of the page.
  pending.catch(() => CACHE.delete(key));
  return pending;
}

/**
 * Why did the import fail?
 *
 * Only the Lua side can tell the difference between "that resource is not
 * running" and "you forgot to list the file in fxmanifest files{}", both of
 * which look identical from the browser.
 */
async function diagnose(resource: string, path: string, original: unknown): Promise<string> {
  const reply = await fetchNui<{ ok?: boolean; _error?: string }>(
    'GET_STUDIO_COMPONENT',
    { resource, path },
    { ok: false, _error: 'BrowserPreview' },
  ).catch(() => ({ ok: false, _error: 'NoDiagnosis' }));

  // The file IS readable, so the failure is the import itself - CSP, a syntax
  // error in the bundle, or an import it makes that nothing provides.
  if (reply?.ok) {
    const detail = original instanceof Error ? original.message : String(original);
    return `the file was found but the browser refused it — ${detail}`;
  }
  return reply?._error ?? 'NoDiagnosis';
}

const REASONS: Record<string, string> = {
  NotStarted: 'that resource is not running',
  BadPath: 'the component path is not inside its web build',
  NotAConsumer: 'that resource does not use scriptConfig',
  NotFound: 'the file is not in the resource, or not listed in its fxmanifest files{}',
  NoDefaultExport: 'the file has no default export, or it is not a component',
  BrowserPreview: 'there is no game to load it from',
  NoDiagnosis: 'the server could not say why',
};

export function CustomControl({
  resource, component, value, onChange, canEdit,
}: {
  resource: string;
  component: string;
  value: unknown;
  onChange: (next: unknown) => void;
  canEdit: boolean;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    setLoaded({ state: 'loading' });
    load(resource, component)
      .then((Component) => { if (live) setLoaded({ state: 'ready', Component }); })
      .catch((error: Error) => {
        if (live) setLoaded({ state: 'failed', reason: error.message });
      });
    return () => { live = false; };
  }, [resource, component]);

  if (loaded.state === 'ready') {
    // The component runs INSIDE the panel's React tree - that is what buys it
    // the theme, the fonts and the save bar for free, and it is also why a
    // throw would otherwise take the whole panel down with it. An iframe would
    // isolate it, at the cost of it looking like a foreign window bolted in.
    // This gets the isolation that actually matters without the cost.
    return (
      <StudioFrame>
        <ComponentBoundary resource={resource} component={component}>
          <loaded.Component value={value} onChange={onChange} canEdit={canEdit} />
        </ComponentBoundary>
      </StudioFrame>
    );
  }

  if (loaded.state === 'loading') {
    return (
      <Flex align="center" justify="center" py="lg">
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">
          Loading {resource}&apos;s editor&hellip;
        </Text>
      </Flex>
    );
  }

  // Say which resource, which file and what went wrong - a silent blank space
  // where an editor should be is the worst possible failure here.
  return (
    <Failure
      resource={resource}
      component={component}
      detail={REASONS[loaded.reason] ?? loaded.reason}
      verb="could not be loaded"
    />
  );
}

/**
 * The container a script's own control sits in.
 *
 * The PANEL owns the frame - border, radius, background - and the component
 * renders inside it. Left to themselves, authors draw their own, and the first
 * one drew it in the theme accent, which in this panel already means "staged,
 * unsaved". A section that looks edited when it is not is worse than an ugly
 * one, and consistency across every script is not something each author can be
 * asked to reproduce.
 *
 * Deliberately no padding: a map or a canvas should reach the edges. Anything
 * needing inner spacing can add its own.
 */
function StudioFrame({ children }: { children: React.ReactNode }) {
  const theme = useMantineTheme();
  return (
    <Flex
      direction="column"
      style={{
        // The same resting border every setting row uses. The accent is
        // reserved for a staged change, and red for a value that blocks saving.
        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.35)}`,
        background: alpha(theme.colors.dark[8], 0.45),
        borderRadius: theme.radius.xs,
        overflow: 'hidden',
        width: '100%',
        // BOUNDED, so a component written as `h="100%"` has something to be
        // 100% OF. Without a height here that collapses to the content's own
        // size and a map grows past the bottom of the window, leaving you to
        // scroll the page to see the rest of it.
        //
        // The same pane height the panel's own map uses, so a script's editor
        // and a built-in one are the same size without either knowing about
        // the other.
        height: PANE_HEIGHT,
        flex: 1,
        minHeight: 0,
      }}
    >
      {children}
    </Flex>
  );
}

/** Keeps a broken script component from taking the panel with it. */
class ComponentBoundary extends React.Component<
  { resource: string; component: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { resource: string; component: string; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Failure
        resource={this.props.resource}
        component={this.props.component}
        detail={this.state.error.message}
        verb="crashed"
      />
    );
  }
}

/** One shape for both "could not load it" and "it broke while rendering". */
function Failure({
  resource, component, detail, verb,
}: { resource: string; component: string; detail: string; verb: string }) {
  const theme = useMantineTheme();
  const [copied, setCopied] = useState(false);

  // The person who can fix this is usually not the person looking at it - it is
  // whoever wrote the component. Retyping an error out of a game window is how
  // details get lost, so hand over the whole thing in one go.
  const report = [
    `resource: ${resource}`,
    `component: ${component}`,
    `${verb}: ${detail}`,
  ].join('\n');

  const copy = () => {
    copyToClipboard(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Flex
      align="flex-start" gap="xs" px="sm" py="xs"
      style={{
        background: alpha('#ef4444', 0.08),
        border: `0.1vh solid ${alpha('#ef4444', 0.35)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <AlertTriangle size="1.6vh" color="#ef4444" style={{ marginTop: '0.2vh', flexShrink: 0 }} />
      <Flex direction="column" style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
        <Text ff="Akrobat Bold" size="xs" c="#ef4444">
          {resource}&apos;s editor {verb}
        </Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.45)">
          {detail} — {component}
        </Text>
      </Flex>

      <m.button
        type="button"
        onClick={copy}
        whileTap={{ scale: 0.94 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4vh',
          padding: '0.4vh 0.7vh',
          background: 'transparent',
          border: `0.1vh solid ${alpha('#ef4444', 0.4)}`,
          borderRadius: theme.radius.xs,
          cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start',
        }}
        aria-label="Copy the error"
      >
        {copied ? <Check size="1.2vh" color="#5BC98C" /> : <Copy size="1.2vh" color="#ef4444" />}
        <Text ff="Akrobat Bold" size="xxs" c={copied ? '#5BC98C' : '#ef4444'}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </m.button>
    </Flex>
  );
}
