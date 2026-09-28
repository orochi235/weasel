import { modeLabel, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import type { KeySpec, ModSpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { Rule } from '../eligibility';
import type { Contribution } from './types';

/**
 * What each mode shortcut does. A role left out binds nothing, so its key
 * falls through to whatever else the dispatcher has on it.
 */
export interface ModeShortcutHandlers {
  /** Enter mode `id` — the `entry` shortcut. */
  enter?: (id: string) => void;
  /** Whether mode `id` can be entered now. A mode that needs a target it
   *  doesn't have answers no, and its entry key falls through. Default yes. */
  canEnter?: (id: string) => boolean;
  /** Leave the active soft mode, keeping its session to resume. */
  exit?: () => void;
  /** Leave the active soft mode and throw its session away. */
  discard?: () => void;
  /** Commit the active strict mode's transaction. */
  commit?: () => void;
  /** Abandon the active strict mode's transaction. */
  cancel?: () => void;
}

type Role = 'exit' | 'discard' | 'commit' | 'cancel';
const LEAVING: readonly Role[] = ['exit', 'discard', 'commit', 'cancel'];
const VERB: Record<Role | 'entry', string> = {
  entry: 'Enter', exit: 'Exit', discard: 'Discard', commit: 'Commit', cancel: 'Cancel',
};

const MODIFIERS: Record<string, keyof ModSpec> = {
  meta: 'meta', cmd: 'meta', command: 'meta',
  ctrl: 'ctrl', control: 'ctrl',
  alt: 'alt', option: 'alt',
  shift: 'shift',
  mod: 'mod',
};

/**
 * A `ModeDefinition` shortcut chord — `'Escape'`, `'Meta+T'` — as a key spec.
 * Modifier names are case-insensitive; the last segment is the key.
 */
export function modeShortcutSpec(shortcut: string): KeySpec {
  const parts = shortcut.split('+');
  const key = parts.pop();
  if (!key) throw new Error(`mode shortcut "${shortcut}" names no key`);
  const mods: ModSpec = {};
  for (const part of parts) {
    const mod = MODIFIERS[part.toLowerCase()];
    if (!mod) throw new Error(`mode shortcut "${shortcut}": unknown modifier "${part}"`);
    mods[mod] = true;
  }
  return Object.keys(mods).length > 0 ? { kind: 'key', key, mods } : { kind: 'key', key };
}

/**
 * The registry's declared mode shortcuts as an always-on contribution: one
 * action per shortcut, bound to its chord and gated on the mode it acts on —
 * `exit` / `discard` / `commit` / `cancel` while that mode is active, `entry`
 * while it is not. Install it with `<SceneCanvas ambient>`.
 *
 * The bindings ride the hotkey tier, so leaving a mode outranks what the same
 * key does otherwise (Escape clearing the selection), and they yield while a
 * gesture is in flight, so Escape mid-drag still cancels the drag first. Keys
 * typed into an editable element never reach them.
 */
export function modeShortcuts(
  registry: ModeRegistry,
  handlers: ModeShortcutHandlers,
): Contribution<never> {
  const actions: Action[] = [];
  for (const mode of registry.list()) {
    const entry = mode.entry?.shortcut;
    const enter = handlers.enter;
    if (entry && enter) {
      actions.push(shortcutAction(mode, 'entry', entry, { mode: { not: mode.id } },
        () => registry.current().id !== mode.id && (handlers.canEnter?.(mode.id) ?? true),
        () => enter(mode.id)));
    }
    for (const role of LEAVING) {
      const shortcut = mode[role]?.shortcut;
      const run = handlers[role];
      if (!shortcut || !run) continue;
      actions.push(shortcutAction(mode, role, shortcut, { mode: mode.id },
        () => registry.current().id === mode.id,
        run));
    }
  }
  return { id: 'modes.shortcuts', eligibility: { always: true }, actions };
}

function shortcutAction(
  mode: ModeDefinition,
  role: Role | 'entry',
  shortcut: string,
  eligible: Rule,
  live: () => boolean,
  run: () => void,
): Action {
  return {
    id: `mode.${mode.id}.${role}`,
    label: `${VERB[role]} ${modeLabel(mode)}`,
    scope: 'hotkey',
    defaultBinding: {
      ...modeShortcutSpec(shortcut),
      phase: [{ channel: '*', phase: 'initial' }],
    },
    eligible,
    // `eligible` is the gate the dispatcher and palettes read, but a canvas
    // with no `modes` evaluates none; without this the key is
    // swallowed in every mode.
    enabled: () => (live() ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run: () => run() },
  };
}
