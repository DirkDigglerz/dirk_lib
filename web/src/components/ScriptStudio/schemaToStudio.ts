// Walks a real schema.json and produces the payload the hub renders.
//
// This is a working prototype of the Phase 2 adapter: everything the panel
// shows is derived here, so whatever this cannot express is a genuine gap in
// the schema vocabulary rather than a UI problem. Two such gaps are already
// visible in fishing and are handled explicitly below:
//
//   1. Several arrays (zones, stores, depthOverride) carry no `items` schema
//      at all - only `type: array` plus a `default`. Columns have to be
//      inferred from the default data. Filling in `items` is conversion work.
//   2. Nothing in the schema says which control to draw, so control type is
//      guessed from JSON Schema type + key naming. That guessing is exactly
//      what an explicit `x-control` annotation replaces.

import type { ControlType, EnabledWhen, RowTab, SettingColumn, SettingEntry, SettingGroup, StudioScript } from './types';
import type { ValidationRule } from './conditions';

type JsonSchema = Record<string, any>;

export type StudioMeta = {
  resource: string;
  label: string;
  icon: string;
  version: string;
  shared?: boolean;
  /** group id -> lucide icon name */
  groupIcons?: Record<string, string>;
  /** paths that should render as the map control rather than a plain list */
  mapPaths?: string[];
  /** modal tabs per list path - fishing's fish editor has four of them */
  rowTabs?: Record<string, { id: string; label: string; icon: string; keys: string[] }[]>;
  /** demo overrides so MODIFIED / revert states are visible in the mock */
  overrides?: Record<string, unknown>;
  /**
   * Reassigns settings to a section by path, so one oversized top-level key
   * (fishing's `basic` holds ~40 settings covering six unrelated concerns)
   * becomes several findable sections. This is exactly what an `x-group`
   * annotation on each property does in Phase 2 - declared here so the
   * grouping can be judged before the schema is edited.
   *
   * First matching rule wins; anything unmatched keeps its schema section.
   */
  /**
   * Paths this script owns but does NOT show in its own rail, because the
   * panel presents them somewhere central instead - `access` belongs to the
   * Admins page. They stay in `entries` so that page can read and write them;
   * they just stop generating a section nobody should edit twice.
   */
  managedElsewhere?: string[];
  sections?: {
    id: string;
    label: string;
    icon: string;
    description?: string;
    /** exact paths or prefixes (a prefix matches `prefix` and `prefix.*`) */
    paths: string[];
  }[];
};

// ── naming ──────────────────────────────────────────────────────────────────

/** `maxArtificialDepth` -> `Max Artificial Depth`, `baitDig` -> `Bait Dig` */
export function humanise(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ── control inference ───────────────────────────────────────────────────────

function looksLikeCoords(value: unknown, node: JsonSchema): boolean {
  const props = node?.properties;
  if (props && 'x' in props && 'y' in props) return true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return typeof v.x === 'number' && typeof v.y === 'number';
  }
  return false;
}

/**
 * Best guess at which control a value wants. Order matters: explicit schema
 * hints beat key naming, key naming beats raw JSON type.
 */
export function inferControl(key: string, node: JsonSchema, value: unknown, inItemList = false): ControlType {
  const lower = key.toLowerCase();

  if (node?.['x-installItem'] || inItemList) return 'item';
  if (Array.isArray(node?.enum) || Array.isArray(node?.['x-enum'])) return 'enum';

  // A two-number array IS a range, whether or not it happens to ship a default.
  // Judging this by the value alone meant fish.weightLimits (has a default) got
  // the range control while fish.permitWeightLimit and rewardItems[].amount -
  // identical shape, no default - fell through to free-text chips.
  if (node?.type === 'array' && node.minItems === 2 && node.maxItems === 2) {
    const itemType = (node.items as JsonSchema | undefined)?.type;
    if (itemType === 'number' || itemType === 'integer') return 'range';
  }

  // 0-6, and nobody remembers which end Sunday is on
  if (/^days?ofweek$/.test(lower)) return 'weekdays';

  // An open map of name -> BOUNDED number: a weight, which is a slider.
  //
  // A `maximum` is what makes it a weight. Without one it is an open-ended
  // count - `basic.permitRevokers` is `{ police: 2 }`, a group and the rank it
  // needs - and treating that as a weight put a strength slider on it, capped
  // at 1, reporting rank 2 as "STRONG". Grade maps are handled further down.
  if (!/revokers?$/.test(lower)) {
    const openValues = node?.additionalProperties as JsonSchema | undefined;
    if (openValues
      && (openValues.type === 'number' || openValues.type === 'integer')
      && openValues.maximum !== undefined) {
      return 'weightMap';
    }
  }

  // an array constrained to a fixed set of members
  if (node?.type === 'array' && Array.isArray(node.items?.enum ?? node.items?.['x-enum'])) return 'enumList';

  // Descriptions are prose - the old panel gave these a Textarea and a
  // single-line box hides everything past the first few words
  if (/^(description|notes?|blurb)$/.test(lower) && typeof value !== 'number') return 'text';

  // ["cash","bank"] - the same thing `permitAccounts` holds, just named for
  // what the store does with it
  if (/^paymentmethods$/.test(lower)) return 'accounts';

  // blip objects carry their own sprite/colour/display trio
  if (/sprite/.test(lower)) return 'blipSprite';
  // `display` is a blip visibility mode (2/3/4/5/6/8/9/10), not a free number -
  // the old fishing panel used BlipDisplaySelect here and typing 7 does nothing
  if (/^display$/.test(lower) && typeof value === 'number') return 'blipDisplay';
  if (/^blip$/.test(lower)) return 'blipColor';
  if (/colou?r/.test(lower)) {
    if (typeof value === 'number') return 'blipColor';
    // theme.primaryColor holds a Mantine palette name ("dirk") or "custom" -
    // a hex picker would write a value the theme system cannot use
    if (/^primary/.test(lower) && typeof value === 'string' && !value.startsWith('#')) {
      return 'mantineColor';
    }
    return 'color';
  }
  if (/^primaryshade$/.test(lower)) return 'shade';
  // iconColors.{equipment,fishMarket,zone} are hex strings whose OWN key says
  // nothing about colour - judge the value, not just the name.
  if (typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return 'color';
  if (/ped(model)?s?$/.test(lower)) return 'ped';
  // ...TabletModel, propModel, etc - a world model, not a ped
  if (/model$/.test(lower)) return 'model';
  if (/vehicle/.test(lower)) return 'vehicle';
  if (/account$/.test(lower)) return 'account';
  if (/(coords?|position|location|pos)$/.test(lower) || looksLikeCoords(value, node)) return 'coords';
  // Credentials, before the keybind rule below - `apiKey` ends in "key" and was
  // being handed a KEYBIND PICKER, so a Datadog API key was configured by
  // pressing a button on the keyboard. These are also the values worth masking:
  // an admin panel is often open on a stream.
  if (/(token|password|secret|apikey|webhookurl)$/.test(lower)) return 'secret';

  if (/(key|keybind)$/.test(lower) && typeof value === 'string') return 'keybind';
  // { _type, _key } is the library's keybind shape
  if (value && typeof value === 'object' && '_key' in (value as object)) return 'keybind';
  if (/control$/.test(lower) && typeof value === 'number') return 'control';
  if (/(time|hours?)$/.test(lower) && typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) return 'time';

  const type = node?.type ?? typeofValue(value);
  if (type === 'object' && !node?.properties && value && typeof value === 'object' && !Array.isArray(value)) {
    // defaultControls is action -> { main: {_type,_key}, alt? } - a keybind map,
    // which the generic key/value editor cannot express
    const entries = Object.values(value as Record<string, unknown>);
    const isKeybindMap = entries.length > 0 && entries.every((entry) => {
      const main = (entry as { main?: unknown })?.main as { _key?: unknown } | undefined;
      return !!main && typeof main === 'object' && '_key' in main;
    });
    if (isKeybindMap) return 'keybindMap';
    // { police = 2 } is group -> minimum grade, which GroupSelect already
    // models properly (it knows the jobs and what each grade is called)
    const isGradeMap = entries.length > 0 && entries.every((entry) => typeof entry === 'number');
    if (isGradeMap || /revokers?$/i.test(lower)) return 'groupGrades';
    return 'keyvalue';
  }
  if (type === 'boolean') return 'boolean';
  if (type === 'integer') return 'integer';
  if (type === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (type === 'array') return 'list';
  if (type === 'object') return looksLikeCoords(value, node) ? 'coords' : 'string';
  return 'string';
}

function typeofValue(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function enumOptions(node: JsonSchema): { value: string; label: string }[] | undefined {
  const raw = node?.enum ?? node?.['x-enum'];
  if (!Array.isArray(raw)) return undefined;
  // `x-enumLabels` lets a schema name its own values. Humanising the raw value
  // is fine for `cut`/`crush`, and useless for locale codes - "Zh-TW" tells
  // nobody it is Traditional Chinese.
  const labels = (node?.['x-enumLabels'] ?? {}) as Record<string, string>;
  return raw.map((v: unknown) => {
    const value = String(v);
    return { value, label: labels[value] ?? humanise(value) };
  });
}

// ── array columns ───────────────────────────────────────────────────────────

/**
 * Columns come from `items.properties` when the schema has them, and from the
 * first default row when it does not - which is the case for several of
 * fishing's arrays today.
 */
function columnsFor(node: JsonSchema, rows: unknown[]): { columns: SettingColumn[]; template: Record<string, unknown> } {
  const itemProps: JsonSchema | undefined = node?.items?.properties;
  const sample = (rows.find((r) => r && typeof r === 'object' && !Array.isArray(r)) ?? {}) as Record<string, unknown>;
  const installList = !!node?.['x-installItemList'];
  const arrayKey: string | undefined = node?.['x-arrayKey'];
  // Reward-pool rows name their own kind. baitDig.randomItems ships no `items`
  // schema and no x-installItemList, so `type: 'item'` is the only evidence
  // that `name` holds an item - and without it the old panel's item picker
  // came through as a plain text box.
  const itemRow = String(sample.type ?? '') === 'item';

  const requiredKeys = new Set<string>(Array.isArray(node?.items?.required) ? node.items.required : []);
  // Several of fishing's arrays declare no `items` schema at all - their shape
  // comes from the default rows - so a rule has no node to hang on. Declaring a
  // full item schema just to carry two rules is a lot of ceremony, so the array
  // itself carries them keyed by column. Keys may be dotted to reach a table
  // inside a row: `x-validateRows: { "stock.variance": [...] }` - which matters
  // because `stores` has BOTH a `name` and a `stock[].name`.
  const rowRules = (node?.['x-validateRows'] ?? {}) as Record<string, ValidationRule[]>;
  const keys = itemProps ? Object.keys(itemProps) : Object.keys(sample);
  const columns: SettingColumn[] = [];
  const template: Record<string, unknown> = {};

  for (const key of keys) {
    const child: JsonSchema = itemProps?.[key] ?? {};
    const value = sample[key];
    const isItemKey = /name$|^item$/.test(key);
    const column = buildColumn(key, child, value, (installList && key === arrayKey) || (itemRow && isItemKey));
    if (requiredKeys.has(key)) column.required = true;
    if (rowRules[key]) column.validate = [...(column.validate ?? []), ...rowRules[key]!];
    columns.push(column);
    template[key] = child.default ?? value ?? defaultForControl(column.type);
  }

  // dotted keys, resolved against the columns just built
  for (const [key, rules] of Object.entries(rowRules)) {
    if (!key.includes('.')) continue;
    const parts = key.split('.');
    let level: SettingColumn[] | undefined = columns;
    let target: SettingColumn | undefined;
    for (const part of parts) {
      target = level?.find((column) => column.key === part);
      level = target?.columns;
    }
    if (target) target.validate = [...(target.validate ?? []), ...rules];
  }

  return { columns, template };
}

/**
 * Builds one column, including the nested shapes a row can hold: a pair of
 * numbers is a range, a list of strings is a tag set, a list of objects is a
 * nested table, and a bounded 0..n float is a slider.
 */
function buildColumn(key: string, child: JsonSchema, value: unknown, isItem: boolean): SettingColumn {
  // Rows written before a field existed simply do not carry it, and the editor
  // showed those blank - fish[].minigameType is declared `default: "cut"` and
  // only the eight crustaceans store "crush", so every other species opened
  // with an empty gutting minigame. Carrying the schema default through means
  // the row editor can show what the server will actually use.
  const built = buildColumnInner(key, child, value, isItem);
  const out: SettingColumn = child.default !== undefined ? { ...built, default: child.default } : built;
  // constraints ride along so a row editor can be validated the same way a
  // top-level setting is
  if (typeof child.minItems === 'number') out.minItems = child.minItems;
  const rules = child['x-validate'] as ValidationRule[] | undefined;
  if (Array.isArray(rules)) out.validate = rules;
  return out;
}

function buildColumnInner(key: string, child: JsonSchema, value: unknown, isItem: boolean): SettingColumn {
  const label = humanise(key);
  const min = child.minimum;
  const max = child.maximum;

  // arrays inside a row
  const arrayValue = Array.isArray(value) ? value : (Array.isArray(child.default) ? child.default : undefined);
  const isArray = child.type === 'array' || arrayValue !== undefined;

  if (isArray && !looksLikeCoords(value, child)) {
    const rows = arrayValue ?? [];
    const sample = rows.find((r) => r && typeof r === 'object' && !Array.isArray(r)) as Record<string, unknown> | undefined;
    const itemProps: JsonSchema | undefined = child?.items?.properties;

    // A list of world positions, not a generic table - four number boxes per
    // entry is the data but not the job. Checked BEFORE the object branch,
    // which would otherwise claim it.
    if (rows.length > 0 && rows.every((r) => r && typeof r === 'object' && !Array.isArray(r)
      && typeof (r as Record<string, unknown>).x === 'number'
      && typeof (r as Record<string, unknown>).y === 'number'
      && typeof (r as Record<string, unknown>).z === 'number')) {
      return { key, label, type: 'positions' };
    }

    if (sample || itemProps) {
      const nestedKeys = itemProps ? Object.keys(itemProps) : Object.keys(sample ?? {});
      const nested: SettingColumn[] = [];
      const nestedTemplate: Record<string, unknown> = {};
      for (const nestedKey of nestedKeys) {
        const nestedChild: JsonSchema = itemProps?.[nestedKey] ?? {};
        const nestedValue = sample?.[nestedKey];
        const built = buildColumn(nestedKey, nestedChild, nestedValue, /name$|^item$/.test(nestedKey));
        nested.push(built);
        nestedTemplate[nestedKey] = nestedChild.default ?? defaultForControl(built.type);
      }
      return {
        key, label, type: 'rows',
        columns: nested,
        rowTemplate: nestedTemplate,
        rowLabelKey: nested.find((c) => c.type === 'item')?.key ?? nested[0]?.key,
      };
    }

    // payment accounts come from the framework, so they get the account picker
    // rather than a free-text tag editor. `paymentMethods` holds the same thing
    // as `permitAccounts`, it is just named for what the store does with it.
    if (/accounts$/i.test(key) || /^paymentmethods$/i.test(key)) return { key, label, type: 'accounts' };
    // "Job / gang / ACE group names" - suggest the framework's own groups but
    // still allow a typed ACE name like group.admin
    if (/groups$/i.test(key)) return { key, label, type: 'groups' };
    // 0-6, and nobody remembers which end Sunday is on
    if (/^days?ofweek$/i.test(key)) return { key, label, type: 'weekdays' };

    // A list of names that must match rows in ANOTHER setting - a tournament's
    // `fish` has to name species that exist. Declared with x-optionsFrom, or
    // inferred when the key is simply the name of a top-level list ('fish' ->
    // fish[].name). Free text here accepts a typo and the tournament then
    // scores nothing, silently.
    const from = child['x-optionsFrom'] as { path?: string; key?: string } | string | undefined;
    if (from) {
      const path = typeof from === 'string' ? from : from.path;
      if (path) {
        return {
          key, label, type: 'pickList',
          optionsFrom: { path, key: (typeof from === 'string' ? 'name' : from.key) ?? 'name' },
        };
      }
    }
    if (siblingLists.has(key) && rows.every((r) => typeof r === 'string')) {
      return { key, label, type: 'pickList', optionsFrom: { path: key, key: 'name' } };
    }

    // A list whose members come from a fixed set - fish.waterTypes is
    // ["fresh","salt"] and nothing else. Free-text chips accept "saltwater"
    // and the fish then never spawns anywhere, silently.
    const memberEnum = child.items?.enum ?? child.items?.['x-enum'];
    if (Array.isArray(memberEnum) && memberEnum.length > 0) {
      return {
        key, label, type: 'enumList',
        options: memberEnum.map((option) => ({ value: String(option), label: humanise(String(option)) })),
      };
    }

    // A fixed pair of numbers reads as a range, not a list. Take that from the
    // SCHEMA where it says so - judging by the value alone meant an identical
    // field got the range control only when it happened to ship a default
    // (fish.weightLimits did, fish.permitWeightLimit and rewardItems[].amount
    // did not, and those two fell through to free-text chips).
    const numericItems = child.items?.type === 'number' || child.items?.type === 'integer';
    if (child.minItems === 2 && child.maxItems === 2 && numericItems) {
      return { key, label, type: 'range', min, max };
    }

    const allNumbers = rows.length > 0 && rows.every((r) => typeof r === 'number');
    if (allNumbers && rows.length === 2) return { key, label, type: 'range', min, max };
    return { key, label, type: 'tags' };
  }

  // An OPEN map of name -> weight, declared by additionalProperties. Falling
  // through to the object branch below froze the keys to whatever the first
  // default row happened to carry, so fish[].baitTypes showed one fish's baits
  // on every fish and nothing could be added.
  // same rule as above: a `maximum` is what makes an open numeric map a weight
  const openValues = child.additionalProperties as JsonSchema | undefined;
  if (openValues
    && (openValues.type === 'number' || openValues.type === 'integer')
    && openValues.maximum !== undefined
    && !/revokers?$/i.test(key)) {
    return {
      key, label, type: 'weightMap',
      min: openValues.minimum ?? 0,
      max: openValues.maximum ?? 1,
      optionsFrom: weightMapSource(key),
    };
  }

  // plain nested object
  if (child.type === 'object' || (value !== null && typeof value === 'object' && !Array.isArray(value) && !looksLikeCoords(value, child))) {
    const sample = (value ?? child.default ?? {}) as Record<string, unknown>;
    const props: JsonSchema | undefined = child.properties;
    const nestedKeys = props ? Object.keys(props) : Object.keys(sample);
    if (nestedKeys.length > 0) {
      return {
        key, label, type: 'object',
        columns: nestedKeys.map((nestedKey) =>
          buildColumn(nestedKey, props?.[nestedKey] ?? {}, sample[nestedKey], false)),
      };
    }
  }

  const control = inferControl(key, child, value, isItem);

  // a bounded float is a slider - biteChance, fightChance, strengthPerUnit and
  // abundance are all 0..1 or 0..2 in fishing's schema
  if ((control === 'number' || control === 'integer')
    && typeof min === 'number' && typeof max === 'number' && max <= 2) {
    return { key, label, type: 'slider', min, max };
  }

  return { key, label, type: control, options: enumOptions(child), min, max };
}

function defaultForControl(control: ControlType): unknown {
  switch (control) {
    case 'boolean': return false;
    case 'number': case 'integer': case 'percent': return 0;
    case 'blipColor': return 46;
    case 'blipSprite': return 1;
    case 'blipDisplay': return 4;
    case 'weekdays': return [];
    case 'enumList': return [];
    case 'pickList': return [];
    case 'weightMap': return {};
    case 'text': return '';
    case 'secret': return '';
    case 'coords': return { x: 0, y: 0, z: 0 };
    case 'range': return [0, 0];
    case 'keyvalue': case 'keybindMap': case 'groupGrades': return {};
    case 'refs': return [];
    case 'positions': return [];
    case 'mantineColor': return 'dirk';
    case 'shade': return 5;
    case 'groups': return [];
    case 'tags': case 'rows': return [];
    case 'object': return {};
    case 'slider': return 0;
    default: return '';
  }
}

function rowLabelKey(columns: SettingColumn[], arrayKey?: string): string | undefined {
  const stringCols = columns.filter((c) => c.type === 'string');
  const label = stringCols.find((c) => c.key === 'label' || c.key === 'name');
  if (label) return label.key;
  if (arrayKey && columns.some((c) => c.key === arrayKey)) return arrayKey;
  return stringCols[0]?.key ?? columns[0]?.key;
}

function rowItemKey(columns: SettingColumn[]): string | undefined {
  return columns.find((c) => c.type === 'item')?.key;
}

// ── the walk ────────────────────────────────────────────────────────────────

/**
 * Where an open map's KEYS should be picked from, when we can tell.
 * `baitTypes` names baits, and a script that configures bait has them in a list
 * already - offering those beats free text that has to match exactly.
 */
function weightMapSource(key: string): { path: string; key: string } | undefined {
  // NOT gated on siblingLists: that set only holds top-level ARRAYS, and
  // fishing's `equipment` is an object holding rods/reel/line/bait/... so the
  // guard was never true and the bait picker came up empty every time. The
  // control resolves the path against the real entry list at render, so a
  // script without `equipment.bait` just gets no suggestions.
  if (/^baittypes?$/i.test(key)) return { path: 'equipment.bait', key: 'name' };
  return undefined;
}

/** Group id for settings shown on a central page rather than the script's rail. */
export const MANAGED_ELSEWHERE = '__managed_elsewhere';

/**
 * Top-level settings that ARE a list, for the conversion currently running.
 * A column named after one of them (a tournament's `fish`) is a reference to
 * it, not free text. Module-level because buildColumn sits several frames down
 * and threading it through every signature would be noise; it is written once
 * at the top of each conversion and read synchronously below.
 */
let siblingLists = new Set<string>();

/** Follow a dotted path into a schema's properties. */
function nodeAt(schema: JsonSchema, path: string): JsonSchema | undefined {
  let node: JsonSchema | undefined = schema;
  for (const part of path.split('.')) {
    node = node?.properties?.[part];
    if (!node) return undefined;
  }
  return node;
}

/**  declared on each array, gathered into the shape the walk wants. */
function collectRowTabs(topLevel: JsonSchema): Record<string, RowTab[]> {
  const out: Record<string, RowTab[]> = {};
  for (const [name, node] of Object.entries(topLevel)) {
    const tabs = node?.['x-rowTabs'] as RowTab[] | undefined;
    if (Array.isArray(tabs)) out[name] = tabs;
  }
  return out;
}

export function schemaToStudio(schema: JsonSchema, meta: StudioMeta): StudioScript {
  const groups: SettingGroup[] = [];
  const entries: SettingEntry[] = [];
  const overrides = meta.overrides ?? {};
  const mapPaths = new Set(meta.mapPaths ?? []);

  const topLevel: JsonSchema = schema?.properties ?? {};

  // A script's LAYOUT is the script's business, so it travels in the script's
  // schema rather than a table inside dirk_lib. The meta still wins when one is
  // supplied, which keeps the door open for a host override, but nothing needs
  // to supply it - a script that ships its own layout just works.
  const sections = meta.sections ?? (schema?.['x-sections'] as StudioMeta['sections']);
  const rowTabs = meta.rowTabs ?? collectRowTabs(topLevel);
  const declaredMapPaths = (schema?.['x-mapPaths'] as string[]) ?? [];
  for (const path of declaredMapPaths) mapPaths.add(path);

  siblingLists = new Set(
    Object.entries(topLevel)
      .filter(([, node]) => node?.type === 'array' || Array.isArray(node?.default))
      .map(([name]) => name),
  );

  for (const [groupId, groupNode] of Object.entries(topLevel)) {
    groups.push({
      id: groupId,
      label: humanise(groupId),
      icon: (groupNode?.['x-icon'] as string) ?? meta.groupIcons?.[groupId] ?? 'sliders-horizontal',
      description: groupNode?.description,
    });

    const serverOnly = !!groupNode?.['x-serverOnly'];

    // A top-level array (fish, zones, stores) is a section holding one list.
    if (groupNode?.type === 'array' || Array.isArray(groupNode?.default)) {
      entries.push(buildListEntry(groupId, groupId, groupNode, groupId, serverOnly, overrides, mapPaths, undefined, rowTabs));
      continue;
    }

    walkObject(groupNode, groupId, groupId, serverOnly, entries, overrides, mapPaths, undefined, rowTabs);
  }

  // ── constraints ─────────────────────────────────────────────────────────
  //
  // The schema IS the validator. `minimum`/`maximum`/`minItems` were already
  // here and only being used to clamp inputs, so nothing stopped a save with a
  // blank required field or an empty list. `required` is a JSON Schema keyword
  // on the PARENT, so it is read from there; `x-validate` carries the two rules
  // JSON Schema cannot say - a backwards [min,max], and "required only when".
  for (const entry of entries) {
    const node = nodeAt(schema, entry.path);
    if (!node) continue;

    const cut = entry.path.lastIndexOf('.');
    const parent = cut === -1 ? schema : nodeAt(schema, entry.path.slice(0, cut));
    const key = entry.path.slice(cut + 1);
    if (Array.isArray(parent?.required) && parent.required.includes(key)) entry.required = true;

    if (typeof node.minItems === 'number') entry.minItems = node.minItems;
    const rules = node['x-validate'] as ValidationRule[] | undefined;
    if (Array.isArray(rules)) entry.validate = rules;
  }

  // ── x-enabledWhen ───────────────────────────────────────────────────────
  //
  // "This only applies while that says X." Declared on a field, or on a whole
  // block to cover every field in it - which is what a master switch actually
  // means: `theme.useOverride` off disables the entire theme, not one row of
  // it. The field a rule POINTS AT is never disabled by it, or turning a
  // switch off would grey out the switch and leave no way back.
  for (const entry of entries) {
    const own = nodeAt(schema, entry.path)?.['x-enabledWhen'] as EnabledWhen | undefined;
    const block = topLevel[entry.path.split('.')[0]!]?.['x-enabledWhen'] as EnabledWhen | undefined;
    const rule = own ?? block;
    if (rule && rule.path !== entry.path) entry.enabledWhen = rule;
  }

  const matches = (path: string, patterns: string[]) =>
    patterns.some((p) => path === p || path.startsWith(`${p}.`));

  // The ten custom stops are edited through `theme.primaryColor` now - pick
  // "custom" there and the base picker appears beside it while Primary Shade
  // renders the stops. A standalone section repeated the same swatches a
  // scroll further down and made the theme look like three settings instead of
  // one decision. The VALUE stays in `entries`; only the row goes.
  for (const entry of entries) {
    if (!entry.path.endsWith('.primaryColor')) continue;
    const prefix = entry.path.slice(0, entry.path.lastIndexOf('.'));
    const custom = entries.find((other) => other.path === `${prefix}.customTheme`);
    if (custom) custom.group = MANAGED_ELSEWHERE;
  }

  // Parked in a group the rail never lists, which drops the section without
  // dropping the values.
  // Settings a dedicated PAGE owns. `bridging` has the Bridges page, which
  // shows what each choice actually resolved to on this server; `access` has
  // the Admins page. Leaving them in the rail as well meant the same values in
  // two places, and two places disagree.
  const managedElsewhere = meta.managedElsewhere
    ?? (schema?.['x-managedElsewhere'] as string[] | undefined);
  if (managedElsewhere?.length) {
    for (const entry of entries) {
      if (matches(entry.path, managedElsewhere)) entry.group = MANAGED_ELSEWHERE;
    }
  }

  // Re-home settings into declared sections, then order the rail so the
  // declared ones lead and anything unclaimed keeps its schema position.
  if (sections?.length) {

    for (const entry of entries) {
      if (entry.group === MANAGED_ELSEWHERE) continue;
      const section = sections.find((s) => matches(entry.path, s.paths));
      if (!section) continue;
      entry.group = section.id;
      // a sub-block label only helps when it is not just restating the section
      if (entry.subgroup && entry.subgroup.label === section.label) entry.subgroup = undefined;
    }

    for (const section of sections) {
      if (groups.some((g) => g.id === section.id)) continue;
      groups.push({
        id: section.id,
        label: section.label,
        icon: section.icon,
        description: section.description,
      });
    }

    const order = new Map(sections.map((s, i) => [s.id, i]));
    groups.sort((a, b) => (order.get(a.id) ?? 500) - (order.get(b.id) ?? 500));
  }

  return {
    resource: meta.resource,
    label: meta.label,
    icon: meta.icon,
    version: meta.version,
    shared: meta.shared,
    groups: groups.filter((g) => g.id !== MANAGED_ELSEWHERE && entries.some((e) => e.group === g.id)),
    entries,
  };
}

function walkObject(
  node: JsonSchema,
  path: string,
  group: string,
  serverOnly: boolean,
  out: SettingEntry[],
  overrides: Record<string, unknown>,
  mapPaths: Set<string>,
  subgroup: SettingEntry['subgroup'],
  rowTabs?: StudioMeta['rowTabs'],
) {
  const props: JsonSchema = node?.properties ?? {};
  const defaults: Record<string, unknown> = (node?.default ?? {}) as Record<string, unknown>;

  for (const [key, child] of Object.entries(props)) {
    const childPath = `${path}.${key}`;
    const childServerOnly = serverOnly || !!child?.['x-serverOnly'];
    const fallback = child?.default ?? defaults?.[key];

    if (child?.type === 'array' || Array.isArray(fallback)) {
      out.push(buildListEntry(childPath, key, child, group, childServerOnly, overrides, mapPaths, subgroup, rowTabs));
      continue;
    }

    // A nested object becomes a labelled sub-block inside the section rather
    // than a flat run of dotted paths. Objects with NO declared properties fall
    // through to the key/value editor instead - there is nothing to recurse.
    if (child?.type === 'object' && child?.properties && Object.keys(child.properties).length > 0
      && !looksLikeCoords(fallback, child)) {
      walkObject(child, childPath, group, childServerOnly, out, overrides, mapPaths, {
        id: childPath,
        label: humanise(key),
      }, rowTabs);
      continue;
    }

    const control = inferControl(key, child, fallback);
    const value = childPath in overrides ? overrides[childPath] : fallback;

    out.push({
      path: childPath,
      label: humanise(key),
      help: child?.description,
      type: control,
      group,
      subgroup,
      default: fallback,
      value,
      min: child?.minimum,
      max: child?.maximum,
      options: enumOptions(child),
      serverOnly: childServerOnly || undefined,
    });
  }
}

function buildListEntry(
  path: string,
  key: string,
  node: JsonSchema,
  group: string,
  serverOnly: boolean,
  overrides: Record<string, unknown>,
  mapPaths: Set<string>,
  subgroup?: SettingEntry['subgroup'],
  rowTabs?: StudioMeta['rowTabs'],
): SettingEntry {
  const fallback = Array.isArray(node?.default) ? node.default : [];
  const value = path in overrides ? overrides[path] : fallback;
  const rows = Array.isArray(value) ? value : [];

  const numericRows = rows.length > 0 && rows.every((r) => typeof r === 'number');
  const namedControls = /(control|key)/i.test(key);

  // A pair of numbers is a min/max, whatever it is called. This has to be
  // tested BEFORE the control-id branch: that branch used to claim any array
  // of numbers, which turned baitDig.gridDensity ([5,10] dig tiles) and
  // basic.cellFishDensity into GTA control-id pickers.
  if (numericRows && rows.length === 2 && !namedControls) {
    return {
      path,
      label: humanise(key),
      help: node?.description,
      type: 'range',
      group,
      subgroup,
      default: fallback,
      value,
      serverOnly: serverOnly || undefined,
    };
  }

  // Numeric control ids drive IsControlPressed / DisableControlAction, which is
  // a different thing from a keybind primary key - the library models them as
  // separate components, so the schema walk has to tell them apart too. The
  // KEY has to say so; being an array of numbers is not evidence.
  if (namedControls && (numericRows || rows.length === 0)) {
    return {
      path,
      label: humanise(key),
      help: node?.description,
      type: 'controls',
      group,
      subgroup,
      default: fallback,
      value,
      serverOnly: serverOnly || undefined,
    };
  }

  // A Mantine colour tuple is a fixed 10 shades generated from one root colour,
  // not a list an admin adds to - so it gets the palette control.
  const isPalette = /theme$/i.test(key) || (
    rows.length === 10 && rows.every((r) => typeof r === 'string' && /^#?[0-9a-f]{3,8}$/i.test(String(r)))
  );
  if (isPalette) {
    return {
      path,
      label: humanise(key),
      help: node?.description,
      type: 'palette',
      group,
      subgroup,
      default: fallback,
      value,
      serverOnly: serverOnly || undefined,
    };
  }

  // Arrays of plain strings/numbers get a single synthetic column so they can
  // still be added to and removed from.
  // These were only checked when building a COLUMN, so a top-level array of
  // strings - basic.permitAccounts is ["cash","bank"] - rendered as "entry 1,
  // entry 2" instead of the picker that knows what those words mean.
  if (/accounts$/i.test(key)) {
    return {
      path, label: humanise(key), help: node?.description, type: 'accounts',
      group, subgroup, default: fallback, value, serverOnly: serverOnly || undefined,
    };
  }
  if (/groups$/i.test(key)) {
    return {
      path, label: humanise(key), help: node?.description, type: 'groups',
      group, subgroup, default: fallback, value, serverOnly: serverOnly || undefined,
    };
  }

  // A list of world positions. The generic table renderer turns each one into
  // four number boxes, and nobody configures a store by typing coordinates -
  // the old panel gave these a goto/set pair and this keeps that.
  if (rows.length > 0 && rows.every((row) => row && typeof row === 'object' && !Array.isArray(row)
    && typeof (row as Record<string, unknown>).x === 'number'
    && typeof (row as Record<string, unknown>).y === 'number'
    && typeof (row as Record<string, unknown>).z === 'number')) {
    return {
      path, label: humanise(key), help: node?.description, type: 'positions',
      group, subgroup, default: fallback, value, serverOnly: serverOnly || undefined,
    };
  }

  // Rows that point at other settings rather than holding a value.
  if (node?.['x-arrayKey'] === 'ref' || (rows[0] && typeof rows[0] === 'object' && 'ref' in (rows[0] as object))) {
    return {
      path, label: humanise(key), help: node?.description, type: 'refs',
      group, subgroup, default: fallback, value, serverOnly: serverOnly || undefined,
    };
  }

  const isScalarList = rows.length > 0 && rows.every((r) => typeof r !== 'object' || r === null);

  if (isScalarList || (!node?.items?.properties && rows.length === 0)) {
    return {
      path,
      label: humanise(key),
      help: node?.description,
      type: 'list',
      group,
      subgroup,
      rowLabelKey: 'value',
      columns: [{ key: 'value', label: humanise(key), type: inferControl(key, {}, rows[0]) }],
      rowTemplate: { value: '' },
      default: fallback,
      value,
      serverOnly: serverOnly || undefined,
    };
  }

  const { columns, template } = columnsFor(node, rows);

  return {
    path,
    label: humanise(key),
    help: node?.description,
    type: mapPaths.has(path) ? 'zones' : 'list',
    group,
    subgroup,
    rowLabelKey: rowLabelKey(columns, node?.['x-arrayKey']),
    rowItemKey: rowItemKey(columns),
    rowTabs: rowTabs?.[path],
    columns,
    rowTemplate: template,
    default: fallback,
    value,
    serverOnly: serverOnly || undefined,
  };
}
