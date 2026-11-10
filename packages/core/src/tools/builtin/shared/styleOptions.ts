/**
 * The style a shape tool draws with, declared as its tool options: fill,
 * stroke, stroke width, and a path's fill rule. Each is shared under its own
 * name, so every shape tool reads one fill until a tool or its user keeps one
 * of its own (`share: { fill: null }`).
 */
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { Paint } from '@weasel-js/paint';
import { DEFAULT_STROKE_WIDTH, type InsertStyle, type StyleOptionKey } from 'interactions/actions/insert/style';
import type { ToolOptions } from '@weasel-js/routing';
import { cycleFill, solid } from '../../../util/paint';

export { DEFAULT_STROKE_WIDTH, STYLE_OPTION_KEYS, type InsertStyle, type StyleOptionKey } from 'interactions/actions/insert/style';

/** The kit's color for a new shape: the first of its palette. */
export const DEFAULT_SHAPE_PAINT: Paint = solid(cycleFill(0));

const paintLeaf = (name: string, description: string, value: Paint | null): PrefLeaf => ({
  kind: 'paint', name, description, alpha: true, default: value,
});

/** Each style option's leaf, defaulting to `defaults`. */
export function styleOptionLeaves(defaults: InsertStyle, keys: readonly StyleOptionKey[]): Record<string, PrefLeaf> {
  const all: Record<StyleOptionKey, PrefLeaf> = {
    fill: paintLeaf('Fill', 'What a new shape is filled with.', defaults.fill ?? null),
    stroke: paintLeaf('Stroke', 'What a new shape’s outline is painted with.', defaults.stroke ?? null),
    strokeWidth: {
      kind: 'number', name: 'Stroke width', description: 'How thick a new shape’s outline is, in world units.',
      default: defaults.strokeWidth ?? DEFAULT_STROKE_WIDTH, min: 0, max: 200, step: 0.5,
    },
    fillRule: {
      kind: 'enum', name: 'Fill rule', description: 'Which regions of a new path its fill covers.',
      default: defaults.fillRule ?? 'nonzero',
      options: [{ value: 'nonzero', label: 'Nonzero' }, { value: 'evenodd', label: 'Even-odd' }],
    },
  };
  const out: Record<string, PrefLeaf> = {};
  for (const key of keys) out[key] = all[key];
  return out;
}

/** What a shape tool declares about its options. */
export interface ShapeToolOptionsSpec {
  /** The action, or actions, the options are params of. */
  actionId: ToolOptions['actionId'];
  /** The options group's name: the tool's. */
  name: string;
  /** Which style options it takes, and their defaults. */
  style: InsertStyle;
  keys: readonly StyleOptionKey[];
  /** Its options besides the style ones, kept per tool. */
  own?: PrefGroup['children'];
}

/** A shape tool's options: its style options, each shared under its own name, and its own beside them. */
export function shapeToolOptions(spec: ShapeToolOptionsSpec): ToolOptions {
  const share: Record<string, string> = {};
  for (const key of spec.keys) share[key] = key;
  return {
    actionId: spec.actionId,
    prefs: { name: spec.name, as: 'bar', children: { ...styleOptionLeaves(spec.style, spec.keys), ...spec.own } },
    share,
  };
}
