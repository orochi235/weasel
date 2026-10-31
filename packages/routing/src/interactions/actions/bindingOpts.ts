/**
 * The options a gesture binding hands the action it fires, and reading their params.
 */
import type { RoleRebinds } from './modifierRoles';

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. */
export interface BindingOpts {
  /** The id a binding override names this binding by, `<owner>.<role>`:
   *  `undo.key`, `rect.drag`, `nudge.left.big`. Without one it is its owner and
   *  its position (`<entry>#<n>`, `<action>@<n>`), which moves when the defaults
   *  are reordered, so a binding a host may persist an override for declares one. */
  id?: string;
  /** Gesture behaviors the action's own invoker runs. Routing carries the
   *  array to the action and never reads an element, so the element type is
   *  open here; `@weasel-js/core` narrows it. */
  behaviors?: unknown[];
  /** Per-binding action parameters, which an immediate invoker reads via the
   *  second arg to `run`.
   *
   *  May also be a thunk evaluated each time the value is needed, so a tool
   *  can close over refs that mutate during a gesture (e.g. polygon `sides`
   *  adjusted mid-drag via ArrowUp). An ongoing invoker that wants the latest
   *  values at commit re-calls it inside `onEnd` via
   *  `resolveParams(opts?.params)`. */
  params?: Record<string, unknown> | (() => Record<string, unknown>);
  /**
   * The views this binding is live in, by id, where `null` is the surface's
   * own camera. Omitted means every view.
   *
   * A binding that names the view an input landed in outranks every binding
   * that does not, whatever their scope tiers: naming a view is the most
   * specific thing a binding can say about where it applies. Without that, a
   * drag bound inside a minimap view loses to the active tool's marquee.
   */
  views?: readonly (string | null)[];
  /**
   * Says this binding is declared ahead of another on the same input on
   * purpose: its action declines through `enabled()` when the input is not its
   * to take, and the next binding fires. The dispatcher does that for any
   * binding; this tells the route-conflict check the order is the design.
   */
  yields?: boolean;
  /**
   * For a key binding: live while the pointer is over the surface, whichever
   * canvas holds the keys, and only then. For a key that means "here" — a
   * magnifier's peek — on a page with more than one surface that hears it.
   * A held key follows the pointer: one already down when it arrives presses
   * the binding, and leaving releases it.
   */
  over?: boolean;
  /**
   * Keys for some of the action's `modifierRoles` on this binding, by role
   * id, over the action's defaults and any tuning's.
   */
  roles?: RoleRebinds;
  /** Screen travel, in CSS pixels, a drag makes before this binding's ongoing action starts, over the
   *  action's own `dragThresholdPx`. See `OngoingInvoker.dragThresholdPx`. */
  dragThresholdPx?: number;
}

/** Resolve `BindingOpts.params` to a concrete record (calling the thunk if
 *  needed). Returns `undefined` for absent params. */
export function resolveParams(
  params: BindingOpts['params'],
): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  return typeof params === 'function' ? params() : params;
}
