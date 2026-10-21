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
 *  `opts.params.toolId`, so the invoker's `start` can pick out which tool
 *  to engage, and is overridden as `tool.offhand.<toolId>`.
 *
 *  An offhand tool engages only between gestures. Swapping the tool out
 *  mid-drag would cancel the drag, and the key is free for the gesture's own
 *  tool to use — Space repositions a shape being drawn. */
export function buildToolOffhandBindings(
  specs: readonly ToolOffhandBindingSpec[],
): BoundGesture[] {
  return specs.map(({ toolId, key }) => ({
    spec: { ...heldKeySpec(key), phase: BETWEEN_GESTURES },
    opts: { id: `${TOOL_OFFHAND_ID}.${toolId}`, params: { toolId } },
  }));
}

const BETWEEN_GESTURES = [{ channel: '*', phase: 'initial' }] as const;

/** The `key-held` spec for holding `key` (a `KeyboardEvent.key`, or several).
 *  A modifier key gets every modifier optional, since its own keydown reports
 *  its flag set. Any other key engages with Shift or Alt already down and not
 *  with Cmd or Ctrl, so a letter trigger leaves its browser chord alone.
 *  Every hold-a-key binding builds its spec here, so that rule has one home. */
export function heldKeySpec(key: string | string[]): KeyHeldSpec {
  const isModifier = [key].flat().some((k) => MODIFIER_KEYS.has(k));
  return { kind: 'key-held', key, mods: { ...(isModifier ? ANY_MODS : SHIFT_OR_ALT) } };
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Alt', 'Control', 'Meta', 'Shift']);

// A modifier's own keydown reports its flag set, and which other modifiers are
// already down when it lands is an accident of the order they were pressed in.
const ANY_MODS: ModSpec = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' };

const SHIFT_OR_ALT: ModSpec = { alt: 'optional', shift: 'optional' };

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
