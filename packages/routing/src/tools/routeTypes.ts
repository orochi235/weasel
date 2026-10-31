import type { ToolKeybinding } from './types';
import type { HotkeyTrigger, ToolPresentation } from '../contributions/types';

import type { GestureBinding } from '../interactions/actions/binding';
import type { CapabilityTag } from '@weasel-js/modes';
import type { OverlayPosition } from '../contributions/types';
import type { CursorSpec } from '@weasel-js/cursor';
import type { KernelOverlay } from '../index';

/**
 * What a tool declares.
 *
 * A tool is a declarative shell, not an event handler: it names the gestures
 * it responds to and, for each, the action to invoke. The dispatcher owns the
 * gesture, and the action owns the preview and the commit — so a tool
 * definition is mostly `bindings`, plus presentation and any actions the tool
 * itself introduces.
 */
export interface ToolDef<TOverlay = KernelOverlay> {
  id: string;
  /** Capability tags for modality eligibility. `defineTool` forwards these
   *  onto `Tool.eligibility.capabilities`, which is where every gate reads
   *  them — the assembled `Tool` carries no `capabilities` of its own. */
  capabilities?: CapabilityTag[];
  /**
   * Actions this tool owns and needs registered while it is in the tools
   * registry — e.g. polygon's `polygon.adjustSides`, which its own bindings
   * reference by id.
   *
   * Declared here rather than registered by the hook with `useAction`,
   * because tool hooks run wherever the consumer calls them, which may be
   * outside any registry — and there `useAction` silently no-ops, leaving a
   * binding that points at an action id nothing registered.
   */
  actions?: import('../interactions/actions/action').Action[];
  /** Menus this tool adds while it is active. */
  menus?: import('../menus/types').MenuDef[];
  /**
   * The settings its user adjusts while it is active, as params of the action
   * it binds: a brush's size and strength. `<SceneCanvas>` tunes that action
   * from the `toolOptionValues` dep, and `defineTool` adds step actions for the
   * size and strength, keyed to `[` `]` and `Shift+[` `Shift+]` while this is
   * the active tool. See {@link import('./toolOptions').ToolOptions}.
   */
  options?: import('./toolOptions').ToolOptions;

  /** Hook name as exported from the kit barrel (e.g. `'useHandTool'`).
   *  Set by built-in hooks for inspector / debugging. Consumer-authored
   *  tools may set this to surface their hook name; omitted is fine.
   *  Introspection-only — do not make this load-bearing in production.
   *  Read off the def via `Tool.def` (the reflection escape hatch). */
  hookName?: string;
  presentation?: ToolPresentation;
  /** Optional caller-supplied activation key. Most built-in tools have their
   *  activation key declared in `BUILTIN_SELECT_KEYS` in `useKeybindings.ts`;
   *  this field is for tools that want their activation key to be
   *  configurable by the host (currently Lasso and Eyedropper). The dynamic
   *  loop in `useKeybindings.ts` picks this up and appends a binding entry
   *  to the consolidated `tool.activate` action (with `opts.params.toolId`
   *  set so the invoker knows which tool to switch to). */
  keybinding?: ToolKeybinding;
  /** Held-key trigger: this tool engages while the key is down and
   *  disengages on release — a modifier, `'space'`, or any other key
   *  (`'o'`), never while typing in a text field. Carried onto
   *  `Tool.eligibility.offhand`, which
   *  assembly reads to register the consolidated `tool.offhand` action — the
   *  declaration is the wiring, with nothing for the host to do. */
  hotkey?: HotkeyTrigger;
  /** Fires as the tool becomes live in the active or hotkey slot. See
   *  `Tool.onActivate`. */
  onActivate?:   () => void;
  /** Fires as the tool stops being live in either slot. */
  onDeactivate?: () => void;
  cursor?: CursorSpec | (() => CursorSpec);
  /** Declarative gesture bindings, forwarded onto `Tool.bindings`. The
   *  gesture dispatcher consults these at active scope while this tool is the
   *  active one, and at hotkey scope while it is held. This is the tool's
   *  entire input surface — the `initial` / `engaged` phase tables that used
   *  to sit beside it are gone, along with the second dispatcher that read
   *  them. */
  bindings?: GestureBinding[];
  /** Optional overlay layer rendered while the tool occupies any slot
   *  (active, hotkey, or ambient), surfaced on `Tool.overlay`.
   *
   *  The layer's `draw` closure should read dynamic state through refs or
   *  closures captured in the enclosing render scope, and gate on it there —
   *  `if (!state.something) return []` — rather than expecting the kit to
   *  swap layers as the gesture progresses.
   *
   *  Pass an array to contribute several layers; they render in order. */
  overlay?: TOverlay | TOverlay[];
  /** Where `overlay` sits relative to the selection chrome. Defaults to
   *  `'top'`, above everything. */
  overlayPosition?: OverlayPosition;
}

