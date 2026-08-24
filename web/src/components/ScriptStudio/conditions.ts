/**
 * One condition grammar, used by two things that turned out to be the same
 * question: "should this setting be editable right now?" (`x-enabledWhen`) and
 * "is this setting valid?" (`x-validate`). Both are statements about the value
 * of some other setting, so they share an evaluator rather than each growing
 * its own — and neither needs a bespoke component to express "greater than".
 *
 *   { "path": "theme.useOverride", "equals": true }
 *   { "path": "basic.permitPrice", "gt": 0 }
 *   { "path": "basic.maxTraps", "gte": 1, "lte": 20 }
 *   { "path": "basic.interact", "in": ["target", "interact"] }
 *   { "path": "logging.webhookUrl", "isSet": true }
 *   { "allOf": [ ... ] }   { "anyOf": [ ... ] }   { "not": { ... } }
 *
 * `path` may name another setting, or `self` for the value being tested — which
 * is what lets a validation rule talk about its own field.
 */

export type Condition =
  | {
    path?: string;
    equals?: unknown;
    /** deep-equal against any of these */
    in?: unknown[];
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    /** true = must be present and non-empty, false = must be empty */
    isSet?: boolean;
    /** for arrays and strings */
    minLength?: number;
    maxLength?: number;
    /** a two-number range whose first entry must not exceed its second */
    ascending?: boolean;
    /** compare against ANOTHER setting rather than a literal */
    lteField?: string;
    gteField?: string;
    ltField?: string;
    gtField?: string;
    /** a two-number range whose first entry must be STRICTLY below its second */
    strictlyAscending?: boolean;
  }
  | { allOf: Condition[] }
  | { anyOf: Condition[] }
  | { not: Condition };

/** A rule that produces a message when its condition fails. */
export type ValidationRule = {
  /** which field the message belongs to; defaults to the annotated one */
  path?: string;
  /** only checked while this holds — "required, but only when permits are on" */
  when?: Condition;
  /** the condition the value must satisfy */
  must: Condition;
  message: string;
};

/** How a rule reads a value out of the config being checked. */
export type Lookup = (path: string) => unknown;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a !== null && b !== null) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function length(value: unknown): number | undefined {
  if (typeof value === 'string') return value.trim().length;
  if (Array.isArray(value)) return value.length;
  return undefined;
}

/**
 * Evaluate one condition. `self` is the value under test, so a rule can say
 * `{ gt: 0 }` about its own field without repeating its path.
 */
export function test(condition: Condition, self: unknown, lookup: Lookup): boolean {
  if ('allOf' in condition) return condition.allOf.every((c) => test(c, self, lookup));
  if ('anyOf' in condition) return condition.anyOf.some((c) => test(c, self, lookup));
  if ('not' in condition) return !test(condition.not, self, lookup);

  const value = condition.path && condition.path !== 'self' ? lookup(condition.path) : self;

  if ('equals' in condition && !sameValue(value, condition.equals)) return false;
  if (condition.in && !condition.in.some((option) => sameValue(value, option))) return false;
  if (condition.isSet !== undefined && isEmpty(value) === condition.isSet) return false;

  const size = length(value);
  if (condition.minLength !== undefined && (size ?? 0) < condition.minLength) return false;
  if (condition.maxLength !== undefined && (size ?? 0) > condition.maxLength) return false;

  const numeric = typeof value === 'number' ? value : undefined;
  if (condition.gt !== undefined && !(numeric !== undefined && numeric > condition.gt)) return false;
  if (condition.gte !== undefined && !(numeric !== undefined && numeric >= condition.gte)) return false;
  if (condition.lt !== undefined && !(numeric !== undefined && numeric < condition.lt)) return false;
  if (condition.lte !== undefined && !(numeric !== undefined && numeric <= condition.lte)) return false;

  // `[min, max]` where min must not exceed max — the single most common rule in
  // the old zod schemas, and the one JSON Schema itself cannot express.
  if (condition.ascending) {
    if (!Array.isArray(value) || value.length < 2) return false;
    const [low, high] = value as number[];
    if (typeof low !== 'number' || typeof high !== 'number' || low > high) return false;
  }

  if (condition.strictlyAscending) {
    if (!Array.isArray(value) || value.length < 2) return false;
    const [low, high] = value as number[];
    if (typeof low !== 'number' || typeof high !== 'number' || low >= high) return false;
  }

  if (condition.lteField !== undefined) {
    const other = lookup(condition.lteField);
    if (typeof numeric !== 'number' || typeof other !== 'number' || numeric > other) return false;
  }
  if (condition.gteField !== undefined) {
    const other = lookup(condition.gteField);
    if (typeof numeric !== 'number' || typeof other !== 'number' || numeric < other) return false;
  }
  if (condition.ltField !== undefined) {
    const other = lookup(condition.ltField);
    if (typeof numeric !== 'number' || typeof other !== 'number' || numeric >= other) return false;
  }
  if (condition.gtField !== undefined) {
    const other = lookup(condition.gtField);
    if (typeof numeric !== 'number' || typeof other !== 'number' || numeric <= other) return false;
  }

  return true;
}

/** Human-readable summary, for the tooltip on a disabled row. */
export function describe(condition: Condition): string {
  if ('allOf' in condition) return condition.allOf.map(describe).join(' and ');
  if ('anyOf' in condition) return condition.anyOf.map(describe).join(' or ');
  if ('not' in condition) return `not ${describe(condition.not)}`;

  const where = condition.path && condition.path !== 'self' ? `${condition.path} ` : '';
  const parts: string[] = [];
  if ('equals' in condition) parts.push(`is ${format(condition.equals)}`);
  if (condition.in) parts.push(`is one of ${condition.in.map(format).join(', ')}`);
  if (condition.isSet === true) parts.push('is set');
  if (condition.isSet === false) parts.push('is empty');
  if (condition.gt !== undefined) parts.push(`is above ${condition.gt}`);
  if (condition.gte !== undefined) parts.push(`is at least ${condition.gte}`);
  if (condition.lt !== undefined) parts.push(`is below ${condition.lt}`);
  if (condition.lte !== undefined) parts.push(`is at most ${condition.lte}`);
  if (condition.minLength !== undefined) parts.push(`has at least ${condition.minLength}`);
  if (condition.maxLength !== undefined) parts.push(`has at most ${condition.maxLength}`);
  if (condition.ascending) parts.push('has a minimum no higher than its maximum');
  if (condition.strictlyAscending) parts.push('has a minimum below its maximum');
  if (condition.ltField) parts.push(`is below ${condition.ltField}`);
  if (condition.gtField) parts.push(`is above ${condition.gtField}`);
  if (condition.lteField) parts.push(`is at most ${condition.lteField}`);
  if (condition.gteField) parts.push(`is at least ${condition.gteField}`);

  return `${where}${parts.join(' and ') || 'is anything'}`;
}

function format(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (value === null || value === undefined) return 'unset';
  return String(value);
}
