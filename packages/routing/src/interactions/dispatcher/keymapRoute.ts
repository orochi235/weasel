/**
 * How an input that starts no gesture of its own is routed while a keymap is
 * open: the innermost keymap's bindings alone first, then — depending on what
 * the input is and what the keymap's `unbound` rule says — nothing, or every
 * binding but the keymap's.
 */
import type { InputEvent } from './matcher';
import type { DispatcherContext } from './dispatcherApi';
import { capabilitiesAllowed, type CapabilityTag } from '@weasel-js/modes';
import { liveScope } from '../../contributions/eligibility';

type Outcome = 'handled' | 'unhandled';

/** What the router asks of the dispatcher. */
export interface KeymapPasses {
  /** Run `ctx` with `keymapPass` set to `pass`. */
  run(pass: 'only' | 'none', event: InputEvent): Outcome;
  /** Whether any binding of the innermost keymap matches `event`, without running one. */
  binds(event: InputEvent): boolean;
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/** Pointer input the recognizer has resolved a press into: the next stroke. */
const STROKES: ReadonlySet<InputEvent['kind']> = new Set([
  'click', 'doubleclick', 'longpress', 'contextmenu', 'multitouch', 'multitouchtap',
] as const);

const isPlainEscape = (e: InputEvent): boolean =>
  e.kind === 'key' && e.key === 'Escape' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

/** What a press may yet become, and a keymap may bind, once the recognizer settles it. */
const SETTLES_INTO: readonly InputEvent['kind'][] = ['click', 'doubleclick', 'longpress', 'contextmenu'];

/** Whether the keymap `id` names is still installed and allowed by the active mode. */
function stillLive(id: string, ctx: DispatcherContext): boolean {
  const entry = ctx.entriesById.get(id);
  if (!entry) return false;
  const allowed = ctx.getRuleCtx?.()?.allowedCapabilities;
  const allows = allowed ? (tags: readonly CapabilityTag[]) => capabilitiesAllowed(allowed, tags) : undefined;
  return liveScope(id, entry.eligibility, { focusedId: null, openKeymap: id, ...(allows ? { allows } : {}) }) !== null;
}

/** Route `event` through the open keymaps, or `undefined` when none is open. */
export function routeThroughKeymap(
  event: InputEvent,
  ctx: DispatcherContext,
  passes: KeymapPasses,
): Outcome | undefined {
  const stack = ctx.keymaps;
  const open = stack?.innermost();
  if (!stack || !open || event.kind === 'hover') return undefined;
  const isKey = event.kind === 'key' || event.kind === 'key-held';
  // A key this surface hears only because the pointer is over it belongs to whoever holds the keys.
  if (isKey && ctx.keyReach && !ctx.keyReach.held) return undefined;
  if (!stillLive(open.id, ctx)) {
    stack.closeAll();
    return undefined;
  }

  // The other half of a keystroke the keymap already ruled on.
  const verdict = stack.verdict();
  if (verdict === 'taken') return 'unhandled';
  if (verdict === 'cascaded') return passes.run('none', event);

  if (isPlainEscape(event)) {
    stack.closeInnermost();
    return 'handled';
  }

  if (passes.run('only', event) === 'handled') {
    stack.inputSeen();
    return 'handled';
  }

  if (isKey) {
    // A keymap that binds only the held form takes the keystroke on its twin.
    if (event.kind === 'key' && passes.binds({ ...event, kind: 'key-held', phase: 'down' })) return 'unhandled';
    // A bare modifier, a Ctrl or Cmd chord, and Tab go on as usual and close nothing:
    // a keymap is no reason to lose copy, paste or focus.
    if (MODIFIER_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.key === 'Tab') {
      return passes.run('none', event);
    }
    const entry = ctx.entriesById.get(open.id)?.eligibility.keymap;
    const own = typeof entry === 'object' ? entry.unbound : undefined;
    if ((own ?? ctx.leaderUnbound ?? 'modal') === 'modal') {
      stack.swallowed();
      return 'handled';
    }
    stack.cascaded();
    return passes.run('none', event);
  }

  // A press the keymap may yet take as a click is kept from the drag a tool would start on it.
  if (event.kind === 'pointerdown' && SETTLES_INTO.some((kind) => passes.binds({ ...event, kind } as InputEvent))) {
    return 'unhandled';
  }

  const outcome = passes.run('none', event);
  const stroke = STROKES.has(event.kind) || (event.kind === 'pointerdown' && outcome === 'handled');
  // A click the keymap passes on may be the first of a double click it binds.
  const firstOfDouble = event.kind === 'click' && passes.binds({ ...event, kind: 'doubleclick' } as InputEvent);
  if (stroke && !firstOfDouble) stack.inputSeen();
  return outcome;
}
