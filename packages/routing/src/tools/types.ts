// src/tools/types.ts
import type { ModifierState } from '../vocabulary';
import type { Contribution } from '../contributions/types';
import type { CursorSpec } from '@weasel-js/cursor';
import type { KernelOverlay } from '../index';

/**
 * A tool's activation key, as `ToolDef.keybinding` declares it. Captures
 * only the fields meaningful to a tool-select key —
 * dispatcher-internal fields (`skipInEditable`, `enabled`,
 * `preventDefault`) live on `KeyBinding` in keyHelpers.ts and are
 * not part of the configurable surface.
 */
export interface ToolKeybinding {
  /** Key or list of keys to match (case-insensitive against `event.key`). */
  key: string | readonly string[];
  /** Require Cmd (mac) / Ctrl (others). Default `false`. */
  mod?: boolean;
  /** Require Alt. Default `false`. */
  alt?: boolean;
  /**
   * Shift policy. `undefined`/`false` forbids shift, `true` requires
   * shift, `'optional'` allows either.
   */
  shift?: boolean | 'optional';
}

/** Modifier-key snapshot at event dispatch time. */
export type ToolModifiers = ModifierState;

/**
 * The focus-declaring case of a `Contribution`: a mode the user switches
 * into, plus the hooks that only make sense for one (activate/deactivate,
 * `cursor`). Everything else — bindings, actions, overlay, presentation — is
 * inherited.
 */
export interface Tool<TOverlay = KernelOverlay> extends Contribution<TOverlay> {
  /** The key that activates this tool. `useKeybindings` appends a binding
   *  entry for it to the consolidated `tool.activate` action (with
   *  `opts.params.toolId` set so the invoker knows which tool to switch to).
   *  A tool with none has no activation key. */
  keybinding?: ToolKeybinding;
  /** The settings its user adjusts while it is active; see `ToolDef.options`. */
  options?: import('./toolOptions').ToolOptions;
  /** Chrome hidden while this is the active tool; see `ToolDef.hides`. */
  hides?: readonly string[];
  cursor?: CursorSpec | (() => CursorSpec);
  /** The tool became live: it took the active slot, or its `hotkey` went
   *  down, while it held neither. A lifecycle moment has no pointer, hit or
   *  modifier state to report; a callback needing the selection or the scene
   *  closes over it, as the tool's actions do. */
  onActivate?: () => void;
  /** The tool stopped being live in both slots, or its canvas unmounted. */
  onDeactivate?: () => void;
}

/** Whether `entry` is a tool: a contribution that can hold focus, chosen from
 *  a palette or held on a key. Only a tool's focus hooks (`cursor`,
 *  `onActivate`, `onDeactivate`) ever run. */
export function isTool<TOverlay>(entry: Contribution<TOverlay>): entry is Tool<TOverlay> {
  return !!(entry.eligibility?.focus || entry.eligibility?.offhand);
}

/** Internal — which slot a tool occupies in the dispatch order. */
export type ToolSlot = 'hotkey' | 'active' | 'ambient';

/** A tool drawing any overlay type — the element type for registries and
 *  dispatchers that never read the overlay. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any>;
