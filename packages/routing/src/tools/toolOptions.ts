/**
 * Tool options: the settings a tool's user adjusts while it is active, such as
 * a brush's size and strength. A tool declares them as a prefs group whose
 * number leaves are params of the action it binds; the host holds their values
 * (`toolOptionValues` dep) and `<SceneCanvas>` tunes the action from them. A tool
 * whose options name a size or a strength also gets step actions for them,
 * bound to `[` `]` and `Shift+[` `Shift+]` while it is the active tool, and a
 * size also steps with Shift+wheel.
 */
import type { PrefGroup, PrefNumber } from '@weasel-js/prefs';
import type { KeySpec } from '@weasel-js/gestures';
import { createEmitter } from '@weasel-js/registry';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { ActionDeps, ImmediateInvoker } from '../interactions/actions/invoker';
import type { GestureBinding } from '../interactions/actions/binding';

/** How a step action moves one option: by a factor, or by an amount. */
export interface ToolOptionStep {
  /** The option's key in `prefs`. */
  option: string;
  /** Each step multiplies (or divides) the value by this. */
  times?: number;
  /** Each step adds (or takes away) this. Used when `times` is absent. */
  plus?: number;
}

/** What a tool declares about its options. See {@link ToolDef.options}. */
export interface ToolOptions {
  /** The action the options are params of: each leaf of `prefs` is the param
   *  of the same key. */
  actionId: string;
  /** The options, as number leaves keyed by param, with their bounds and
   *  defaults. A host draws them from this (a group drawn `as: 'bar'` makes an
   *  options row) and keeps their values in its prefs. */
  prefs: PrefGroup;
  /** The option `[` and `]` step: how large the tool acts. */
  size?: ToolOptionStep;
  /** The option `Shift+[` and `Shift+]` step: how hard it acts. */
  strength?: ToolOptionStep;
}

/** Where a host keeps tool options' values: the `toolOptionValues` dep. */
export interface ToolOptionValues {
  /** `toolId`'s values, sparse: an option missing from it reads its default.
   *  The same object until one of them changes. */
  get(toolId: string): Readonly<Record<string, number>>;
  set(toolId: string, option: string, value: number): void;
  subscribe(listener: () => void): () => void;
}

const NONE: Readonly<Record<string, number>> = Object.freeze({});

/** A {@link ToolOptionValues} held in memory, for a host that keeps no prefs. */
export function createToolOptionValues(): ToolOptionValues {
  const values = new Map<string, Record<string, number>>();
  const changed = createEmitter();
  return {
    get: (toolId) => values.get(toolId) ?? NONE,
    set(toolId, option, value) {
      values.set(toolId, { ...values.get(toolId), [option]: value });
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}

function leafOf(options: ToolOptions, option: string): PrefNumber | undefined {
  const children = options.prefs.children;
  const leaf = (Object.hasOwn(children, option) ? children[option] : undefined) as { kind?: string } | undefined;
  return leaf?.kind === 'number' ? (leaf as PrefNumber) : undefined;
}

/** Every option's value for `toolId`: what `values` holds when it is a finite number, else its default. */
export function toolOptionParams(
  toolId: string, options: ToolOptions, values: ToolOptionValues | undefined,
): Record<string, number> {
  const held = values?.get(toolId) ?? {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(options.prefs.children)) {
    const leaf = leafOf(options, key);
    const own = Object.hasOwn(held, key) ? held[key] : undefined;
    const v = typeof own === 'number' && Number.isFinite(own) ? own : leaf?.default;
    if (typeof v === 'number') out[key] = v;
  }
  return out;
}

/** `value` moved one step up (`dir` 1) or down (-1), within the leaf's bounds
 *  and rounded to its `step`. */
export function steppedOption(leaf: PrefNumber, value: number, step: ToolOptionStep, dir: 1 | -1): number {
  const moved = step.times !== undefined ? value * step.times ** dir : value + dir * (step.plus ?? leaf.step ?? 1);
  const snapped = leaf.step ? Math.round(moved / leaf.step) * leaf.step : moved;
  // A step that rounds back to where it began still moves one `step`.
  const next = snapped === value && leaf.step ? value + dir * leaf.step : snapped;
  const clamped = Math.min(leaf.max ?? Infinity, Math.max(leaf.min ?? -Infinity, next));
  return Number(clamped.toFixed(6));
}

/** The keys each step action is bound to while its tool is active. */
type StepName = 'grow' | 'shrink' | 'raise' | 'lower';
const STEP_KEYS: Record<StepName, KeySpec> = {
  grow: { kind: 'key', key: ']', code: 'BracketRight' },
  shrink: { kind: 'key', key: '[', code: 'BracketLeft' },
  raise: { kind: 'key', key: [']', '}'], code: 'BracketRight', mods: { shift: true } },
  lower: { kind: 'key', key: ['[', '{'], code: 'BracketLeft', mods: { shift: true } },
};

interface StepSpec { name: StepName; which: 'size' | 'strength'; dir: 1 | -1; label: (tool: string, option: string) => string }

const STEPS: readonly StepSpec[] = [
  { name: 'grow', which: 'size', dir: 1, label: (t) => `Grow ${t}` },
  { name: 'shrink', which: 'size', dir: -1, label: (t) => `Shrink ${t}` },
  { name: 'raise', which: 'strength', dir: 1, label: (t, o) => `Raise ${t} ${o}` },
  { name: 'lower', which: 'strength', dir: -1, label: (t, o) => `Lower ${t} ${o}` },
];

/** Move `toolId`'s `step` option one step in `dir`, in `values`. */
function stepOption(
  toolId: string, options: ToolOptions, values: ToolOptionValues, step: ToolOptionStep, leaf: PrefNumber, dir: 1 | -1,
): void {
  const current = toolOptionParams(toolId, options, values)[step.option] ?? leaf.default ?? 0;
  values.set(toolId, step.option, steppedOption(leaf, current, step, dir));
}

const enabledFor = (toolId: string) => (deps?: ActionDeps) =>
  deps?.activeTool?.active === toolId && deps.toolOptionValues ? true : ActionDisabledReason.NotApplicable;

function stepAction(toolId: string, toolLabel: string, options: ToolOptions, spec: StepSpec): Action | null {
  const step = options[spec.which];
  const leaf = step ? leafOf(options, step.option) : undefined;
  if (!step || !leaf) return null;
  return {
    id: `${toolId}.${spec.name}`,
    label: spec.label(toolLabel, leaf.name.toLowerCase()),
    group: 'tool',
    requires: ['activeTool', 'toolOptionValues'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        if (deps.toolOptionValues) stepOption(toolId, options, deps.toolOptionValues, step, leaf, spec.dir);
      },
    } satisfies ImmediateInvoker,
    enabled: enabledFor(toolId),
  };
}

/** Wheel travel, in px of delta, that moves the size one more step within a burst. */
export const WHEEL_SIZE_STEP_PX = 60;
/** How long the wheel rests, in ms, before its next event starts a new burst. */
export const WHEEL_SIZE_BURST_MS = 150;

const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The size, stepped by the wheel: up grows it, down shrinks it. The first event
 * of a burst steps at once, so one notch of a mouse wheel is one step, and a
 * trackpad's stream of small deltas steps once per {@link WHEEL_SIZE_STEP_PX}.
 * Reads `deltaX` when `deltaY` is 0, because macOS turns a Shift+wheel into a
 * horizontal one.
 */
function wheelSizeAction(toolId: string, toolLabel: string, options: ToolOptions): Action | null {
  const step = options.size;
  const leaf = step ? leafOf(options, step.option) : undefined;
  if (!step || !leaf) return null;
  let travel = 0;
  let last = -Infinity;
  return {
    id: `${toolId}.wheelSize`,
    label: `Resize ${toolLabel} with the wheel`,
    group: 'tool',
    requires: ['activeTool', 'toolOptionValues'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const values = deps.toolOptionValues;
        const dy = finite(params?.deltaY);
        const d = dy !== 0 ? dy : finite(params?.deltaX);
        if (!values || d === 0) return;
        const now = Date.now();
        const fresh = now - last > WHEEL_SIZE_BURST_MS || (travel !== 0 && Math.sign(travel) !== Math.sign(d));
        last = now;
        const dir: 1 | -1 = d < 0 ? 1 : -1;
        if (fresh) {
          travel = 0;
          stepOption(toolId, options, values, step, leaf, dir);
          return;
        }
        travel += d;
        while (Math.abs(travel) >= WHEEL_SIZE_STEP_PX) {
          travel -= Math.sign(travel) * WHEEL_SIZE_STEP_PX;
          stepOption(toolId, options, values, step, leaf, dir);
        }
      },
    } satisfies ImmediateInvoker,
    enabled: enabledFor(toolId),
  };
}

/** The step actions for `toolId`'s size and strength options, and the key and
 *  wheel bindings that reach them. */
export function toolOptionSteps(
  toolId: string, toolLabel: string, options: ToolOptions,
): { actions: Action[]; bindings: GestureBinding[] } {
  const actions: Action[] = [];
  const bindings: GestureBinding[] = [];
  for (const spec of STEPS) {
    const action = stepAction(toolId, toolLabel, options, spec);
    if (!action) continue;
    actions.push(action);
    bindings.push({ spec: STEP_KEYS[spec.name], actionId: action.id, opts: { id: `${action.id}.key` } });
  }
  const wheel = wheelSizeAction(toolId, toolLabel, options);
  if (wheel) {
    actions.push(wheel);
    bindings.push({ spec: { kind: 'wheel', mods: { shift: true } }, actionId: wheel.id, opts: { id: `${wheel.id}.shiftWheel` } });
  }
  return { actions, bindings };
}
