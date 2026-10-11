import { type ConfigField, withValueAtPath } from '@weasel-js/labkit';
import { isBuiltinPref, type PrefLeaf, type PrefObject, type PrefSection, prefSectionLeaves } from '@weasel-js/prefs';

/** A leaf of a node's property schema, paired with the dotted node path it
 *  edits (`pose.x`, `data.fill`): its own key, whatever sections it sits under. */
export interface FlatPref {
  path: string;
  leaf: PrefLeaf;
}

/** Every leaf of `schema` by node path. An `object` leaf holds one value with
 *  its own fields — a `Stroke`, say — and gives a row per field addressed
 *  under it: `setAtPath` clones each level, so no field is ever written into
 *  a half-built object. */
export function flattenPrefs(schema: PrefSection): FlatPref[] {
  return prefSectionLeaves(schema.members).flatMap(([path, leaf]): FlatPref[] =>
    isBuiltinPref(leaf) && leaf.kind === 'object'
      ? prefSectionLeaves((leaf as PrefObject).children).map(([key, field]) => ({ path: `${path}.${key}`, leaf: field }))
      : [{ path, leaf }],
  );
}

/** Translate one weasel pref leaf into the labkit control that edits it.
 *  Returns null for a kind labkit has no control for — a `paint` leaf is a
 *  tagged union, not a hex string, and faking it with a color swatch would
 *  write a solid color over a gradient. */
export function prefToField(path: string, leaf: PrefLeaf): ConfigField | null {
  const label = leaf.name;
  // An app-defined kind is the lab's own business; only the built-ins are
  // this function's to translate.
  if (!isBuiltinPref(leaf)) return null;
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as PrefLeaf & {
        default: number;
        min?: number;
        max?: number;
        step?: number;
        control?: string;
        unit?: { toDisplay: (v: number) => number };
      };
      const toDisplay = n.unit?.toDisplay ?? ((v: number) => v);
      const bounded = n.min !== undefined && n.max !== undefined;
      if (bounded && n.control !== 'input') {
        return {
          key: path,
          label,
          type: 'slider',
          default: toDisplay(n.default),
          min: toDisplay(n.min as number),
          max: toDisplay(n.max as number),
          step: n.step,
        };
      }
      return {
        key: path,
        label,
        type: 'number',
        default: toDisplay(n.default),
        min: n.min === undefined ? undefined : toDisplay(n.min),
        max: n.max === undefined ? undefined : toDisplay(n.max),
        step: n.step,
      };
    }
    case 'boolean':
      return { key: path, label, type: 'checkbox', default: leaf.default as boolean };
    case 'string':
    case 'field':
      return { key: path, label, type: 'text', default: leaf.default as string };
    case 'enum': {
      const e = leaf as PrefLeaf & {
        default: string;
        options: readonly { value: string; label: string }[];
      };
      return {
        key: path,
        label,
        type: 'select',
        default: e.default,
        options: e.options.map((o) => ({ value: o.value, label: o.label })),
      };
    }
    case 'color':
      // `#rrggbbaa` is legal in the schema and illegal in `<input type="color">`.
      return { key: path, label, type: 'color', default: (leaf.default as string).slice(0, 7) };
    case 'paint':
    case 'object':
    case 'list':
    case 'map':
    case 'union':
    case 'action':
    case 'alias':
      // Declined: a `ConfigField` is a scalar control, and neither a paint
      // union, an object leaf nor a list survives being flattened into one.
      return null;
    default: {
      const _exhaustive: never = leaf;
      throw new Error(
        `prefToField: no control for built-in pref kind "${(_exhaustive as { kind: string }).kind}"`,
      );
    }
  }
}

/** A weasel property schema, as an instrument's `configSchema()`. */
export function prefsToFields(schema: PrefSection): ConfigField[] {
  return flattenPrefs(schema)
    .map(({ path, leaf }) => prefToField(path, leaf))
    .filter((f): f is ConfigField => f !== null);
}

/** Defaults for every field the schema produced, nested at each field's node
 *  path — labkit reads and writes a dotted key as a path, not a flat name. */
export function prefDefaults(schema: PrefSection): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  for (const field of prefsToFields(schema)) out = withValueAtPath(out, field.key, field.default);
  return out;
}

/** The stored form of a value the panel holds in display form: a number
 *  leaves its display unit (the panel edits degrees, the node stores radians),
 *  and an enum option goes through the leaf's `encoding` (a dash style is
 *  stored as lengths, no marker as no field). `siblings` is the object the
 *  leaf is a field of — a dash preset is a multiple of the sibling `width`.
 *  `undefined` means the field is removed. */
export function decodePrefValue(leaf: PrefLeaf, value: unknown, siblings?: Record<string, unknown>): unknown {
  if (isBuiltinPref(leaf) && leaf.kind === 'enum' && leaf.encoding && typeof value === 'string') {
    return leaf.encoding.write(value, siblings);
  }
  const unit = (leaf as { unit?: { fromDisplay: (v: number) => number } }).unit;
  return unit && typeof value === 'number' ? unit.fromDisplay(value) : value;
}

/** Write `value` at a dotted path inside `target`, cloning each level so the
 *  scene sees a new object. `undefined` deletes the field. */
export function setAtPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  const [head, ...rest] = path;
  if (head === undefined) return;
  if (rest.length === 0) {
    if (value === undefined) delete target[head];
    else target[head] = value;
    return;
  }
  const next = { ...((target[head] as Record<string, unknown>) ?? {}) };
  target[head] = next;
  setAtPath(next, rest, value);
}
