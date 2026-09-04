import type { ToolCtx, ToolPresentation, HotkeyTrigger } from './types';
import type { RenderLayer } from '../core/layers/render';
import type { GestureBinding } from '../interactions/actions/binding';
import type { CapabilityTag } from '@weasel-js/modes';
import type { OverlayPosition } from '../contributions/types';
import type { CursorSpec } from '@weasel-js/cursor';

/**
 * Configurable activation-key descriptor for tools that expose their
 * keybinding to the host (currently Lasso and Eyedropper). Captures
 * only the fields meaningful to a caller-supplied tool-select key —
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

/**
 * What a tool declares.
 *
 * A tool is a declarative shell, not an event handler: it names the gestures
 * it responds to and, for each, the action to invoke. The dispatcher owns the
 * gesture, and the action owns the preview and the commit — so a tool
 * definition is mostly `bindings`, plus presentation and any actions the tool
 * itself introduces.
 */
export interface ToolDef<TScratch = void> {
  id: string;
  /** Capability tags for modality eligibility. Forwarded onto `Tool.capabilities`. */
  capabilities?: CapabilityTag[];
  /**
   * Actions this tool owns and needs registered while it is in the tools
   * registry — e.g. polygon's `polygon.adjustSides`, which its own bindings
   * reference by id.
   *
   * Declared here rather than registered by the hook with `useAction`,
   * because tool hooks run wherever the consumer calls them — for
   * `<SceneCanvas>` that is ABOVE `<ActionsProviderIfRoot>`, where
   * `useActionsRegistry()` returns null and `useAction` silently no-ops. The
   * result was a binding pointing at an action id nothing had registered, so
   * the gesture fell through to whatever matched next (polygon's
   * wheel/arrow-key side adjustment did nothing and `nudge.*` moved the
   * selection instead). `<ToolActionsMounter>` registers these from inside
   * the provider.
   */
  actions?: import('interactions/actions/registry').Action[];

  /** Hook name as exported from the kit barrel (e.g. `'useHandTool'`).
   *  Set by built-in hooks for inspector / debugging. Consumer-authored
   *  tools may set this to surface their hook name; omitted is fine.
   *  Introspection-only — do not make this load-bearing in production.
   *  Read off the def via `Tool.def` (the reflection escape hatch). */
  hookName?: string;
  presentation?: ToolPresentation<TScratch>;
  /** Optional caller-supplied activation key. Most built-in tools have their
   *  activation key declared in `BUILTIN_SELECT_KEYS` in `useKeybindings.ts`;
   *  this field is for tools that want their activation key to be
   *  configurable by the host (currently Lasso and Eyedropper). The dynamic
   *  loop in `useKeybindings.ts` picks this up and appends a binding entry
   *  to the consolidated `tool.activate` action (with `opts.params.toolId`
   *  set so the invoker knows which tool to switch to). */
  keybinding?: ToolKeybinding;
  /** Held-key trigger: this tool engages while the key is down and
   *  disengages on release. Carried onto `Tool.eligibility.offhand`, which
   *  assembly reads to register the consolidated `tool.offhand` action — the
   *  declaration is the wiring, with nothing for the host to do. */
  hotkey?: HotkeyTrigger;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: CursorSpec | ((ctx: ToolCtx<TScratch>) => CursorSpec);
  /** Override the default scratch initializer. Default is `() => null`
   *  cast to `TScratch`, which works for tools whose scratch is fresh
   *  every gesture. Tools that need scratch identity to survive across
   *  gesture boundaries (e.g. the pen tool's multi-click subpath state)
   *  pass a stable-ref-returning thunk here. The factory forwards this
   *  onto the returned `Tool.initScratch`. */
  initScratch?: () => TScratch;
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
   *  `if (!scratch.something) return []` — rather than expecting the kit to
   *  swap layers as the gesture progresses.
   *
   *  Pass an array to contribute several layers; they render in order. */
  overlay?: RenderLayer<unknown> | RenderLayer<unknown>[];
  /** Where `overlay` sits relative to the selection chrome. Defaults to
   *  `'top'`, above everything. */
  overlayPosition?: OverlayPosition;
}

/** Viewport-tool spec. Once phase tables went away this stopped differing
 *  from `ToolDef` in any structural way; `defineViewportTool` survives as the
 *  authoring signal that a tool pans/zooms the view rather than the scene. */
export type ViewportToolDef<TScratch = void> = ToolDef<TScratch>;
