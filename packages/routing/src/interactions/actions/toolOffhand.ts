import type { Action } from './action';
import type { BoundGesture } from './binding';
import { resolveParams, type InvocationCtx, type BindingOpts } from './invoker';
import type { HotkeyTrigger } from '../../contributions/types';
import type { KeyHeldSpec, ModSpec } from '@weasel-js/gestures';

/** Canonical id of the consolidated tool-offhand action. One descriptor
 *  serves every tool; the matched binding supplies `params.toolId` to select
 *  which tool to engage while the key is held. */
export const TOOL_OFFHAND_ID = 'tool.offhand';

/** Per-tool spec consumed by `buildToolOffhandBindings`. The key is the
 *  held-key trigger (e.g. ' ' for Space-for-hand). */
export interface ToolOffhandBindingSpec {
  toolId: string;
  key: string | string[];
}

/** `KeyboardEvent.key` for a declared `Eligibility.offhand` trigger. The
 *  named keys become their DOM names; any other trigger already is one. */
export function offhandKeyFor(trigger: HotkeyTrigger): string {
  switch (trigger) {
    case 'space': return ' ';
    case 'alt': return 'Alt';
    case 'ctrl': return 'Control';
    case 'meta': return 'Meta';
    case 'shift': return 'Shift';
    default: return trigger;
  }
}

/** Build the per-tool `BoundGesture` list for the consolidated action's
 *  `defaultBinding`. Each entry pairs a `key-held` spec with
 *  `opts.params.toolId` so the invoker's `start` can pick out which tool
 *  to engage. */
export function buildToolOffhandBindings(
  specs: readonly ToolOffhandBindingSpec[],
): BoundGesture[] {
  return specs.map(({ toolId, key }) => {
    const spec: KeyHeldSpec = { kind: 'key-held', key };
    if ([key].flat().some((k) => MODIFIER_KEYS.has(k))) spec.mods = ANY_MODS;
    return { spec, opts: { params: { toolId } } };
  });
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Alt', 'Control', 'Meta', 'Shift']);

// A modifier's own keydown reports its flag set, and which other modifiers are
// already down when it lands is an accident of the order they were pressed in.
const ANY_MODS: ModSpec = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' };

/** Build the consolidated `tool.offhand` action — "hold a key to engage a
 *  secondary tool" (e.g. Space-for-hand). `bindings` enumerates one
 *  `{ spec: keyHeld, opts: { params: { toolId } } }` per tool; the invoker
 *  reads `params.toolId` from the matched binding, pushes the tool id onto
 *  the active-tool context's hotkey stack on `start`, and pops it on `onEnd`.
 *  Mirrors the parametric shape of `tool.activate`. */
export function makeToolOffhandAction(bindings: BoundGesture[]): Action {
  return {
    id: TOOL_OFFHAND_ID,
    label: 'Engage tool (offhand)',
    defaultBinding: bindings,
    scope: 'hotkey',
    invoker: {
      timing: 'ongoing',
      start: (ctx: InvocationCtx, opts?: BindingOpts) => {
        const activeTool = ctx.deps.activeTool;
        const toolId = resolveParams(opts?.params)?.toolId as string | undefined;
        if (!activeTool || !toolId) return {};
        activeTool.pushHotkey(toolId);
        return {
          onEnd: () => { activeTool.popHotkey(toolId); },
        };
      },
    },
    requires: ['activeTool'],
  };
}
