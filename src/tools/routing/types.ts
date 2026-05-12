import type { ToolCtx, ToolPresentation, HotkeyTrigger } from '../types';
import type { KeyBinding } from '../../interactions/actions/useKeybinding';
import type { RenderLayer } from '../../core/layers/render';
import type { Result } from './result';
import type { ModifierKey } from './modifiers';

export type ActionFn<TScratch> = (
  ctx: ToolCtx<TScratch>,
  event?: PointerEvent | KeyboardEvent | WheelEvent,
) => Result<TScratch>;

export type ModifierRoute<TScratch> = Partial<Record<ModifierKey, ActionFn<TScratch>>>;

export type RouteEntry<TScratch> = ActionFn<TScratch> | ModifierRoute<TScratch>;

export type RouteTable<TScratch> = Partial<Record<string, RouteEntry<TScratch>>>;

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
  drag?:    RouteTable<TScratch> | ActionFn<TScratch>;
  wheel?:   ActionFn<TScratch>;
  keyDown?: Record<string, ActionFn<TScratch>>;
  keyUp?:   Record<string, ActionFn<TScratch>>;
  cursor?:  string | ((ctx: ToolCtx<TScratch>) => string);
  overlay?: (ctx: ToolCtx<TScratch>) => RenderLayer<unknown>;
  claimsAll?: boolean;
}

export interface ToolDef<TScratch = void> {
  id: string;
  presentation?: ToolPresentation<TScratch>;
  keybinding?: KeyBinding;
  /** Hotkey-slot trigger key. While this key is held, the tool engages
   *  in the hotkey slot regardless of the active tool. Mirrors the
   *  imperative `Tool.hotkey` field — see `HotkeyTrigger` in `tools/types`. */
  hotkey?: HotkeyTrigger;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
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
