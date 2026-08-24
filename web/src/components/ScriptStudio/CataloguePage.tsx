import { alpha, Flex, Select, Text, TextInput, useMantineTheme } from '@mantine/core';
import { fetchNui, getItemImageUrl, useItems, type Vehicle } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Box, Car, ChevronRight, Package, PackagePlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StudioButton } from './ui';

/**
 * A browsable reference of what this server actually has: every item the
 * inventory knows, and every vehicle the framework's shared table lists.
 *
 * Read-only on purpose - it answers "what is this called / does this exist"
 * while you are configuring something else, which is otherwise a trip to a
 * different resource's files.
 *
 * Item art comes from the inventory path dirk_lib already resolves. Vehicle art
 * is not something a framework ships, so it comes from a CDN.
 */
const VEHICLE_IMAGE = 'https://cdn.sky-systems.net/vehicles/%s.png';
const PER_PAGE = 25;

type Kind = 'items' | 'vehicles';

type Row = {
  id: string;
  label: string;
  image?: string;
  cells: string[];
  facts: { label: string; value: string }[];
  description?: string;
};

export function CataloguePage({ kind, query }: { kind: Kind; query: string }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const [category, setCategory] = useState<string | null>(null);
  // Which column orders the table, and which way. Null = the source order,
  // which for items is the inventory's own and for vehicles is the framework's.
  const [sort, setSort] = useState<{ column: number; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const items = useItems();

  // Fetched here rather than through cfx-react's `ensureVehicles`, which guards
  // itself with a module-level "already requested" flag: one early call that
  // came back empty is cached for the life of the page, and nothing retries.
  // The Lua returns 901 vehicles on this server either way, so a page that
  // showed none was reading that stale cache.
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  useEffect(() => {
    if (kind !== 'vehicles') return;
    let live = true;
    setLoadingVehicles(true);
    fetchNui<Vehicle[]>('GET_VEHICLES', undefined, [])
      .then((data) => { if (live) setVehicles(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setVehicles([]); })
      .finally(() => { if (live) setLoadingVehicles(false); });
    return () => { live = false; };
  }, [kind]);

  const categories = useMemo(
    () => [...new Set(vehicles.map((v) => v.category).filter(Boolean))].sort() as string[],
    [vehicles],
  );

  const needle = query.trim().toLowerCase();

  const rows: Row[] = useMemo(() => {
    if (kind === 'items') {
      return Object.values(items)
        .filter((item) => !needle
          || item.name.toLowerCase().includes(needle)
          || (item.label ?? '').toLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          id: item.name,
          label: item.label || item.name,
          image: getItemImageUrl(item.name),
          cells: [item.name, item.weight > 0 ? `${item.weight}g` : '—'],
          description: item.description,
          facts: [
            { label: 'Weight', value: item.weight > 0 ? `${item.weight}g` : '—' },
            { label: 'Spawn name', value: item.name },
          ],
        }));
    }

    return vehicles
      .filter((vehicle) => {
        if (category && vehicle.category !== category) return false;
        if (!needle) return true;
        return vehicle.model.toLowerCase().includes(needle)
          || (vehicle.name ?? '').toLowerCase().includes(needle)
          || (vehicle.brand ?? '').toLowerCase().includes(needle);
      })
      .map((vehicle) => ({
        id: vehicle.model,
        label: vehicle.name || vehicle.model,
        image: VEHICLE_IMAGE.replace('%s', vehicle.model),
        cells: [vehicle.model, vehicle.brand ?? '—', vehicle.category ?? '—'],
        facts: [
          ...(vehicle.brand ? [{ label: 'Brand', value: vehicle.brand }] : []),
          ...(vehicle.category ? [{ label: 'Class', value: vehicle.category }] : []),
          ...(vehicle.price !== undefined ? [{ label: 'Price', value: `$${vehicle.price.toLocaleString()}` }] : []),
        ],
      }));
  }, [kind, items, vehicles, needle, category]);

  // Sorting the BUILT rows gives one comparison path for both catalogues, and
  // sorts what is on screen rather than the underlying shape. Column -1 is
  // Name, which lives outside `cells`.
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const pick = (row: Row) => (sort.column === -1 ? row.label : row.cells[sort.column] ?? '');
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = pick(a);
      const right = pick(b);
      // Weight and price READ as numbers, so compare them as numbers - or
      // "9g" sorts after "10g".
      const nl = Number(left.replace(/[^\d.-]/g, ''));
      const nr = Number(right.replace(/[^\d.-]/g, ''));
      const numeric = /^[^a-z]*[\d.,-]+[a-z]?$/i;
      if (numeric.test(left) && numeric.test(right) && !Number.isNaN(nl) && !Number.isNaN(nr)) {
        return (nl - nr) * factor;
      }
      return left.localeCompare(right) * factor;
    });
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const shown = sorted.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  useEffect(() => { setPage(0); setOpen(null); }, [kind, needle, category, sort]);

  const columns = kind === 'items'
    ? ['Spawn name', 'Weight']
    : ['Spawn name', 'Brand', 'Class'];

  return (
    <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
      {/* controls */}
      <Flex
        align="center" gap="xs" px="md" py="sm"
        style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[6], 0.7)}`, flexShrink: 0 }}
      >
        <Flex align="center" gap="xs" style={{ flex: 1 }}>
          {kind === 'items'
            ? <Package size="1.9vh" color={color} />
            : <Car size="1.9vh" color={color} />}
          <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)">
            {kind === 'items' ? 'Items' : 'Vehicles'}
          </Text>
          <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">
            {kind === 'items'
              ? 'Everything your inventory knows about'
              : "Every vehicle in your framework's shared table"}
          </Text>
        </Flex>

        {kind === 'vehicles' && categories.length > 0 && (
          <Select
            data={categories}
            value={category}
            onChange={setCategory}
            placeholder="All classes"
            clearable
            comboboxProps={{ zIndex: 10800 }}
            styles={{
              input: {
                background: alpha(theme.colors.dark[9], 0.75),
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'Akrobat SemiBold',
                fontSize: '1.4vh',
                height: '3.4vh',
                minHeight: '3.4vh',
                width: '26vh',
              },
              dropdown: { background: theme.colors.dark[8], border: `0.1vh solid ${theme.colors.dark[6]}` },
            }}
          />
        )}

        <Text ff="monospace" size="xs" c="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }}>
          {rows.length}
        </Text>
      </Flex>

      {/* column header */}
      <Flex
        align="center" gap="sm" px="sm" py="0.6vh"
        style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[6], 0.5)}`, flexShrink: 0 }}
      >
        <Flex w="1.4vh" style={{ flexShrink: 0 }} />
        <Flex w="3.6vh" style={{ flexShrink: 0 }} />
        <SortHeader
          label="Name" column={-1} sort={sort} onSort={setSort}
          style={{ flex: 1, minWidth: 0 }}
        />
        {columns.map((column, index) => (
          <SortHeader
            key={column}
            label={column} column={index} sort={sort} onSort={setSort}
            style={{ width: '13vh', flexShrink: 0 }}
          />
        ))}
      </Flex>

      <Flex direction="column" className="studio-scroll"
        style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {shown.map((row) => (
          <CatalogueRow
            key={row.id}
            row={row}
            kind={kind}
            open={open === row.id}
            onToggle={() => setOpen(open === row.id ? null : row.id)}
          />
        ))}

        {rows.length === 0 && (
          <Flex direction="column" align="center" justify="center" gap="xs" py="xl">
            {kind === 'items' ? <Package size="3vh" color="rgba(255,255,255,0.18)" /> : <Car size="3vh" color="rgba(255,255,255,0.18)" />}
            <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.4)">
              {loadingVehicles && kind === 'vehicles'
                ? 'Reading the vehicle table…'
                : needle || category ? 'Nothing matches that' : `No ${kind} found`}
            </Text>
            {kind === 'vehicles' && !loadingVehicles && !needle && !category && (
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)" ta="center" style={{ maxWidth: '60vh' }}>
                The shared-vehicle table comes from qb-core / qbx_core. ESX has no categorised
                equivalent, so this list is empty there until we add another source.
              </Text>
            )}
          </Flex>
        )}
      </Flex>

      {pages > 1 && (
        <Flex align="center" justify="space-between" px="md" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[6], 0.7)}`, flexShrink: 0 }}>
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.35)">
            {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, rows.length)} of {rows.length}
          </Text>
          <Flex gap="xxs">
            <StudioButton label="Prev" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} />
            <StudioButton label="Next" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

/**
 * A column header you click to sort by. Third click clears back to the source
 * order - the inventory's own for items, the framework's for vehicles - which
 * is worth being able to get back to.
 */
function SortHeader({
  label, column, sort, onSort, style,
}: {
  label: string;
  column: number;
  sort: { column: number; dir: 'asc' | 'desc' } | null;
  onSort: (next: { column: number; dir: 'asc' | 'desc' } | null) => void;
  style?: React.CSSProperties;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const active = sort?.column === column;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        if (!active) return onSort({ column, dir: 'asc' });
        if (sort!.dir === 'asc') return onSort({ column, dir: 'desc' });
        return onSort(null);
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4vh',
        background: 'transparent', border: 'none', padding: 0,
        cursor: 'pointer', textAlign: 'left', ...style,
      }}
    >
      <Text
        ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.12em"
        c={active ? color : 'rgba(255,255,255,0.3)'}
        truncate
      >
        {label}
      </Text>
      {active
        ? (sort!.dir === 'asc'
          ? <ArrowUp size="1.1vh" color={color} />
          : <ArrowDown size="1.1vh" color={color} />)
        : <ArrowUpDown size="1.1vh" color="rgba(255,255,255,0.15)" />}
    </motion.button>
  );
}

function CatalogueRow({
  row, kind, open, onToggle,
}: {
  row: Row;
  kind: Kind;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex
      direction="column"
      style={{
        borderBottom: `0.1vh solid ${alpha('#ffffff', 0.05)}`,
        background: open ? alpha('#ffffff', 0.03) : 'transparent',
      }}
    >
      <Flex
        align="center" gap="sm" px="sm" py="0.9vh"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', width: '1.4vh', flexShrink: 0 }}
        >
          <ChevronRight size="1.2vh" color="rgba(255,255,255,0.25)" />
        </motion.div>

        <Flex align="center" justify="center" w="3.6vh" h="3.6vh" style={{ flexShrink: 0 }}>
          <Art src={row.image} kind={kind} />
        </Flex>

        <Text
          ff="Akrobat SemiBold" size="xs"
          c={open ? color : 'rgba(255,255,255,0.85)'}
          style={{ flex: 1, minWidth: 0 }}
          truncate
        >
          {row.label}
        </Text>

        {/* fixed-width cells, so two columns and three columns line up the same */}
        {row.cells.map((cell, index) => (
          <Text
            key={index}
            ff="monospace" size="xxs" c="rgba(255,255,255,0.35)"
            style={{ width: '13vh', flexShrink: 0 }}
            truncate
          >
            {cell}
          </Text>
        ))}
      </Flex>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: 'hidden' }}
          >
            <Flex gap="md" px="sm" pb="sm" pt="xxs" align="flex-start">
              {/* the picture lit by a blurred copy of itself, so a red car
                  glows red without anyone tagging it */}
              <Flex
                align="center" justify="center"
                w="16vh" h="12vh"
                style={{ position: 'relative', flexShrink: 0 }}
              >
                {row.image && (
                  <img
                    src={row.image}
                    alt=""
                    aria-hidden
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'contain', filter: 'blur(2.4vh) saturate(1.8)',
                      opacity: 0.55, pointerEvents: 'none',
                    }}
                  />
                )}
                <Art src={row.image} kind={kind} large />
              </Flex>

              <Flex direction="column" gap="sm" style={{ flex: 1, minWidth: 0 }}>
                {row.description && (
                  <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.5)">
                    {row.description}
                  </Text>
                )}

                <Flex gap="xs" py="0.4vh">
                  <StudioButton
                    label={kind === 'items' ? 'Give me one' : 'Spawn it'}
                    icon={kind === 'items' ? PackagePlus : Car}
                    primary
                    onClick={() => (kind === 'items'
                      ? fetchNui('GIVE_SCRIPT_CONFIG_ITEM', { itemName: row.id, itemAmount: 1 })
                      : fetchNui('SPAWN_VEHICLE', { model: row.id }))}
                  />
                </Flex>

                <Flex gap="xs" wrap="wrap">
                  {row.facts.map((fact) => (
                    <Flex
                      key={fact.label}
                      direction="column" px="sm" py="0.4vh"
                      style={{
                        background: alpha(theme.colors.dark[9], 0.5),
                        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
                        borderRadius: theme.radius.xs,
                      }}
                    >
                      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.3)">
                        {fact.label}
                      </Text>
                      <Text ff="monospace" size="xs" c="rgba(255,255,255,0.85)">{fact.value}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  );
}

function Art({ src, kind, large }: { src?: string; kind: Kind; large?: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    const Icon = kind === 'items' ? Box : Car;
    return <Icon size={large ? '4vh' : '2.2vh'} color="rgba(255,255,255,0.15)" />;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', position: 'relative' }}
    />
  );
}
