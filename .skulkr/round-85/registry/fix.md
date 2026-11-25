`ReflectedEntry.shadowed` doc said "oldest first", but it is ordered by rank, then age (A): fixed 65f6cb1e71 (doc only, plus a test that pins the order)

`deepEqual` ignores symbol-keyed properties (A): fixed 225d953578

`createWarnOnce` with a `NaN`, zero or negative `cap` never forgets or never dedups (A): fixed 64bc9e86c6 (my call: it throws a `RangeError` for any cap that is not a positive integer, `Infinity` included; recorded in `docs/unruled.md`)

An extension released and registered again in the same tick moves to the end of `entries()` (A): fixed d780319d3e

`isOneChar` reads a lone surrogate as one character (A): fixed 7329068076

A child `ExtensionRegistry` lists every inherited id before its own when the parent was not made by this module (B): fixed f5fe1b83c8

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched: `reflectable.test.ts` pass (42), `deepEqual.test.ts` pass (5), `warnOnce.test.ts` pass (5), `codePoint.test.ts` pass (4), `extensionRegistry.test.ts` pass (11). Also re-ran `deepEqual.pbt.test.ts` and `deepEqual.meta.pbt.test.ts`: pass.
- Consumers of the extension registry: `packages/core/src/core/ops/registry.test.ts` pass, and `packages/renderer/src/shaders/registerProgram.test.ts` pass, along with one other shader test.
- `npm run checks:gate`: pass, "all 33 passed". The first run failed on `check:proto-index` at `deepEqual.ts:44`; I fixed that and folded it into 225d953578.
- `npm run lint -w @weasel-js/registry`: not run, because `@weasel-js/registry` has no `lint` script (npm prints "Missing script: \"lint\""). Root `npm run lint` passed inside the gate.

The tree is clean, and `.skulkr/` is out of every commit.

tally: 6 of 6 fixed, 0 extra fixed