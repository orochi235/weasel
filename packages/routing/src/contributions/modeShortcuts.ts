import { modeLabel, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { key, type KeySpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { ActionDeps } from '../interactions/actions/invoker';
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

/**
 * A `ModeDefinition` shortcut chord — `'Escape'`, `'Meta+T'` — as a key spec.
 * Modifier names are case-insensitive; the last segment is the key.
 */
export function modeShortcutSpec(shortcut: string): KeySpec {
  return key(shortcut);
}

/**
 * The registry's declared mode shortcuts as an always-on contribution: one
 * action per shortcut, bound to its chord and gated on the mode it acts on —
 * `exit` / `discard` / `commit` / `cancel` while that mode is active, `entry`
 * while it is not. Install it with `<SceneCanvas ambient>`.
 *
 * An entry key one mode shares with another mode's leaving key is reported as
 * a route conflict unless `canEnter` is given: that is what keeps the entry
 * key from firing inside the other mode.
 *
 * The bindings ride the hotkey tier, so leaving a mode outranks what the same
 * key does otherwise (Escape clearing the selection), and they yield while a
 * gesture is in flight, so Escape mid-drag still cancels the drag first. Keys
 * typed into an editable element never reach them. A mode's `exit` also
 * yields while a tool other than its `defaultTool` is active, so that key
 * first returns to the default tool (core's `tool.modeDefault`).
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
      // Without `canEnter` an entry key is live in every other mode, so it does not yield there.
      actions.push(shortcutAction(mode, 'entry', entry, { mode: { not: mode.id } },
        () => registry.current().id !== mode.id && (handlers.canEnter?.(mode.id) ?? true),
        () => enter(mode.id), handlers.canEnter !== undefined));
    }
    for (const role of LEAVING) {
      const shortcut = mode[role]?.shortcut;
      const run = handlers[role];
      if (!shortcut || !run) continue;
      actions.push(shortcutAction(mode, role, shortcut, { mode: mode.id },
        (deps) => registry.current().id === mode.id && (role !== 'exit' || onDefaultTool(mode, deps)),
        run, true));
    }
  }
  return { id: 'modes.shortcuts', eligibility: { always: true }, actions };
}

/** Whether `mode` names no default tool, or it (or no tool) is the active one. */
function onDefaultTool(mode: ModeDefinition, deps: ActionDeps | undefined): boolean {
  const active = deps?.activeTool?.active ?? null;
  return mode.defaultTool === undefined || active === null || active === mode.defaultTool;
}

function shortcutAction(
  mode: ModeDefinition,
  role: Role | 'entry',
  shortcut: string,
  eligible: Rule,
  live: (deps: ActionDeps | undefined) => boolean,
  run: () => void,
  yields: boolean,
): Action {
  return {
    id: `mode.${mode.id}.${role}`,
    label: `${VERB[role]} ${modeLabel(mode)}`,
    scope: 'hotkey',
    defaultBinding: [{
      spec: { ...modeShortcutSpec(shortcut), phase: [{ channel: '*', phase: 'initial' }] },
      opts: { id: `mode.${mode.id}.${role}.key`, yields },
    }],
    eligible,
    requires: ['activeTool'],
    // `eligible` is the gate the dispatcher and palettes read, but a canvas
    // with no `modes` evaluates none; without this the key is
    // swallowed in every mode.
    enabled: (deps) => (live(deps) ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run: () => run() },
  };
}
