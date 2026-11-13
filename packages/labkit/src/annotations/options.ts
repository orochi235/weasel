import type { PrefLeaf } from '@weasel-js/prefs';
import { createEmitter } from '@weasel-js/registry';
import { type ToolOptions, type ToolOptionValues, toolOptionParams } from '@weasel-js/routing';
import type { RecordCache } from '@weasel-js/storage';
import { valueRecord } from '../state/labRecords';
import { MARK_COLOR, MARK_TEXT_SIZE, MARK_WIDTH } from './paint';
import type { AnnotationData } from './types';

/** The keys the annotation tools share their style under: one width and one color for every tool that draws. */
export const MARK_WIDTH_KEY = 'markWidth';
export const MARK_COLOR_KEY = 'markColor';

const colorLeaf: PrefLeaf = {
  kind: 'color',
  name: 'Color',
  description: 'What a new mark is drawn in.',
  default: MARK_COLOR,
};

const widthLeaf: PrefLeaf = {
  kind: 'number',
  name: 'Width',
  description: 'How thick a new mark’s line is, in the picture’s units.',
  default: MARK_WIDTH,
  min: 0.5,
  max: 40,
  step: 0.5,
};

const sizeLeaf: PrefLeaf = {
  kind: 'number',
  name: 'Size',
  description: 'How large a new text mark is set, in the picture’s units.',
  default: MARK_TEXT_SIZE,
  min: 4,
  max: 200,
  step: 1,
};

/** The options of a tool that draws a line: its width and color. Labkit binds no actions to them; the overlay reads
 *  them when it makes a mark. */
export const MARK_LINE_OPTIONS: ToolOptions = {
  actionId: [],
  prefs: { name: 'Mark', as: 'bar', children: { width: widthLeaf, color: colorLeaf } },
  share: { width: MARK_WIDTH_KEY, color: MARK_COLOR_KEY },
};

/** The text tool's options: its size, and the color every mark shares. */
export const MARK_TEXT_OPTIONS: ToolOptions = {
  actionId: [],
  prefs: { name: 'Text', as: 'bar', children: { fontSize: sizeLeaf, color: colorLeaf } },
  share: { color: MARK_COLOR_KEY },
};

/** The style fields a mark of `kind` carries, read from `options` in `values`. */
export function markStyleFrom(
  toolId: string,
  options: ToolOptions | undefined,
  values: ToolOptionValues,
): Pick<AnnotationData, 'width' | 'color' | 'fontSize'> {
  if (!options) return {};
  const p = toolOptionParams(toolId, options, values);
  return {
    ...(typeof p.width === 'number' ? { width: p.width } : {}),
    ...(typeof p.color === 'string' ? { color: p.color } : {}),
    ...(typeof p.fontSize === 'number' ? { fontSize: p.fontSize } : {}),
  };
}

const TOOL_OPTIONS_RECORD = 'toolOptions';
type Held = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
const NONE: Readonly<Record<string, unknown>> = Object.freeze({});
const byRecords = new WeakMap<RecordCache, ToolOptionValues>();

/** The lab's tool option values, kept in its records so they survive a reload and every trial reads the same ones.
 *  One per record cache. */
export function labToolOptionValues(records: RecordCache): ToolOptionValues {
  const known = byRecords.get(records);
  if (known) return known;
  const name = valueRecord(null, TOOL_OPTIONS_RECORD);
  const held = (): Held => (records.has(name) ? (records.get(name) as Held) : {});
  const changed = createEmitter();
  records.subscribe((changes) => {
    if (changes.some((c) => c.name === name)) changed.emit();
  });
  const values: ToolOptionValues = {
    get: (owner) => held()[owner] ?? NONE,
    set(owner, key, value) {
      const all = held();
      records.set(name, { ...all, [owner]: { ...all[owner], [key]: value } });
    },
    subscribe: changed.subscribe,
  };
  byRecords.set(records, values);
  return values;
}
