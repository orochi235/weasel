/**
 * Typed keys for the gesture/behavior scratch store.
 *
 * Gestures expose `ctx.scratch: Record<string, unknown>` as a per-gesture
 * mutable bag that behaviors use to stash state across `onDown` / `onMove`
 * / `onEnd` calls. The store is `unknown`-valued because behaviors are
 * tool-agnostic — a single behavior may run under different tools with
 * different scratch shapes. Without a typing convention every read site
 * has to `(ctx.scratch as <some shape>)[KEY]`, and a writer changing the
 * shape can silently break readers with no compile-time signal.
 *
 * `ScratchKey<T>` is a phantom-typed string that carries its payload type
 * via a branded interface. `getScratch` and `setScratch` use the brand to
 * narrow / constrain at the typing layer; at runtime the key is just its
 * underlying string and the store remains a plain `Record`.
 *
 * @example
 * ```ts
 * // Module-level (or behavior-level) constant, shared by writer + reader:
 * const LASSO_VERTICES = scratchKey<readonly { x: number; y: number }[]>('lasso.vertices');
 *
 * // Writer (a tool's onMove):
 * setScratch(ctx.scratch, LASSO_VERTICES, vertices);
 *
 * // Reader (a behavior's onEnd):
 * const vertices = getScratch(ctx.scratch, LASSO_VERTICES) ?? [];
 * //    ^?  readonly { x: number; y: number }[] | undefined
 * ```
 */

/** Phantom-typed key for a scratch slot. The `__scratchKeyPayload` phantom
 *  field carries the value type without occupying any runtime memory. */
export interface ScratchKey<T> {
  readonly name: string;
  /** Phantom — never read at runtime. Only present so TypeScript can
   *  recover `T` at use sites. */
  readonly __scratchKeyPayload?: (_: T) => T;
}

/** Compatible scratch store shape. The kit's gesture context's `scratch`
 *  field already satisfies this; consumers don't need to construct one. */
export type ScratchStore = Record<string, unknown>;

/**
 * Make a typed scratch key. Use module-level constants so the same key
 * is shared by writer and reader.
 *
 * Namespace the name by behavior or feature to avoid collisions
 * (`'behavior.field'` is a good convention). Two keys with the same
 * `name` refer to the same slot at runtime — the type parameter is a
 * compile-time contract, not a uniqueness guarantee.
 */
export function scratchKey<T>(name: string): ScratchKey<T> {
  return { name };
}

/** Read a typed slot from the scratch store. Returns `undefined` if
 *  nothing has been written under the key. */
export function getScratch<T>(
  store: ScratchStore,
  key: ScratchKey<T>,
): T | undefined {
  return store[key.name] as T | undefined;
}

/** Write a value to a typed slot. Overwrites whatever was there. */
export function setScratch<T>(
  store: ScratchStore,
  key: ScratchKey<T>,
  value: T,
): void {
  store[key.name] = value;
}

/** Remove a slot from the scratch store. Returns `true` if it was set,
 *  `false` if it wasn't. */
export function deleteScratch<T>(
  store: ScratchStore,
  key: ScratchKey<T>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(store, key.name)) {
    delete store[key.name];
    return true;
  }
  return false;
}
