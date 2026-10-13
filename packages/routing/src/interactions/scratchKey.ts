/**
 * Typed keys for the gesture/behavior scratch store, `ctx.scratch`.
 * `ScratchKey<T>` carries its payload type at the typing layer; at runtime
 * the key is just its underlying string and the store remains a plain `Record`.
 *
 * @example
 * ```ts
 * // Module-level constant, shared by writer + reader:
 * const LASSO_VERTICES = scratchKey<readonly { x: number; y: number }[]>('lasso.vertices');
 * setScratch(ctx.scratch, LASSO_VERTICES, vertices);
 * const vertices = getScratch(ctx.scratch, LASSO_VERTICES) ?? [];
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
 * Make a typed scratch key. Two keys with the same `name` refer to the same
 * slot at runtime — the type parameter is a compile-time contract, not a
 * uniqueness guarantee — so namespace the name (`'behavior.field'`).
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
