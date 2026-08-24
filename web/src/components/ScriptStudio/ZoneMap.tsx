import { Marker } from '@adamscybot/react-leaflet-component-marker';
import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { ConfirmModal, Map as DirkMap, Modal, ZoomControls, gameToMap, mapToGame } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Eye, EyeOff, MapPin, Pencil, PenTool, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Polygon, useMap } from 'react-leaflet';
import { FieldRow } from './FieldRow';
import { PickerDrawer } from './PickerDrawer';
import { StudioButton } from './ui';
import type { SettingColumn, SettingEntry } from './types';

type Row = Record<string, unknown>;
type Point = { x: number; y: number };

export type MapLayerInput = {
  entry: SettingEntry;
  value: unknown;
  onChange: (next: unknown) => void;
};

// Fishing's own layer colours, so the map reads the same as the one admins
// already use.
const DEPTH_COLOR = '#f59e0b';
const SEA_COLOR = '#3b82f6';
const ZONE_PALETTE = ['#5FD08A', '#4CC3DE', '#E0B15F', '#E0776B', '#B98FE0', '#8FE05F'];

/**
 * One map, every polygon layer on it.
 *
 * Fishing keeps three kinds of area and they all belong on the same canvas:
 *   zones          - a list of fishing areas, each with a `zone` boundary
 *   depthOverride  - a list of areas that force a water depth
 *   seaBoundary    - a single polygon splitting salt from fresh water
 *
 * Nothing here asks anyone to type a coordinate: boundaries are drawn with
 * leaflet-draw, the same interaction fishing's ZonesSection uses.
 */
export function ZoneMap({ layers, disabled }: { layers: MapLayerInput[]; disabled?: boolean }) {
  const theme = useMantineTheme();
  const accent = theme.colors[theme.primaryColor][5];

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ path: string; index: number } | null>(null);
  const [editing, setEditing] = useState<{ path: string; index: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ path: string; index: number } | null>(null);
  const [drawInto, setDrawInto] = useState<string | null>(null);
  const [replaceSingle, setReplaceSingle] = useState<{ path: string; points: Point[] } | null>(null);

  // Normalise the three shapes into one thing the map can draw.
  const model = useMemo(() => layers.map((layer, layerIndex) => {
    const raw = Array.isArray(layer.value) ? layer.value : [];
    const isSingle = raw.length > 0 && typeof (raw[0] as Point)?.x === 'number';

    const polyKey = (() => {
      const sample = raw.find((r) => r && typeof r === 'object' && !Array.isArray(r)) as Row | undefined;
      if (!sample) return 'zone';
      const hit = Object.entries(sample).find(([, v]) =>
        Array.isArray(v) && v.length > 2 && typeof (v[0] as Point)?.x === 'number');
      return hit?.[0] ?? 'zone';
    })();

    const labelKey = layer.entry.rowLabelKey ?? 'label';

    const shapes = isSingle
      ? [{ index: 0, title: layer.entry.label, points: raw as Point[], row: undefined as Row | undefined }]
      : (raw as Row[]).map((row, index) => ({
        index,
        title: String(row[labelKey] ?? row.id ?? row.name ?? `${layer.entry.label} ${index + 1}`),
        points: Array.isArray(row[polyKey]) ? (row[polyKey] as Point[]) : [],
        row,
      }));

    const color = layer.entry.path === 'seaBoundary' ? SEA_COLOR
      : layer.entry.path === 'depthOverride' ? DEPTH_COLOR
        : ZONE_PALETTE[layerIndex % ZONE_PALETTE.length];

    return { ...layer, isSingle, polyKey, labelKey, shapes, color };
  }), [layers]);

  const layerFor = (path: string) => model.find((l) => l.entry.path === path);

  const commitDrawing = (points: Point[]) => {
    const layer = layerFor(drawInto ?? '');
    setDrawInto(null);
    if (!layer) return;

    if (layer.isSingle) {
      // only one of these exists, so drawing replaces it - confirm first
      setReplaceSingle({ path: layer.entry.path, points });
      return;
    }

    const rows = Array.isArray(layer.value) ? [...(layer.value as Row[])] : [];
    const template = JSON.parse(JSON.stringify(layer.entry.rowTemplate ?? {}));
    template[layer.labelKey] = `${layer.entry.label} ${rows.length + 1}`;
    template[layer.polyKey] = points;
    layer.onChange([...rows, template]);
    setSelected({ path: layer.entry.path, index: rows.length });
    setEditing({ path: layer.entry.path, index: rows.length });
  };

  const deleteShape = (path: string, index: number) => {
    const layer = layerFor(path);
    setConfirmDelete(null);
    if (!layer) return;
    if (layer.isSingle) { layer.onChange([]); return; }
    layer.onChange((layer.value as Row[]).filter((_, i) => i !== index));
    setSelected(null);
  };

  const frameRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    if (mapReady) return;
    const node = frameRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((records) => {
      if (records.some((r) => r.isIntersecting)) { setMapReady(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mapReady]);

  const visibleShapes = model.filter((l) => !hidden.has(l.entry.path));
  const editingLayer = editing ? layerFor(editing.path) : null;
  const editingRow = editingLayer && !editingLayer.isSingle
    ? (editingLayer.value as Row[])[editing!.index]
    : undefined;

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      <Flex gap="xs" style={{ height: '56vh' }}>
        <Flex
          ref={frameRef as never}
          style={{
            flex: 1, position: 'relative',
            borderRadius: theme.radius.xs, overflow: 'hidden',
            border: `0.1vh solid ${alpha(drawInto ? accent : theme.colors.dark[5], drawInto ? 0.6 : 0.4)}`,
            // Leaflet's panes sit at z-index 400+. Without a stacking context of
            // its own the map paints straight over the panel's pinned header.
            isolation: 'isolate',
            zIndex: 0,
          }}
        >
          {!mapReady && (
            <Flex align="center" justify="center" style={{ flex: 1, background: alpha(theme.colors.dark[9], 0.5) }}>
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">Loading map...</Text>
            </Flex>
          )}

          {mapReady && (
            <DirkMap initialZoom={4}>
              <ExtendZoomRange minZoom={2} />
              <ZoomControls />
              <FrameAll model={visibleShapes} selected={selected} />
              {drawInto && <DrawPolygon color={layerFor(drawInto)?.color ?? accent} onDone={commitDrawing} />}

              {visibleShapes.map((layer) => layer.shapes.map((shape) => {
                if (shape.points.length < 3) return null;
                const active = selected?.path === layer.entry.path && selected.index === shape.index;
                const positions = shape.points.map((p) => gameToMap(p.x, p.y));
                return (
                  <Fragment key={`${layer.entry.path}:${shape.index}`}>
                    <Polygon
                      positions={positions}
                      pathOptions={{
                        color: layer.color,
                        weight: active ? 2.5 : 1.5,
                        opacity: active ? 1 : 0.7,
                        fillColor: layer.color,
                        fillOpacity: active ? 0.3 : 0.1,
                        dashArray: layer.isSingle ? '6 4' : undefined,
                      }}
                      eventHandlers={{ click: () => setSelected({ path: layer.entry.path, index: shape.index }) }}
                    />
                    <Marker
                      position={centroid(positions)}
                      eventHandlers={{ click: () => setSelected({ path: layer.entry.path, index: shape.index }) }}
                      icon={<ShapeLabel label={shape.title} hex={layer.color} active={active} points={shape.points.length} />}
                    />
                  </Fragment>
                );
              }))}
            </DirkMap>
          )}

          {/* key */}
          <Flex
            direction="column" gap="0.3vh" p="xs"
            style={{
              position: 'absolute', bottom: '2vh', left: '2vh', zIndex: 999998,
              background: alpha(theme.colors.dark[9], 0.9),
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            {model.map((layer) => {
              const off = hidden.has(layer.entry.path);
              return (
                <Flex
                  key={layer.entry.path}
                  align="center" gap="xs"
                  onClick={() => setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(layer.entry.path)) next.delete(layer.entry.path);
                    else next.add(layer.entry.path);
                    return next;
                  })}
                  style={{ cursor: 'pointer', opacity: off ? 0.4 : 1 }}
                >
                  <Flex w="1.4vh" h="0.6vh" style={{ background: layer.color, borderRadius: '0.15vh', flexShrink: 0 }} />
                  <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.75)" style={{ flex: 1 }}>
                    {layer.entry.label}
                  </Text>
                  <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)">
                    {layer.isSingle ? (layer.shapes[0]?.points.length ?? 0) + ' pts' : layer.shapes.length}
                  </Text>
                  {off ? <EyeOff size="1.2vh" color="rgba(255,255,255,0.4)" /> : <Eye size="1.2vh" color="rgba(255,255,255,0.4)" />}
                </Flex>
              );
            })}
          </Flex>

          {drawInto && (
            <Flex
              align="center" gap="xs" px="sm" py="xs"
              style={{
                position: 'absolute', top: '2vh', left: '2vh', zIndex: 999999,
                background: alpha(theme.colors.dark[9], 0.92),
                border: `0.1vh solid ${alpha(layerFor(drawInto)?.color ?? accent, 0.6)}`,
                borderRadius: theme.radius.xs,
              }}
            >
              <PenTool size="1.5vh" color={layerFor(drawInto)?.color ?? accent} />
              <Text ff="Akrobat Bold" size="xs" c={layerFor(drawInto)?.color ?? accent}>
                Drawing {layerFor(drawInto)?.entry.label} · click points, click the first to close
              </Text>
              <motion.button
                type="button" onClick={() => setDrawInto(null)} whileTap={{ scale: 0.94 }}
                style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0 }}
                aria-label="Cancel drawing"
              >
                <X size="1.4vh" />
              </motion.button>
            </Flex>
          )}
        </Flex>

        {/* list, grouped by layer */}
        <Flex
          direction="column" w="38vh"
          style={{
            flexShrink: 0,
            background: alpha(theme.colors.dark[9], 0.4),
            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}`,
            borderRadius: theme.radius.xs,
            minHeight: 0,
          }}
        >
          <Flex direction="column" gap="xs" p="xs" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {model.map((layer) => (
              <Flex key={layer.entry.path} direction="column" gap="xxs">
                <Flex align="center" gap="xs">
                  <Flex w="1.2vh" h="0.5vh" style={{ background: layer.color, borderRadius: '0.15vh' }} />
                  <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.45)">
                    {layer.entry.label}
                  </Text>
                  <Flex h="0.1vh" style={{ flex: 1, background: alpha(theme.colors.dark[5], 0.5) }} />
                </Flex>

                {layer.shapes.map((shape) => {
                  const active = selected?.path === layer.entry.path && selected.index === shape.index;
                  return (
                    <Flex
                      key={shape.index}
                      align="center" gap="xs" px="xs" py="0.5vh"
                      onClick={() => setSelected({ path: layer.entry.path, index: shape.index })}
                      style={{
                        background: active ? alpha(layer.color, 0.14) : alpha(theme.colors.dark[8], 0.4),
                        border: `0.1vh solid ${active ? alpha(layer.color, 0.5) : 'transparent'}`,
                        borderRadius: theme.radius.xs,
                        cursor: 'pointer',
                      }}
                    >
                      <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                        <Text ff="Akrobat Bold" size="xs" c={active ? layer.color : 'rgba(255,255,255,0.85)'} truncate>
                          {shape.title}
                        </Text>
                        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">
                          {shape.points.length} points
                          {shape.row?.depth !== undefined ? ` · ${shape.row.depth}m` : ''}
                          {shape.row?.lvlRequired ? ` · lvl ${shape.row.lvlRequired}` : ''}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="xxs" style={{ flexShrink: 0 }}>
                        {!layer.isSingle && (
                          <MiniButton icon={Pencil} label="Edit"
                            onClick={() => setEditing({ path: layer.entry.path, index: shape.index })} disabled={disabled} />
                        )}
                        <MiniButton icon={Trash2} label="Delete" danger
                          onClick={() => setConfirmDelete({ path: layer.entry.path, index: shape.index })} disabled={disabled} />
                      </Flex>
                    </Flex>
                  );
                })}

                {layer.shapes.length === 0 && (
                  <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.25)" pl="xs">None drawn</Text>
                )}
              </Flex>
            ))}
          </Flex>

          <Flex direction="column" gap="xxs" p="xs" style={{ flexShrink: 0 }}>
            <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.3)">
              Draw new
            </Text>
            <Flex gap="xxs" wrap="wrap">
              {model.map((layer) => (
                <motion.button
                  key={layer.entry.path}
                  type="button"
                  onClick={() => setDrawInto(drawInto === layer.entry.path ? null : layer.entry.path)}
                  disabled={disabled}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5vh',
                    padding: '0.5vh 0.8vh',
                    background: drawInto === layer.entry.path ? alpha(layer.color, 0.2) : 'transparent',
                    border: `0.1vh solid ${alpha(layer.color, drawInto === layer.entry.path ? 0.6 : 0.3)}`,
                    borderRadius: theme.radius.xs,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  <PenTool size="1.2vh" color={layer.color} />
                  <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={layer.color}>
                    {layer.entry.label}
                  </Text>
                </motion.button>
              ))}
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        Every area is drawn, never typed. Toggle a layer in the key to get it out of the way while you work.
      </Text>

      <AnimatePresence>
        {editing && editingLayer && editingRow && (
          <ShapeModal
            entry={editingLayer.entry}
            row={editingRow}
            polyKey={editingLayer.polyKey}
            title={editingLayer.shapes[editing.index]?.title ?? editingLayer.entry.label}
            disabled={disabled}
            onSave={(next) => {
              editingLayer.onChange((editingLayer.value as Row[]).map((r, i) => (i === editing.index ? next : r)));
              setEditing(null);
            }}
            onDelete={() => { setConfirmDelete(editing); setEditing(null); }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            title="Delete area"
            description={`"${layerFor(confirmDelete.path)?.shapes[confirmDelete.index]?.title ?? 'This area'}" and its boundary are removed when you save.`}
            confirmLabel="Delete"
            onConfirm={() => deleteShape(confirmDelete.path, confirmDelete.index)}
            onClose={() => setConfirmDelete(null)}
            zIndex={10200}
          />
        )}
        {replaceSingle && (
          <ConfirmModal
            title={`Replace ${layerFor(replaceSingle.path)?.entry.label}`}
            description={`There is only one ${layerFor(replaceSingle.path)?.entry.label.toLowerCase()}. The shape you just drew replaces the existing ${layerFor(replaceSingle.path)?.shapes[0]?.points.length ?? 0}-point boundary.`}
            confirmLabel="Replace"
            onConfirm={() => {
              layerFor(replaceSingle.path)?.onChange(replaceSingle.points);
              setReplaceSingle(null);
            }}
            onClose={() => setReplaceSingle(null)}
            zIndex={10200}
          />
        )}
      </AnimatePresence>
    </Flex>
  );
}

/**
 * dirk-cfx-react's tile layer is capped at `minZoom: 4`, and at zoom 4 the GTA
 * map is several times taller than this pane - so an admin can never see the
 * whole coastline at once. Widen the range on the live instance and let leaflet
 * downscale the zoom-4 tiles (`minNativeZoom`) rather than blanking them.
 *
 * Worth folding into the Map component itself later so every consumer gets it.
 */
function ExtendZoomRange({ minZoom = 2 }: { minZoom?: number }) {
  const map = useMap();

  useEffect(() => {
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) return;
      const options = layer.options as L.TileLayerOptions & { minNativeZoom?: number; maxNativeZoom?: number };
      options.minNativeZoom = 4;
      options.maxNativeZoom = 6;
      options.minZoom = minZoom;
      layer.redraw();
    });

    map.setMinZoom(minZoom);
    // fractional steps so the fit is not forced to a whole zoom level
    map.options.zoomSnap = 0.25;
    map.options.zoomDelta = 0.5;
  }, [map, minZoom]);

  return null;
}

function DrawPolygon({ color, onDone }: { color: string; onDone: (points: Point[]) => void }) {
  const map = useMap();

  useEffect(() => {
    const Handler = (L as unknown as { Draw: { Polygon: new (map: L.Map, opts: unknown) => { enable: () => void; disable: () => void } } }).Draw.Polygon;
    const handler = new Handler(map, {
      allowIntersection: false,
      showArea: false,
      shapeOptions: { color, weight: 2, fillOpacity: 0.2 },
    });

    const onCreated = (e: { layer: L.Polygon }) => {
      const latlngs = e.layer.getLatLngs()[0] as L.LatLng[];
      const points = latlngs.map((ll) => {
        const [x, y] = mapToGame(ll.lat, ll.lng);
        return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
      });
      if (points.length >= 3) onDone(points);
    };

    map.on('draw:created', onCreated as never);
    handler.enable();

    return () => {
      map.off('draw:created', onCreated as never);
      try { handler.disable(); } catch { /* already gone */ }
    };
  }, [map, color, onDone]);

  return null;
}

function FrameAll({
  model, selected,
}: {
  model: { entry: SettingEntry; shapes: { index: number; points: Point[] }[] }[];
  selected: { path: string; index: number } | null;
}) {
  const map = useMap();
  const count = model.reduce((sum, l) => sum + l.shapes.length, 0);

  useEffect(() => {
    const all = model.flatMap((l) => l.shapes.flatMap((s) => s.points)).map((p) => gameToMap(p.x, p.y));
    if (all.length < 2) return;
    map.fitBounds(all as [number, number][], { padding: [30, 30], animate: false, maxZoom: 6 });
  }, [count]);

  useEffect(() => {
    if (!selected) return;
    const layer = model.find((l) => l.entry.path === selected.path);
    const shape = layer?.shapes.find((s) => s.index === selected.index);
    if (!shape || shape.points.length < 2) return;
    map.fitBounds(shape.points.map((p) => gameToMap(p.x, p.y)) as [number, number][], { padding: [60, 60], animate: true });
  }, [selected]);

  return null;
}

function ShapeLabel({
  label, hex, active, points,
}: { label: string; hex: string; active: boolean; points: number }) {
  return (
    <Flex
      direction="column" align="center" gap="0.2vh"
      style={{ pointerEvents: 'auto', cursor: 'pointer', filter: active ? `drop-shadow(0 0 0.6vh ${hex})` : 'none' }}
    >
      <Flex
        px="0.7vh" py="0.15vh"
        style={{
          background: 'rgba(8,12,11,0.85)',
          border: `0.1vh solid ${alpha(hex, active ? 0.9 : 0.5)}`,
          borderRadius: '0.3vh',
          whiteSpace: 'nowrap',
        }}
      >
        <Text ff="Akrobat Bold" size="xxs" c={hex}>{label}</Text>
      </Flex>
      {active && (
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.5)" style={{ whiteSpace: 'nowrap' }}>{points} pts</Text>
      )}
    </Flex>
  );
}

function ShapeModal({
  entry, row, polyKey, title, onSave, onDelete, onClose, disabled,
}: {
  entry: SettingEntry;
  row: Row;
  polyKey: string;
  title: string;
  onSave: (next: Row) => void;
  onDelete: () => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [draft, setDraft] = useState<Row>(() => JSON.parse(JSON.stringify(row)));
  const [picker, setPicker] = useState<SettingColumn | null>(null);

  const columns = (entry.columns ?? []).filter((c) => c.key !== polyKey);
  const points = Array.isArray(draft[polyKey]) ? (draft[polyKey] as Point[]).length : 0;

  return (
    <>
      <Modal
        title={title}
        icon={MapPin}
        iconColor={color}
        description={entry.label}
        badge={{ label: `${points} BOUNDARY POINTS`, color }}
        onClose={onClose}
        width="70vh"
        height="66vh"
        zIndex={10100}
      >
        <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
          <Flex direction="column" gap="xs" p="sm" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {columns.map((column) => (
              <FieldRow
                key={column.key}
                column={column}
                value={draft[column.key]}
                disabled={disabled}
                onChange={(v) => setDraft((prev) => ({ ...prev, [column.key]: v }))}
                onPick={() => setPicker(column)}
              />
            ))}
          </Flex>

          <Flex
            align="center" justify="space-between" px="sm" py="xs"
            style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
          >
            <StudioButton label="Delete" danger icon={Trash2} onClick={onDelete} disabled={disabled} />
            <Flex gap="xs">
              <StudioButton label="Cancel" onClick={onClose} />
              <StudioButton label="Save area" primary onClick={() => onSave(draft)} disabled={disabled} />
            </Flex>
          </Flex>
        </Flex>
      </Modal>

      <AnimatePresence>
        {picker && (
          <PickerDrawer
            type={picker.type}
            label={picker.label}
            value={draft[picker.key]}
            disabled={disabled}
            onApply={(v) => setDraft((prev) => ({ ...prev, [picker.key]: v }))}
            onClose={() => setPicker(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function MiniButton({
  icon: Icon, label, onClick, disabled, danger,
}: { icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  const theme = useMantineTheme();
  const accent = danger ? '#ef4444' : theme.colors[theme.primaryColor][5];

  return (
    <motion.div
      role="button"
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (!disabled) onClick(); }}
      whileHover={disabled ? undefined : { background: alpha(accent, 0.16), borderColor: alpha(accent, 0.5) }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      style={{
        aspectRatio: '1 / 1', height: '2.4vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'rgba(255,255,255,0.55)',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-label={label}
    >
      <Icon size="1.2vh" />
    </motion.div>
  );
}

function centroid(positions: [number, number][]): [number, number] {
  const lat = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
  const lng = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
  return [lat, lng];
}
