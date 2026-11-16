/**
 * `defineAction`: the authoring path that reads an action's params from `ActionParamSchema` by its id, so its
 * invoker, gates, variants and bindings are typed without a cast.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import type { CursorSpec } from '@weasel-js/cursor';
import type { PrefGroup } from '@weasel-js/pref-schema';
import type { Action, ActionUnavailable, ActionVariant, Carried } from './action';
import type { ActionSettings } from './actionSettings';
import type { ActionParamsOf } from './actionIds';
import type { BoundGesture } from './binding';
import type { ActionDeps, Invoker } from './invoker';

/** An {@link ActionVariant} whose params are `P`'s. */
export interface ActionVariantOf<P> extends Omit<ActionVariant, 'params'> {
  params: Readonly<P>;
}

/** {@link ActionSettings} whose `params` makes `P`'s. */
export interface ActionSettingsOf<P> extends Omit<ActionSettings, 'params'> {
  params?(path: string, value: unknown): Partial<P> | null;
}

/**
 * An action descriptor for the id `Id`, every member that reads params reading `P`: its
 * `ActionParamSchema` entry, or an open record for an id the schema does not name. Each param may be absent where
 * the action reads them, since a palette passes none and a tuning lays only some.
 */
export interface ActionOf<Id extends string, P = ActionParamsOf<Id>> extends Omit<
  Action,
  'id' | 'invoker' | 'enabled' | 'active' | 'preview' | 'cursor' | 'variants' | 'defaultBinding' |
  'settings' | 'params'
> {
  id: Id;
  invoker?: Invoker<P>;
  enabled?: (
    deps?: ActionDeps,
    at?: { x: number; y: number },
    carried?: Carried,
    params?: Readonly<Partial<P>>,
    viewId?: string | null,
  ) => true | ActionUnavailable;
  active?: (deps?: ActionDeps, params?: Readonly<Partial<P>>) => boolean;
  preview?: (deps: ActionDeps, params?: Partial<P>) => (() => void) | void;
  cursor?: CursorSpec | ((params: Partial<P> | undefined) => CursorSpec | undefined);
  variants?: readonly ActionVariantOf<P>[];
  defaultBinding?: GestureSpec | BoundGesture<P>[];
  settings?: ActionSettingsOf<P>;
  params?: PrefGroup | ((params: Readonly<Partial<P>>) => PrefGroup | null);
}

/**
 * `action` as an {@link Action}, its members typed by the params `ActionParamSchema` gives its id:
 *
 * ```ts
 * declare module '@weasel-js/routing' {
 *   interface ActionParamSchema { 'review.stamp': { size: number } }
 * }
 * const stamp = defineAction({
 *   id: 'review.stamp',
 *   label: 'Stamp',
 *   invoker: { timing: 'immediate', run: (deps, params) => stampAt(deps, params?.size ?? 1) },
 * });
 * ```
 *
 * An action whose id is chosen at runtime, which no schema entry can name, states its params as `P`:
 * `defineAction<string, RulerParams>({ id, … })`.
 */
export function defineAction<const Id extends string, P = ActionParamsOf<Id>>(
  action: ActionOf<Id, NoInfer<P>>,
): Action & { id: NoInfer<Id> } {
  // Each member reads a narrower record than `Action`'s, which only the schema entry for `id` vouches for. The
  // return type does not infer `Id`, or a result typed `Action` where it lands would make the id `string`.
  return action as unknown as Action & { id: Id };
}
