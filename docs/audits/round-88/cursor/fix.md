- A sub-step angle turned a glyph that can't rotate on the painted tier only (A+B; the reviewers' pencil example is wrong because the pencil can turn, but the eyedropper, swap, and marked pen and crosshair glyphs could not): fixed 96c86df9c8
- `cursorFor` returned a cached cursor for an unknown name like `pen+add` (A): fixed d12eb3d1b3
- `brushRing(-Infinity)` and an overflowing radius such as `1e307` drew a 24 px ring (A+B): fixed fa389cd63e
- `bakeFallback` passed values the browser drops whole, such as `hand`, `url(a.png)` and `pointer !important` (A+B): fixed 109453a46d. It now requires a cursor keyword, optionally after `url(…)` entries. This was my strict call, recorded in `docs/unruled.md`.
- A `CursorSink` couldn't give the element back once `setBase` was called (A): fixed 3234b16562. I added an optional `release()`, and `useToolCursor` calls it on unmount. It's optional so existing hand-built sinks still compile. The changeset is `minor` because it adds API.
- An infinite `size` threw in `cursorFor` but drew at 24 px through `resolveCursor` (B): fixed eed9a248f3. `resolveCursor` now throws for a size or world radius of `Infinity`, recorded in `docs/unruled.md`.
- A painted cursor's `fallback` was checked and then dropped, so a sink with no painted layer showed no cursor (B): fixed 1aa4bbe9e2. The painted `ResolvedCursor` now carries `fallback`, and the sink writes it when `painted()` is undefined. The changeset is `minor` because it adds API.

No extra defects found.

Checks:
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/cursor` and `npm run lint -w @weasel-js/core`: neither package has a lint script. The root `npm run lint` passed inside the gate.
- `npm run check:changesets`: pass (OK)
- Test files, each run alone: `bake.test.ts` pass, `bake.pbt.test.ts` pass, `bake.shrunk.test.ts` pass, `brushRing.test.ts` pass, `cursorSink.test.ts` pass, `registry.test.ts` pass, `registry.pbt.test.ts` pass, `resolve.test.ts` pass, `resolve.pbt.test.ts` pass, `packages/core/src/canvas/useToolCursor.test.ts` pass

tally: 10 of 10 fixed, 0 extra fixed