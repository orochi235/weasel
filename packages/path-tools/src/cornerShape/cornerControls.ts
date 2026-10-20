/**
 * The controls for the selected corners of a path in edit: a schema any
 * prefs form draws, the values and mixed fields it shows for a selection,
 * and the `setCorners` params a change to one of them makes.
 */
import {
  CORNER_KEYWORDS,
  cornerFrames,
  cornerKeywordOf,
  cornerShapeK,
  cornerSpecAt,
  type CornerKeyword,
  type CornerShape,
  type PolygonPath,
} from '@weasel-js/geom';
import type { PrefGroup } from '@weasel-js/prefs';

/** How far the parameter slider reaches either side of the bevel; the
 *  `square` and `notch` keywords stand for the two infinities beyond it. */
export const CORNER_K_SLIDER_RANGE = 4;

const ENABLED = { path: 'count', above: 0 };

/** What the corner controls ask for while no corner is selected. */
export const CORNER_CONTROLS_PROMPT = 'Click a corner anchor (Shift-click for more) to edit it';

/** The corner controls as a prefs schema: the keywords, the parameter, and
 *  the radius, each disabled while no corner is selected. */
export const CORNER_CONTROLS: PrefGroup = {
  name: 'Corner shape',
  children: {
    count: { kind: 'number', name: 'Selected corners', description: '', default: 0, hidden: true },
    shape: {
      kind: 'enum', name: 'Shape', description: '', default: 'round', control: 'toggle', enableIf: ENABLED,
      options: CORNER_KEYWORDS.map((w) => ({ value: w, label: w })),
      // A parameter between the keywords, or a sharp corner, presses none.
      encoding: {
        read: (stored) => (CORNER_KEYWORDS.includes(stored as CornerKeyword) ? (stored as CornerKeyword) : undefined),
        write: (option) => option,
      },
    },
    k: {
      kind: 'number', name: 'Curvature', description: 'The superellipse() parameter: 1 is round, 0 a bevel, -1 a scoop.',
      default: 1, min: -CORNER_K_SLIDER_RANGE, max: CORNER_K_SLIDER_RANGE, step: 0.05, control: 'slider', enableIf: ENABLED,
    },
    radius: {
      kind: 'number', name: 'Radius', description: 'How far along each edge the corner is cut.',
      default: 0, min: 0, step: 1, control: 'input', enableIf: ENABLED,
    },
  },
};

/** What the controls show for a selection. */
export interface CornerControlsState {
  /** `shape` is `'none'` where no keyword applies, which the leaf's encoding
   *  reads as no option: a value held, so a form does not show the default. */
  values: { count: number; shape: CornerKeyword | 'none'; k?: number; radius?: number };
  /** The fields whose selected corners disagree. */
  mixed: ReadonlySet<string>;
}

const SHARP = Symbol('sharp');

/** One value if every entry agrees, `SHARP` if they agree on being sharp,
 *  else undefined. */
function agreed<T>(values: readonly (T | typeof SHARP)[]): { value?: T; mixed: boolean } {
  const first = values[0];
  if (!values.every((v) => Object.is(v, first))) return { mixed: true };
  return { value: first === SHARP ? undefined : (first as T), mixed: false };
}

/** The controls for the corners of `path` among `selected` anchors. A sharp
 *  corner shows no shape and no parameter. */
export function cornerControlsState(path: PolygonPath | null, selected: ReadonlySet<number>): CornerControlsState {
  if (!path) return { values: { count: 0, shape: 'none' }, mixed: new Set() };
  const specs = cornerFrames(path).filter((f) => selected.has(f.index)).map((f) => cornerSpecAt(path, f.index));
  const cut = specs.map((c) => (c && c.radius > 0 ? c : SHARP));
  const shape = agreed(cut.map((c) => (c === SHARP ? SHARP : keywordOf(c.shape))));
  const k = agreed(cut.map((c) => (c === SHARP ? SHARP : clampK(cornerShapeK(c.shape)))));
  const radius = agreed(specs.map((c) => Math.round((c?.radius ?? 0) * 100) / 100));
  const mixed = new Set<string>();
  if (shape.mixed) mixed.add('shape');
  if (k.mixed) mixed.add('k');
  if (radius.mixed) mixed.add('radius');
  return {
    values: {
      count: specs.length,
      shape: shape.value ?? 'none',
      ...(k.value !== undefined ? { k: k.value } : {}),
      ...(radius.value !== undefined ? { radius: radius.value } : {}),
    },
    mixed,
  };
}

/** The keyword `shape` names or equals, or null for a parameter between them. */
function keywordOf(shape: CornerShape): CornerKeyword | null {
  return typeof shape === 'number' ? cornerKeywordOf(shape) : shape;
}

const clampK = (k: number): number => Math.max(-CORNER_K_SLIDER_RANGE, Math.min(CORNER_K_SLIDER_RANGE, k));

/** The `setCorners` params a change of `field` to `value` makes, or null for
 *  a field that sets nothing. */
export function cornerControlsParams(field: string, value: unknown): { shape: CornerShape } | { radius: number } | null {
  if (field === 'shape' && CORNER_KEYWORDS.includes(value as CornerKeyword)) return { shape: value as CornerKeyword };
  if (field === 'k' && typeof value === 'number' && Number.isFinite(value)) return { shape: value };
  if (field === 'radius' && typeof value === 'number' && Number.isFinite(value)) return { radius: value };
  return null;
}
