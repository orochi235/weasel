// Op-factory registry — pairs a stable `name` (stamped onto each op by its
// factory) with a `(args) => Op` rebuilder so a `{ name, args }` snapshot
// can be reconstituted into a live `Op` whose `apply`/`invert` closures
// behave identically to the original.
//
// The kit calls `registerOpFactory` at module-init time for every built-in
// factory (see `./create.ts`, `./delete.ts`, `./transform.ts`, etc.).
// Consumers wanting their custom ops to survive `History.serialize()` /
// `History.restore()` register their factories at app bootstrap, before
// `createHistory` is called.

import type { Op } from './types';

type Builder = (args: unknown) => Op;

const FACTORIES = new Map<string, Builder>();

/** Register an op-factory builder under a stable name. The builder receives
 *  the serialized `args` and must return an `Op` equivalent to one freshly
 *  constructed at the original call site (`apply` and `invert` behave the
 *  same). Idempotent on the same `(name, build)` pair; a second registration
 *  with a different builder silently overwrites — kit modules import each
 *  factory exactly once at init, so this never races in practice. */
export function registerOpFactory<A>(name: string, build: (args: A) => Op): void {
  FACTORIES.set(name, build as Builder);
}

/** Rebuild an op from its serialized `(name, args)`. Returns `null` when
 *  `name` isn't registered — callers handle this (typically by substituting
 *  a no-op placeholder so stack ordering survives across kit version skew). */
export function rebuildOp(name: string, args: unknown): Op | null {
  const f = FACTORIES.get(name);
  return f ? f(args) : null;
}

/** Test-only: drop all registrations. Not exported from the kit barrel — the
 *  built-in factories self-register at module init, so production code never
 *  needs to clear the table. Exposed for unit tests that want to assert the
 *  unknown-name fallback path. */
export function _clearOpFactoriesForTest(): void {
  FACTORIES.clear();
}

/** Test-only: read-only snapshot of currently-registered names. */
export function _registeredOpNamesForTest(): string[] {
  return [...FACTORIES.keys()];
}
