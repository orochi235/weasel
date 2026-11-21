- [r42-1] pointSnap's trail snapped with free modifiers, so the cursor preview didn't match the click (carried): fixed 3e3f11bcd9. `<SceneCanvas>` now sources a new `modifiers` dep (`HeldModifiersDep`). `PointSnap.trail` takes `SnapMods`, which is a breaking change with a `major` changeset. `createPointerFollower` can follow modifier changes too. The pen and spiro previews both snap under the held keys. There is a new pen test; spiro got the same fix but no test of its own.
- [r42-2] SnapCollect.include was documented and read but never set (carried): fixed 4c2b427522. This was a behavior call: I removed the field and its use in `pathSnapSource`, and did not plumb it through `SnapBegin`. Only one source read it, and it would only work if every source honored it, as they all do for `exclude`. The call is recorded in `docs/unruled.md`. It is breaking, with a `major` changeset.
- [r42-3] createSnapSession2d couldn't express `along`, `sources` or `omit` (carried): fixed 7abc491ce4. It now takes `along` and `omit`. Its own `sources` already serve as the gesture's sources.
- [r42-4] The test sessionDep ignored a request's `sources` and `omit` (carried): fixed 4842d6d80f. A shared `requestedSnapSources` helper now does this for the canvas dep too. Measure's test dep had the same gap and now asks a request's own `sources` too.
- [r42-5] The debug overlay placed a segment or bounded-face candidate on its unbounded line or plane (carried): fixed ff40d7f836. This uses a new geom export, `nearestOnSpan`, added in bb54e244f8.
- [r42-6] A group move never found its own geometry, because `geometryAt` got the group's id rather than its subtree (carried): fixed 14063e393d. `ownGeometryAt` now expands each id to its subtree.
- [r42-7] `SpanSnap.anchor` moved the start but `startHeld()` still reported the old snap (carried): fixed b52bb4193a.

Extra: `nearestOnSpan` (bb54e244f8) is new geom API that r42-5 needed. I count it under r42-5, not as an extra defect.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`, plus `editing/src/actions/insert/*.test.ts` and measure's `measure.test.ts` and `snap.test.ts`: pass. No browser tests were touched.
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed `check:changesets` (titles over 140 characters) and `check:engine-boundary` (stale `engine.ts`). I fixed both into their commits and reran.
- `npm run check:changesets`: pass.
- `npm run check:size`: pass.
- `npm run typecheck:packages -- core editing path-tools measure geom`: pass.
- `npm run lint -w <pkg>`: none of core, geom, editing, path-tools or measure has a `lint` script ("Missing script: lint"). I ran eslint on every changed file instead: pass.
- The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed