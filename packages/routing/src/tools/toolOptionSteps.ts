/**
 * The step actions of a tool's size and strength options: `[` `]` move the
 * size and `Shift+[` `Shift+]` the strength while the tool is active, and a
 * Shift+wheel moves the size.
 */
import type { PrefNumber } from '@weasel-js/prefs';
import type { KeySpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { ActionDeps, ImmediateInvoker } from '../interactions/actions/invoker';
import type { GestureBinding } from '../interactions/actions/binding';
import {
  setToolOption, steppedOption, toolOptionNumberLeaf, toolOptionParams,
  type ToolOptions, type ToolOptionStep, type ToolOptionValues,
} from './toolOptions';

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
  const held = toolOptionParams(toolId, options, values)[step.option];
  const current = typeof held === 'number' ? held : leaf.default ?? 0;
  setToolOption(toolId, options, values, step.option, steppedOption(leaf, current, step, dir));
}

const enabledFor = (toolId: string) => (deps?: ActionDeps) =>
  deps?.activeTool?.active === toolId && deps.toolOptionValues ? true : ActionDisabledReason.NotApplicable;

function stepAction(toolId: string, toolLabel: string, options: ToolOptions, spec: StepSpec): Action | null {
  const step = options[spec.which];
  const leaf = step ? toolOptionNumberLeaf(options, step.option) : undefined;
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
  const leaf = step ? toolOptionNumberLeaf(options, step.option) : undefined;
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
