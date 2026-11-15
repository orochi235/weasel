/**
 * Action ids and the params `ActionParamSchema` gives them: what types an invocation's params by the id it names.
 */
import type { ActionParamSchema } from '../../index';

/** Every action id merged into {@link ActionParamSchema}. */
export type KnownActionId = keyof ActionParamSchema & string;

declare const dynamic: unique symbol;

/**
 * An action id known only at runtime, marked by {@link dynamicActionId}: one that takes any params, unchecked. An
 * id the schema names takes its entry's params, and any other id takes none, so code holding an id it read from an
 * action, a menu or a store passes it as one of these to hand it params.
 */
export type DynamicActionId = string & { readonly [dynamic]: true };

/** `id` marked as a {@link DynamicActionId}: the way to invoke or bind an id the schema cannot check. */
export function dynamicActionId(id: string): DynamicActionId {
  return id as DynamicActionId;
}

/** The params an action `Id` reads: its {@link ActionParamSchema} entry, or an open record for any other id. */
export type ActionParamsOf<Id extends string> =
  Id extends KnownActionId ? ActionParamSchema[Id] : Record<string, unknown>;

/** The params an id the schema does not name takes: none. Its one key is what a type error passing some shows. */
export type NoParams = { readonly 'an id ActionParamSchema does not name takes params only as dynamicActionId(id)': never };

/**
 * The params an invocation of `Id` may pass — a binding's `opts.params`, `trigger`'s, `begin`'s: the whole of its
 * schema entry, every required key included; any record for a {@link DynamicActionId}; and none for an id the schema
 * does not name.
 */
export type InvokeParams<Id extends string> =
  Id extends DynamicActionId ? Record<string, unknown> : Id extends KnownActionId ? ActionParamSchema[Id] : NoParams;
