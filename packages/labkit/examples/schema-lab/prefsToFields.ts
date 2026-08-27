import type { ToolPrefGroup } from '@weasel-js/core';
import type { ConfigField } from '@weasel-js/labkit';

/** weasel's own property-schema group. */
export type PrefGroup = ToolPrefGroup;
type PrefNode = PrefGroup['children'][string];
type PrefLeaf = Exclude<PrefNode, PrefGroup>;

/** A leaf of a weasel pref schema, paired with the dotted node path it edits
 *  (`pose.x`, `data.fill`). Group keys are organizational and contribute
 *  nothing to the path. */
export interface FlatPref {
  path: string;
  leaf: PrefLeaf;
}

function isGroup(node: PrefNode): node is PrefGroup {
  return 'children' in node && !('kind' in node);
}

export function flattenPrefs(group: PrefGroup): FlatPref[] {
  const out: FlatPref[] = [];
  for (const [key, node] of Object.entries(group.children)) {
    if (isGroup(node)) out.push(...flattenPrefs(node));
    else out.push({ path: key, leaf: node as PrefLeaf });
  }
  return out;
}

/** Translate one weasel pref leaf into the labkit control that edits it.
 *  Returns null for a kind labkit has no control for — a `paint` leaf is a
 *  tagged union, not a hex string, and faking it with a color swatch would
 *  write a solid color over a gradient. */
export function prefToField(path: string, leaf: PrefLeaf): ConfigField | null {
  const label = leaf.name;
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
    case 'stroke':
      // `string | Stroke`, and a color swatch can only edit the string form —
      // writing a hex over the object form would flatten away its width, cap,
      // join and dash. Editing the union properly takes a control that knows
      // it is a union, which is what weasel-ui's `stroke` control is for.
      return typeof leaf.default === 'string'
        ? { key: path, label, type: 'color', default: leaf.default.slice(0, 7) }
        : null;
    default:
      return null;
  }
}

/** A weasel property schema, as an instrument's `configSchema()`. */
export function prefsToFields(group: PrefGroup): ConfigField[] {
  return flattenPrefs(group)
    .map(({ path, leaf }) => prefToField(path, leaf))
    .filter((f): f is ConfigField => f !== null);
}

/** Defaults for every field the schema produced, keyed by node path. */
export function prefDefaults(group: PrefGroup): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of prefsToFields(group)) out[field.key] = field.default;
  return out;
}

/** Undo a leaf's display-unit conversion — the panel edits degrees, the node
 *  stores radians. */
export function decodePrefValue(leaf: PrefLeaf, value: unknown): unknown {
  const unit = (leaf as { unit?: { fromDisplay: (v: number) => number } }).unit;
  return unit && typeof value === 'number' ? unit.fromDisplay(value) : value;
}

/** Write `value` at a dotted path inside `target`, cloning each level so the
 *  scene sees a new object. */
export function setAtPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  const [head, ...rest] = path;
  if (head === undefined) return;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  const next = { ...((target[head] as Record<string, unknown>) ?? {}) };
  target[head] = next;
  setAtPath(next, rest, value);
}
