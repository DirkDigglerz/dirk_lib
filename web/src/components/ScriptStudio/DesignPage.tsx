import { alpha, Box, Flex, Text, TextInput, UnstyledButton, useMantineTheme } from '@mantine/core';
import { ArrowLeft, LayoutTemplate, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  componentPreview,
  LiveThumb,
  loadingComponents,
  loadingDesigns,
  loadingManifest,
} from './LiveThumb';
import { useStudio } from './store';

/**
 * The design surface, in two modes.
 *
 * BROWSE is an ordinary hub page — rail visible, behaving like Items or Bridges.
 * EDIT is a mode: opening a design hands the panel to the editor and drops the
 * rail, because a canvas needs the width and nobody browses settings mid-design.
 *
 * ── Framing follows the real Studio, deliberately ─────────────────────────────
 * Gallery.tsx and ComponentsPanel.tsx both do the same thing: a box filled with
 * the CANVAS colour, and the item's own reference stage scaled to fit and centred
 * inside it. That is why a small atom is not a speck and a full-screen design is
 * not cropped — every tile is framed identically regardless of extent. LiveThumb
 * reproduces that maths against a real DesignSurface.
 *
 * ── Still a mock, but the tiles are not ───────────────────────────────────────
 * Designs and components render for real, from the manifest dirk_loading emits.
 * What is mocked is where the payload comes from (a checked-in fixture rather
 * than the wire) and the editor pane, which is a marker.
 */

/** minimum card width — tracks stretch past it so a wide page has no dead gutter */
const CARD_MIN = 250;

/** the small uppercase bordered pill the Studio uses for meta */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        flexShrink: 0, fontSize: '0.95vh', lineHeight: 1, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.42)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.35vh',
        padding: '0.4vh 0.55vh 0.35vh',
      }}
    >
      {children}
    </Text>
  );
}

export function DesignPage({ resource }: { resource: string }) {
  const editing = useStudio((s) => s.editingDesign);
  return editing ? <EditorMode resource={resource} id={editing} /> : <BrowseMode resource={resource} />;
}

/* ─────────────────────────────────────────────────────────── browse ────── */

function BrowseMode({ resource }: { resource: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  // which design is live. Mock-local for now; the real one is scriptConfig's
  // activeId, saved the moment it changes — "use this" is a decision, not an edit
  const [activeId, setActiveId] = useState(loadingDesigns[0]?.id);

  const designs = useMemo(
    () => loadingDesigns.filter((d) => !q || (d.name + (d.description ?? '')).toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  // Grouped by category, not one flat wall — the loading kit is what someone came
  // here for, and unheaded it sits buried among the generic basics.
  const compGroups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const matched = loadingComponents.filter(
      (c) => !ql || (c.name + (c.description ?? '') + c.category).toLowerCase().includes(ql),
    );
    const byCategory = new Map<string, typeof matched>();
    for (const c of matched) {
      const list = byCategory.get(c.category) ?? [];
      list.push(c);
      byCategory.set(c.category, list);
    }
    // the kit for THIS studio leads; everything generic follows
    return [...byCategory.entries()].sort(([a], [b]) =>
      a === b ? 0 : a.toLowerCase() === 'loading' ? -1 : b.toLowerCase() === 'loading' ? 1 : a.localeCompare(b),
    );
  }, [q]);
  const compCount = useMemo(() => compGroups.reduce((n, [, list]) => n + list.length, 0), [compGroups]);

  const open = (id: string) => useStudio.setState({ editingDesign: id });

  return (
    <Flex direction="column" gap="md" p="md" style={{ overflow: 'auto', flex: 1 }}>
      <Flex align="center" gap="sm" wrap="wrap">
        <Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <LayoutTemplate size="2vh" color={color} />
          <Text ff="Akrobat Bold" size="sm" tt="uppercase" lts="0.06em" c="white">Designs</Text>
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{designs.length}</Text>
        </Flex>
        <TextInput
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search designs and components…"
          size="xs"
          leftSection={<Search size="1.4vh" />}
          style={{ width: '34vh' }}
        />
        <UnstyledButton
          onClick={() => open('new')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5vh', padding: '0.5vh 1vh',
            borderRadius: theme.radius.xs, color,
            background: alpha(color, 0.13), border: `0.1vh solid ${alpha(color, 0.35)}`,
          }}
        >
          <Plus size="1.5vh" />
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em">New design</Text>
        </UnstyledButton>
      </Flex>

      <Box style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN}px, 1fr))`, gap: '1.55vh' }}>
        {designs.map((d) => {
          const on = hover === d.id;
          const active = d.id === activeId;
          return (
            <Box
              key={d.id}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                borderRadius: '0.7vh', overflow: 'hidden',
                border: `1px solid ${on || active ? alpha(color, on ? 0.45 : 0.5) : 'rgba(255,255,255,0.09)'}`,
                background: 'rgba(255,255,255,0.022)',
                transform: on ? 'translateY(-2px)' : 'none',
                transition: 'border-color .13s, transform .13s',
              }}
            >
              <Box style={{ position: 'relative' }}>
                <LiveThumb design={d} manifest={loadingManifest} />
                {active && (
                  <Text
                    ff="Akrobat Bold" tt="uppercase"
                    style={{
                      position: 'absolute', top: '0.6vh', left: '0.6vh', zIndex: 2,
                      fontSize: '0.9vh', lineHeight: 1, letterSpacing: '0.1em', color: '#0b0e0c',
                      background: color, padding: '0.35vh 0.55vh 0.25vh', borderRadius: '0.35vh',
                    }}
                  >
                    Active
                  </Text>
                )}
                {/* Two intents, two targets. A bare click on the card can only mean
                    one of them, and guessing wrong either edits what you meant to
                    activate or activates what you meant to edit — so both are
                    spelled out, and neither hides behind a context menu. */}
                {on && (
                  <Flex
                    align="center" justify="center" gap="0.8vh"
                    style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,13,0.55)', zIndex: 3 }}
                  >
                    {!active && (
                      <UnstyledButton
                        onClick={() => setActiveId(d.id)}
                        style={{
                          padding: '0.6vh 1.1vh', borderRadius: theme.radius.xs,
                          color: '#0b0e0c', background: color, fontWeight: 700,
                          fontSize: '1.05vh', letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}
                      >
                        Use this
                      </UnstyledButton>
                    )}
                    <UnstyledButton
                      onClick={() => open(d.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4vh',
                        padding: '0.6vh 1.1vh', borderRadius: theme.radius.xs, color,
                        background: alpha(color, 0.14), border: `0.1vh solid ${alpha(color, 0.4)}`,
                        fontWeight: 700, fontSize: '1.05vh', letterSpacing: '0.05em', textTransform: 'uppercase',
                      }}
                    >
                      <Pencil size="1.3vh" />
                      Edit
                    </UnstyledButton>
                  </Flex>
                )}
              </Box>
              <Box p="1.2vh">
                <Text ff="Akrobat Bold" style={{ fontSize: '1.3vh' }} c="white" mb="0.35vh" truncate>
                  {d.name}
                </Text>
                <Text
                  style={{ fontSize: '1.1vh', color: 'rgba(255,255,255,0.42)', lineHeight: 1.45, minHeight: '3.1vh' }}
                  lineClamp={2}
                >
                  {d.description ?? 'No description.'}
                </Text>
                <Flex gap="0.55vh" mt="0.9vh">
                  <Pill>{d.pages.length} {d.pages.length === 1 ? 'page' : 'pages'}</Pill>
                  <Pill>{d.elements.length} elements</Pill>
                </Flex>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Flex align="center" gap="xs" mt="xs">
        <Text ff="Akrobat Bold" size="sm" tt="uppercase" lts="0.06em" c="white">Components</Text>
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{compCount}</Text>
      </Flex>
      <Text size="xxs" c="rgba(255,255,255,0.4)" mt="-0.7vh">
        Ready-made pieces. Drag one in, fill its settings — no need to build from rectangles.
      </Text>

      {compGroups.map(([category, list]) => (
        <Box key={category}>
          <Flex align="center" gap="xs" mb="0.9vh">
            <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.45)">
              {category}
            </Text>
            <Box style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">{list.length}</Text>
          </Flex>
          <Box style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN}px, 1fr))`, gap: '1.55vh' }}>
        {list.map((c) => {
          const on = hover === c.id;
          return (
            <Box
              key={c.id}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                borderRadius: '0.9vh', overflow: 'hidden', cursor: 'grab',
                border: `1px solid ${on ? alpha(color, 0.45) : 'rgba(255,255,255,0.09)'}`,
                background: 'rgba(255,255,255,0.02)',
                transform: on ? 'translateY(-1px)' : 'none',
                transition: 'border-color .13s, transform .13s',
              }}
            >
              <Box style={{ position: 'relative' }}>
                <LiveThumb design={componentPreview(c)} manifest={loadingManifest} />
                {on && (
                  <Flex
                    align="center" justify="center"
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(8,10,13,0.5)', color,
                      fontSize: '1.1vh', fontWeight: 700, letterSpacing: '0.04em',
                    }}
                  >
                    ＋ Drop into design
                  </Flex>
                )}
              </Box>
              <Flex align="center" gap="0.7vh" style={{ padding: '0.8vh 1vh' }}>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: '1.2vh', fontWeight: 600, color: '#e8eaed' }} truncate>{c.name}</Text>
                  <Text style={{ fontSize: '1vh', color: 'rgba(255,255,255,0.32)' }} truncate>
                    {c.description ?? ''}
                  </Text>
                </Box>
              </Flex>
            </Box>
          );
        })}
          </Box>
        </Box>
      ))}

      <Text size="xxs" c="rgba(255,255,255,0.22)">
        Tiles render live from {resource}&apos;s own manifest. The editor pane is a marker.
      </Text>
    </Flex>
  );
}

/* ─────────────────────────────────────────────────────────── edit ────── */

function EditorMode({ resource, id }: { resource: string; id: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const design = loadingDesigns.find((d) => d.id === id);
  const back = () => useStudio.setState({ editingDesign: null });

  return (
    <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
      <Flex
        align="center" gap="sm" px="md" py="xs"
        style={{ borderBottom: '0.1vh solid rgba(255,255,255,0.08)', flexShrink: 0 }}
      >
        <UnstyledButton
          onClick={back}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4vh', padding: '0.4vh 0.8vh',
            borderRadius: theme.radius.xs, color,
            background: alpha(color, 0.13), border: `0.1vh solid ${alpha(color, 0.35)}`,
          }}
        >
          <ArrowLeft size="1.4vh" />
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em">Designs</Text>
        </UnstyledButton>
        <Flex align="center" gap="0.5vh" style={{ minWidth: 0 }}>
          <Text size="xxs" c="rgba(255,255,255,0.4)">{resource}</Text>
          <Text size="xxs" c="rgba(255,255,255,0.2)">›</Text>
          <Text size="xxs" c="rgba(255,255,255,0.4)">Designs</Text>
          <Text size="xxs" c="rgba(255,255,255,0.2)">›</Text>
          <Text ff="Akrobat Bold" size="xxs" c="white">{design?.name ?? 'New design'}</Text>
        </Flex>
      </Flex>

      <Flex direction="column" align="center" justify="center" gap="sm" style={{ flex: 1, padding: '4vh' }}>
        <LayoutTemplate size="5vh" color={color} />
        <Text ff="Akrobat Bold" size="md" c="white" tt="uppercase" lts="0.06em">Studio opens here</Text>
        <Text size="xs" c="rgba(255,255,255,0.55)" ta="center" maw="60vh" style={{ lineHeight: 1.6 }}>
          Full width, no rail — the canvas takes the panel. Layers left, inspector and components right,
          this header carrying the breadcrumb and the save bar.
        </Text>
        {design && (
          <Box
            style={{
              width: '70vh', maxWidth: '100%', marginTop: '1vh',
              borderRadius: theme.radius.sm, overflow: 'hidden',
              border: `0.1vh solid ${alpha(color, 0.45)}`,
            }}
          >
            <LiveThumb design={design} manifest={loadingManifest} />
          </Box>
        )}
        <Text size="xxs" c="rgba(255,255,255,0.25)" mt="sm" ta="center" maw="60vh">
          Not wired: the editor itself still needs mounting here.
        </Text>
      </Flex>
    </Flex>
  );
}
