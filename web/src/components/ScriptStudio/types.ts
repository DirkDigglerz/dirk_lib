import type { Condition, ValidationRule } from './conditions';

// Shape the hub renders from. Deliberately mirrors what a schema.json walk
// would produce server-side (label / help / type / default / value per path),
// so swapping mock data for the real describe() payload is a data change only.

export type ControlType =
  | 'boolean'
  | 'number'
  | 'integer'
  | 'percent'
  | 'string'
  | 'secret'
  | 'weekdays'
  | 'text'
  | 'enum'
  | 'enumList'
  | 'pickList'
  | 'color'
  | 'blipColor'
  | 'blipSprite'
  | 'blipDisplay'
  | 'ped'
  | 'vehicle'
  | 'coords'
  | 'positions'
  | 'time'
  | 'keybind'
  | 'control'
  | 'controls'
  | 'item'
  /** one framework job or gang, picked from the server's real list */
  | 'group'
  /** the owning script supplies the editor; see `x-component` */
  | 'custom'
  /** a lucide icon, picked by looking at it rather than typed */
  | 'icon'
  | 'list'
  | 'zones'
  | 'palette'
  | 'slider'
  | 'range'
  | 'tags'
  | 'account'
  | 'accounts'
  | 'groups'
  | 'model'
  | 'keyvalue'
  | 'weightMap'
  | 'keybindMap'
  | 'groupGrades'
  | 'refs'
  | 'mantineColor'
  | 'shade'
  | 'rows'
  | 'object';

export type SettingOption = {
  /**
   * lucide icon name and hex colour for this value, from `x-enumIcons` /
   * `x-enumColors`.
   *
   * dirk_lib cannot know that a place category of "fuel" is a blue pump - that
   * is the owning script's knowledge, so it travels in the schema. Carried on
   * the option itself so one annotation serves both the picker (a grid of real
   * pins instead of a dropdown of words) and the map (markers in the script's
   * own colours).
   */
  icon?: string;
  color?: string; value: string; label: string };

export type SettingColumn = {
  /** see SettingEntry.validateWith */
  validateWith?: string;
  /**
   * This column holds an inventory item because the SCHEMA said so
   * (`x-installItem` / `x-installItemList`), not because the control was
   * inferred as an item picker.
   *
   * The missing-items audit uses this and nothing else. Auditing by rendered
   * control meant any row with a `name` field got scraped, so dirk_phone was
   * told the job names "realestate" and "ambulance" were missing items.
   */
  installItem?: boolean;
  key: string;
  /** schema constraints, checked before a save is allowed */
  required?: boolean;
  minItems?: number;
  validate?: ValidationRule[];
  label: string;
  type: ControlType;
  suffix?: string;
  options?: SettingOption[];
  /** pickList: the setting whose rows supply the options, e.g. 'fish' */
  optionsFrom?: { path: string; key: string };
  min?: number;
  max?: number;
  /** the schema's default for this field, shown when a row omits the key */
  default?: unknown;
  /** rows/object columns carry their own child columns */
  columns?: SettingColumn[];
  rowTemplate?: Record<string, unknown>;
  rowLabelKey?: string;
  /** which modal tab this field belongs to */
  tab?: string;
};

export type RowTab = { id: string; label: string; icon: string; keys: string[] };

/**
 * "This setting only applies while that one says X."
 *
 * Declared with `x-enabledWhen` on a field, or on a whole block to cover every
 * field in it. The controlling field is never disabled by its own rule.
 */
export type EnabledWhen = Condition & { path: string; equals?: unknown };

export type SettingEntry = {
  /** declared with `x-installItem`; see SettingColumn.installItem */
  installItem?: boolean;
  /**
   * NUI callback that says whether a typed value is actually valid, from
   * `x-validateWith`.
   *
   * Range checks catch a number out of bounds; only the service behind an API
   * key can say the key works. Without this a revoked token looks exactly like
   * a good one until something silently fails much later.
   */
  validateWith?: string;
  /**
   * How this array draws on the map: an outline per row, or a pin per row.
   * Only set for a path listed in `x-mapPaths`.
   */
  mapShape?: 'polygon' | 'marker';
  /** the map colour this layer was given in `x-mapPaths` */
  mapColor?: string;
  /**
   * Path to a component the OWNING resource ships, from `x-component`.
   *
   * Read out of that resource by Lua and evaluated in the panel, so a script
   * can render something only it understands without a line of its code
   * living in dirk_lib.
   */
  component?: string;
  path: string;
  /** schema constraints, checked before a save is allowed */
  required?: boolean;
  minItems?: number;
  validate?: ValidationRule[];
  /** greyed out, with the reason, while this condition is unmet */
  enabledWhen?: EnabledWhen;
  label: string;
  help?: string;
  type: ControlType;
  group: string;
  /** nested object inside a section - rendered as a labelled sub-block */
  subgroup?: { id: string; label: string };
  default: unknown;
  value: unknown;

  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: SettingOption[];
  /** pickList: the setting whose rows supply the options, e.g. 'fish' */
  optionsFrom?: { path: string; key: string };

  /** list-only: typed columns for each row, plus the template for a new row */
  columns?: SettingColumn[];
  rowTemplate?: Record<string, unknown>;
  /** which column titles the row in the summary list */
  rowLabelKey?: string;
  /** which column carries an inventory item name (drives the image slot) */
  rowItemKey?: string;
  /** explicit modal tabs; falls back to General + one tab per nested field */
  rowTabs?: RowTab[];

  /** renders the RESTART REQUIRED chip — schema x-restartRequired */
  restartRequired?: boolean;
  /** never leaves the server; the panel gets it through the gated callback */
  serverOnly?: boolean;
};

export type SettingGroup = {
  id: string;
  label: string;
  icon: string;
  description?: string;
};

export type StudioScript = {
  resource: string;
  label: string;
  icon: string;
  version: string;
  /** dirk_lib's own shared layer — pinned to the bottom of the rail */
  shared?: boolean;
  /** this script ships a design editor, so the rail lists a Design entry for it */
  designs?: boolean;
  groups: SettingGroup[];
  entries: SettingEntry[];
  /**
   * The config exactly as the server holds it, nested.
   *
   * Kept alongside the flat `entries` because a save sends whole SECTIONS, and
   * rebuilding a section out of flat leaves would silently drop anything the
   * schema does not describe. Saving edits a copy of this instead.
   */
  serverValues?: Record<string, unknown>;
  /**
   * Config version this panel was opened against. Sent back on save so a stale
   * panel is rejected rather than quietly overwriting someone else's change.
   */
  clientVersion?: number;
};
