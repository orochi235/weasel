/**
 * Tool options: the settings a tool's user adjusts while it is active, such as
 * a brush's size or a shape's fill. A tool declares them as a prefs group whose
 * leaves are params of the actions it binds; the host holds their values
 * (`toolOptionValues` dep) and `<SceneCanvas>` tunes those actions from them
 * while the tool is active. An option may name a shared key, and every tool
 * naming that key reads and writes one value. A tool whose options name a size
 * or a strength also gets step actions for them (`toolOptionSteps`).
 */
import type { PrefGroup, PrefLeaf, PrefNumber } from '@weasel-js/prefs';
import { prefValueAbsent, repairPrefValue } from '@weasel-js/prefs';
import { endlessAllows } from '@weasel-js/quantity';
import { createEmitter, deepEqual } from '@weasel-js/registry';

/** How a step action moves one option: by a factor, or by an amount. */
export interface ToolOptionStep {
  /** The option's key in `prefs`. */
  option: string;
  /** Each step multiplies (or divides) the value by this. */
  times?: number;
  /** Each step adds (or takes away) this. Used when `times` is absent. */
  plus?: number;
}

/** For some of a tool's options, the shared key each reads and writes, or
 *  `null` for one kept per tool, overriding a share the tool's def names. */
export type ToolOptionShare = Readonly<Record<string, string | null>>;

/** What a tool declares about its options. See {@link ToolDef.options}. */
export interface ToolOptions {
  /** The action, or actions, the options are params of: each leaf of `prefs`
   *  is the param of the same key. */
  actionId: string | readonly string[];
  /** The options, keyed by param, with their bounds and defaults. A host draws
   *  them from this (a group drawn `as: 'bar'` makes an options row) and keeps
   *  their values in its prefs. */
  prefs: PrefGroup;
  /** Options whose value is shared with every tool naming the same key: a
   *  shape tool's `fill`, which every shape tool reads. An option left out is
   *  the tool's own. A tool's user lays a share over this with
   *  {@link shareToolOptions}. */
  share?: ToolOptionShare;
  /** The option `[` and `]` step: how large the tool acts. */
  size?: ToolOptionStep;
  /** The option `Shift+[` and `Shift+]` step: how hard it acts. */
  strength?: ToolOptionStep;
}

/** The owner shared options are kept under in a {@link ToolOptionValues}, beside each tool's own. */
export const SHARED_TOOL_OPTIONS = 'shared';

/** Where a host keeps tool options' values: the `toolOptionValues` dep. Values
 *  are kept by owner, a tool's id or {@link SHARED_TOOL_OPTIONS}. */
export interface ToolOptionValues {
  /** `owner`'s values, sparse: an option missing from it reads its default.
   *  The same object until one of them changes. */
  get(owner: string): Readonly<Record<string, unknown>>;
  set(owner: string, key: string, value: unknown): void;
  subscribe(listener: () => void): () => void;
}

const NONE: Readonly<Record<string, unknown>> = Object.freeze({});

/** A {@link ToolOptionValues} held in memory, for a host that keeps no prefs. */
export function createToolOptionValues(): ToolOptionValues {
  const values = new Map<string, Record<string, unknown>>();
  const changed = createEmitter();
  return {
    get: (owner) => values.get(owner) ?? NONE,
    set(owner, key, value) {
      values.set(owner, { ...values.get(owner), [key]: value });
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}

/** `options` with `share` laid over its own: what a tool hook's `share` option does. */
export function shareToolOptions(options: ToolOptions, share: ToolOptionShare | undefined): ToolOptions {
  if (!share || Object.keys(share).length === 0) return options;
  return { ...options, share: { ...options.share, ...share } };
}

/** `options` with `option`'s default made `value`: a tool hook's way to take a starting value from its caller.
 *  `undefined`, or an option it does not declare, leaves `options` as they are. */
export function withToolOptionDefault(options: ToolOptions, option: string, value: unknown): ToolOptions {
  const leaf = value === undefined ? undefined : toolOptionLeaf(options, option);
  if (!leaf) return options;
  return { ...options, prefs: { ...options.prefs, children: { ...options.prefs.children, [option]: { ...leaf, default: value } as PrefLeaf } } };
}

/** The actions `options` are params of. */
export function toolOptionActionIds(options: ToolOptions): readonly string[] {
  return typeof options.actionId === 'string' ? [options.actionId] : options.actionId;
}

/** Where `toolId`'s option `option` is kept: under the tool, or under its shared key. */
export function toolOptionSlot(toolId: string, options: ToolOptions, option: string): { owner: string; key: string } {
  const shared = options.share && Object.hasOwn(options.share, option) ? options.share[option] : null;
  return shared ? { owner: SHARED_TOOL_OPTIONS, key: shared } : { owner: toolId, key: option };
}

/** `option`'s leaf in `options`, if it has one. */
export function toolOptionLeaf(options: ToolOptions, option: string): PrefLeaf | undefined {
  const children = options.prefs.children;
  const leaf = (Object.hasOwn(children, option) ? children[option] : undefined) as { kind?: string } | undefined;
  return leaf && typeof leaf.kind === 'string' ? (leaf as PrefLeaf) : undefined;
}

/** `option`'s leaf when it is a number. */
export function toolOptionNumberLeaf(options: ToolOptions, option: string): PrefNumber | undefined {
  const leaf = toolOptionLeaf(options, option);
  return leaf?.kind === 'number' ? (leaf as PrefNumber) : undefined;
}

/** What `held` reads as for `leaf`, or `undefined` for nothing it can read. */
function readHeld(leaf: PrefLeaf, held: unknown): unknown {
  if (prefValueAbsent(leaf, held)) return undefined;
  if (leaf.kind === 'number' && !(typeof held === 'number' && (Number.isFinite(held) || endlessAllows((leaf as PrefNumber).endless, held)))) {
    return undefined;
  }
  const repaired = repairPrefValue(leaf, held);
  return repaired === (leaf as { default?: unknown }).default && !deepEqual(repaired, held) ? undefined : repaired;
}

function* optionKeys(options: ToolOptions): Iterable<[string, PrefLeaf]> {
  for (const key of Object.keys(options.prefs.children)) {
    const leaf = toolOptionLeaf(options, key);
    if (leaf && 'default' in leaf) yield [key, leaf];
  }
}

/** The options `values` holds for `toolId`, each read from its slot: only those held, so an option it does not
 *  hold leaves whatever else sets it in place. */
export function heldToolOptions(
  toolId: string, options: ToolOptions, values: ToolOptionValues | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!values) return out;
  for (const [key, leaf] of optionKeys(options)) {
    const slot = toolOptionSlot(toolId, options, key);
    const own = values.get(slot.owner);
    const v = Object.hasOwn(own, slot.key) ? readHeld(leaf, own[slot.key]) : undefined;
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** Every option's value for `toolId`: what its slot in `values` holds, else its default. */
export function toolOptionParams(
  toolId: string, options: ToolOptions, values: ToolOptionValues | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, leaf] of optionKeys(options)) out[key] = (leaf as { default?: unknown }).default;
  return { ...out, ...heldToolOptions(toolId, options, values) };
}

/** Write `value` as `toolId`'s option `option`, into its slot. */
export function setToolOption(
  toolId: string, options: ToolOptions, values: ToolOptionValues, option: string, value: unknown,
): void {
  const slot = toolOptionSlot(toolId, options, option);
  values.set(slot.owner, slot.key, value);
}

/** Write each of `toolId`'s options that `params` sets to a new value into its slot. */
export function keepToolOptions(
  toolId: string, options: ToolOptions, values: ToolOptionValues, params: Readonly<Record<string, unknown>>,
): void {
  const now = toolOptionParams(toolId, options, values);
  for (const [key, leaf] of optionKeys(options)) {
    if (!Object.hasOwn(params, key)) continue;
    const v = readHeld(leaf, params[key]);
    if (v !== undefined && !deepEqual(v, now[key])) setToolOption(toolId, options, values, key, v);
  }
}

/** `value` moved one step up (`dir` 1) or down (-1), within the leaf's bounds
 *  and rounded to its `step`. */
export function steppedOption(leaf: PrefNumber, value: number, step: ToolOptionStep, dir: 1 | -1): number {
  const moved = step.times !== undefined ? value * step.times ** dir : value + dir * (step.plus ?? leaf.step ?? 1);
  const snapped = leaf.step ? Math.round(moved / leaf.step) * leaf.step : moved;
  // A step that rounds back to where it began still moves one `step`.
  const next = leaf.step && Math.abs(snapped - value) < leaf.step * 1e-6 ? value + dir * leaf.step : snapped;
  const clamped = Math.min(leaf.max ?? Infinity, Math.max(leaf.min ?? -Infinity, next));
  return Number(clamped.toFixed(6));
}
