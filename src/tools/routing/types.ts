import type { ToolCtx, ToolPresentation, HotkeyTrigger, ToolModifiers } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';
import type { Result } from './result';
import type { ModifierKey } from './modifiers';
import type { GestureBinding } from '../../interactions/actions/binding';

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

export type ActionFn<TScratch> = (
  ctx: ToolCtx<TScratch>,
  event?: PointerEvent | KeyboardEvent | WheelEvent,
) => Result<TScratch>;

export type ModifierRoute<TScratch> = Partial<Record<ModifierKey, ActionFn<TScratch>>>;

export type RouteEntry<TScratch> = ActionFn<TScratch> | ModifierRoute<TScratch>;

export type RouteTable<TScratch> = Partial<Record<string, RouteEntry<TScratch>>>;

/** Map from key-route string (e.g. `"ArrowDown"`, `"ArrowDown?shift"`) to
 *  action. Parsed by the reflection emitter and dispatcher. */
export type KeyRouteTable<TScratch> = Partial<Record<string, ActionFn<TScratch>>>;

/** Wheel direction sub-table. Keys: `'up' | 'down' | '*'`. Function form
 *  is sugar for `{ '*': fn }` (matches both directions). */
export type WheelTable<TScratch> = Partial<Record<'up' | 'down' | '*', ActionFn<TScratch>>>;

/** MultiTouch tap fingers sub-table. Keys: `'2' | '3' | '4'`. */
export type MultiTouchTapTable<TScratch> = Partial<Record<'2' | '3' | '4', ActionFn<TScratch>>>;

export interface PhaseDef<TScratch> {
  click?:   RouteTable<TScratch>;
  /** Pre-threshold classifier route. Runs synchronously on pointerdown,
   *  before the dispatcher distinguishes click vs. drag. Use this for
   *  classification gestures that need to mutate scratch *before* the
   *  drag pipeline starts — e.g. select tool determining whether a hit
   *  belongs to the existing selection ("drag will move all") or not
   *  ("drag will move just this one").
   *
   *  Semantics:
   *  - Return `begin(spec)` to open engaged phase with scratch. The
   *    spec's `onMove`/`onRelease` will fire if the dispatcher escalates
   *    to drag; otherwise the next click handler runs normally with the
   *    prepared scratch visible.
   *  - Return `apply(ops)` or `commit(ops)` to finish the gesture
   *    immediately (rare).
   *  - Return `none()` or omit to pass through to threshold-gated
   *    click/drag classification.
   *
   *  Phase 4.5 (factory completeness). Predates the imperative
   *  `pointer.onDown` channel that useSelectTool used through Phase 3. */
  pointerDown?: RouteTable<TScratch>;
  dblTap?:  RouteTable<TScratch>;
  /** Right-click route table. Mirrors `click` semantics — keyed by hit-test
   *  target, modifier-aware. The dispatcher calls `preventDefault()` on the
   *  underlying `contextmenu` DOM event so tools fully own the menu. */
  contextMenu?: RouteTable<TScratch>;
  drag?:    RouteTable<TScratch> | ActionFn<TScratch>;
  wheel?:   WheelTable<TScratch> | ActionFn<TScratch>;
  keyDown?: KeyRouteTable<TScratch>;
  keyUp?:   KeyRouteTable<TScratch>;
  /** Multi-finger tap. Synthesized by the dispatcher when a multitouch
   *  gesture releases without movement past the tap threshold. Keys: the
   *  fingers count as a string (`'2'`, `'3'`, `'4'`). */
  multiTouchTap?: MultiTouchTapTable<TScratch>;
  cursor?:  string | ((ctx: ToolCtx<TScratch>) => string);
  /** Optional overlay layer rendered while the tool is in any active slot
   *  (active, hotkey, or ambient). The factory evaluates the thunk once
   *  at translation time and emits the resulting RenderLayer on
   *  Tool.overlay. The layer's `draw` closure should read dynamic state
   *  (scratch, controller overlay snapshots) via refs/closures captured
   *  in the enclosing render scope — same pattern Phase 2/3 hand-rolled
   *  tools use today.
   *
   *  Function form rather than a direct RenderLayer so consumers can
   *  defer construction until inside a `useMemo` factory body, where
   *  `useRef`-backed values are stable. Symmetric with `cursor`'s
   *  function form.
   *
   *  Phase 5b note: only `initial.overlay` is read. If `engaged.overlay`
   *  is set, it is ignored — phase-specific overlay routing is a future
   *  enhancement. Tools that need engagement-aware previews should gate
   *  inside the single overlay's `draw` body via `if (!scratch.somefield)
   *  return []`, which is how every Phase 2/3 hand-rolled tool already
   *  does it. */
  overlay?: () => RenderLayer<unknown>;
  /** Modal-claim predicate. When this resolves to `true`, the dispatcher
   *  routes every pointerdown to this tool and bypasses the affordance-layer
   *  hit-test pipeline — used by tools in modal states (pen mid-path, text
   *  mid-edit) where affordance hits would otherwise interrupt the
   *  in-progress gesture.
   *
   *  Function form receives the live ToolCtx (scratch, view, modifiers,
   *  target). Boolean form is sugar for `() => true` / `() => false` —
   *  use the function form when the decision depends on scratch state
   *  (e.g. `(ctx) => ctx.scratch?.midPath === true`).
   *
   *  Resolved per-call by the factory — the function fires on every
   *  pointerdown the dispatcher considers handing to this tool. Keep it
   *  cheap (no allocations, just a scratch read). */
  claimsAll?: boolean | ((ctx: ToolCtx<TScratch>) => boolean);
}

export interface ToolDef<TScratch = void> {
  id: string;
  /** Hook name as exported from the kit barrel (e.g. `'useHandTool'`).
   *  Set by built-in hooks for inspector / debugging. Consumer-authored
   *  tools may set this to surface their hook name; omitted is fine.
   *  Introspection-only — do not make this load-bearing in production.
   *  Read off the def via `Tool.def` (the reflection escape hatch). */
  hookName?: string;
  presentation?: ToolPresentation<TScratch>;
  /** Optional caller-supplied activation key. Most built-in tools register
   *  their activation key directly via `makeToolShortcutAction` +
   *  `makeToolActivateAction` at canvas-mount time (keys live in
   *  `BUILTIN_SELECT_KEYS` in `useKeybindings.ts`); this field is for tools
   *  that want their activation key to be configurable by the host (currently
   *  Lasso and Eyedropper). The dynamic loop in `useKeybindings.ts` picks this
   *  up and registers `tool.activate.<id>` + `tool.shortcut.<id>` actions when
   *  set. */
  keybinding?: ToolKeybinding;
  /** Declarative held-key trigger (reflection / inspector only). When set,
   *  signals to the host that this tool can engage via a held key; the host
   *  must register the activation via `makeToolHoldAction(toolId, key)`. Built-in
   *  tools declare held keys in `BUILTIN_HOLD_ACTIONS`; configurable-hotkey tools
   *  rely on the host to wire the action. Setting this field does NOT automatically
   *  engage the held-key behavior. */
  hotkey?: HotkeyTrigger;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  /** Override the default scratch initializer. Default is `() => null`
   *  cast to `TScratch`, which works for tools whose scratch is fresh
   *  every gesture. Tools that need scratch identity to survive across
   *  gesture boundaries (e.g. the pen tool's multi-click subpath state)
   *  pass a stable-ref-returning thunk here. The factory forwards this
   *  onto the returned `Tool.initScratch`. */
  initScratch?: () => TScratch;
  /** Optional hit-test override. Mirrors `Tool.hitOverride` — see that
   *  field for full semantics. The factory forwards this directly onto the
   *  returned Tool. */
  hitOverride?: (ctx: {
    worldX: number;
    worldY: number;
    scratch: TScratch;
    view: View;
    modifiers: ToolModifiers;
  }) => { target: string; extra?: unknown } | null;
  /** Phase 14+: declarative gesture-bindings forwarded onto `Tool.bindings`.
   *  The new dispatcher consults these while this tool is active. */
  bindings?: GestureBinding[];
  initial: PhaseDef<TScratch>;
  engaged?: PhaseDef<TScratch>;
}

/** Viewport-tool spec — strict subset of ToolDef. Drops click/dblTap,
 *  narrows drag to plain ActionFn. Mechanically derived via Pick/Omit
 *  so the subset relationship is compiler-enforced. */
export type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'keyUp' | 'cursor' | 'overlay' | 'claimsAll'
> & {
  drag?: ActionFn<TScratch>;
};

export type ViewportToolDef<TScratch = void> = Omit<
  ToolDef<TScratch>, 'initial' | 'engaged'
> & {
  initial: ViewportPhaseDef<TScratch>;
  engaged?: ViewportPhaseDef<TScratch>;
};
