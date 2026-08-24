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

export type SettingOption = { value: string; label: string };

export type SettingColumn = {
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
};
