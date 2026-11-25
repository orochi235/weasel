/**
 * The step actions of a tool's size and strength options: `[` `]` move the
 * size and `Shift+[` `Shift+]` the strength while the tool is live (held on its key, or active), and a
 * Shift+wheel moves the size.
 */
import type { PrefNumber } from '@weasel-js/prefs-schema';
import { getOwn, isFiniteNumber } from '@weasel-js/registry';
import type { KeySpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { ActionDeps, ImmediateInvoker } from '../interactions/actions/invoker';
import type { GestureBinding } from '../interactions/actions/binding';
import {
  liveTool, setToolOption, steppedOption, toolOptionNumberLeaf, toolOptionParams,
  type ToolOptionsSpec, type ToolOptionStep, type ToolOptionValues,
} from './toolOptions';

/** The `group` of the actions that step a tool's options, for an `<ActionBar group>` or a menu. */
export const TOOL_GROUP = 'tool';

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

/** Move `toolId`'s `step` option one step in `dir`, in `values`. A step its bounds stop writes nothing, so a shared
 *  value it reads clamped stays as another tool set it. */
function stepOption(
  toolId: string, options: ToolOptionsSpec, values: ToolOptionValues, step: ToolOptionStep, leaf: PrefNumber, dir: 1 | -1,
): void {
  const held = getOwn(toolOptionParams(toolId, options, values), step.option);
  const current = typeof held === 'number' ? held : leaf.default ?? 0;
  const next = steppedOption(leaf, current, step, dir);
  if (!Object.is(next, current)) setToolOption(toolId, options, values, step.option, next);
}

/** The param a canvas's option tuning gives each step action: the live tool among that canvas's own tools, which
 *  a hotkey stack shared with another canvas cannot say alone. */
export const LIVE_TOOL_PARAM = 'liveTool';

function liveFrom(deps: ActionDeps | undefined, params: Readonly<Record<string, unknown>> | undefined): string | null {
  const tuned = params && Object.hasOwn(params, LIVE_TOOL_PARAM) ? params[LIVE_TOOL_PARAM] : undefined;
  return typeof tuned === 'string' || tuned === null ? tuned : liveTool(deps?.activeTool);
}

const enabledFor = (toolId: string) => (
  deps?: ActionDeps, _at?: unknown, _carried?: unknown, params?: Readonly<Record<string, unknown>>,
) => liveFrom(deps, params) === toolId && deps?.toolOptionValues ? true : ActionDisabledReason.NotApplicable;

function stepAction(toolId: string, toolLabel: string, options: ToolOptionsSpec, spec: StepSpec): Action | null {
  const step = options[spec.which];
  const leaf = step ? toolOptionNumberLeaf(options, step.option) : undefined;
  if (!step || !leaf) return null;
  return {
    id: `${toolId}.${spec.name}`,
    label: spec.label(toolLabel, leaf.name.toLowerCase()),
    group: TOOL_GROUP,
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
/** The most steps one wheel event takes, however far it travels. */
export const WHEEL_SIZE_MAX_STEPS = 1_000;
/** How long the wheel rests, in ms, before its next event starts a new burst. */
export const WHEEL_SIZE_BURST_MS = 150;

const finite = (v: unknown): number => (isFiniteNumber(v) ? v : 0);

/**
 * The size, stepped by the wheel: up grows it, down shrinks it. The first event
 * of a burst steps at once, so one notch of a mouse wheel is one step, and a
 * trackpad's stream of small deltas steps once per {@link WHEEL_SIZE_STEP_PX}.
 * Reads `deltaX` when `deltaY` is 0, because macOS turns a Shift+wheel into a
 * horizontal one.
 */
function wheelSizeAction(toolId: string, toolLabel: string, options: ToolOptionsSpec): Action | null {
  const step = options.size;
  const leaf = step ? toolOptionNumberLeaf(options, step.option) : undefined;
  if (!step || !leaf) return null;
  // Keyed by the option values a canvas hands in, so two canvases sharing this tool keep separate bursts.
  const bursts = new WeakMap<ToolOptionValues, { travel: number; last: number }>();
  return {
    id: `${toolId}.wheelSize`,
    label: `Resize ${toolLabel} with the wheel`,
    group: TOOL_GROUP,
    requires: ['activeTool', 'toolOptionValues'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const values = deps.toolOptionValues;
        const dy = finite(params?.deltaY);
        const d = dy !== 0 ? dy : finite(params?.deltaX);
        if (!values || d === 0) return;
        let burst = bursts.get(values);
        if (!burst) bursts.set(values, burst = { travel: 0, last: -Infinity });
        const now = Date.now();
        // A clock set back since the last notch gives a negative gap: a new burst, not one going on.
        const gap = now - burst.last;
        const fresh = !(gap >= 0 && gap <= WHEEL_SIZE_BURST_MS) || (burst.travel !== 0 && Math.sign(burst.travel) !== Math.sign(d));
        burst.last = now;
        const dir: 1 | -1 = d < 0 ? 1 : -1;
        if (fresh) {
          burst.travel = 0;
          stepOption(toolId, options, values, step, leaf, dir);
          return;
        }
        burst.travel += d;
        const steps = Math.floor(Math.abs(burst.travel) / WHEEL_SIZE_STEP_PX);
        burst.travel -= Math.sign(burst.travel) * steps * WHEEL_SIZE_STEP_PX;
        for (let i = Math.min(steps, WHEEL_SIZE_MAX_STEPS); i > 0; i--) stepOption(toolId, options, values, step, leaf, dir);
      },
    } satisfies ImmediateInvoker,
    enabled: enabledFor(toolId),
  };
}

/** The ids of the actions {@link toolOptionSteps} makes for `toolId`. */
export function toolOptionStepIds(toolId: string, options: ToolOptionsSpec): string[] {
  const has = (which: 'size' | 'strength') => {
    const step = options[which];
    return !!step && !!toolOptionNumberLeaf(options, step.option);
  };
  const ids = STEPS.filter((s) => has(s.which)).map((s) => `${toolId}.${s.name}`);
  return has('size') ? [...ids, `${toolId}.wheelSize`] : ids;
}

/** The step actions for `toolId`'s size and strength options, and the key and
 *  wheel bindings that reach them. Each binding yields, as its action declines unless its tool is live. */
export function toolOptionSteps(
  toolId: string, toolLabel: string, options: ToolOptionsSpec,
): { actions: Action[]; bindings: GestureBinding[] } {
  const actions: Action[] = [];
  const bindings: GestureBinding[] = [];
  for (const spec of STEPS) {
    const action = stepAction(toolId, toolLabel, options, spec);
    if (!action) continue;
    actions.push(action);
    bindings.push({ spec: STEP_KEYS[spec.name], actionId: action.id, opts: { id: `${action.id}.key`, yields: true } });
  }
  const wheel = wheelSizeAction(toolId, toolLabel, options);
  if (wheel) {
    actions.push(wheel);
    bindings.push({ spec: { kind: 'wheel', mods: { shift: true } }, actionId: wheel.id, opts: { id: `${wheel.id}.shiftWheel`, yields: true } });
  }
  return { actions, bindings };
}
