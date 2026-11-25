A replaced override put back the cursor from before the first override (A) — fixed e387583eb3

Base cursor left on the old element on an element swap, plus the old painted state still drawing (A) — fixed c2705f4e4f (element) and efaa626801 (painted state). The sink still has no dispose, so nothing clears its writes when the surface unmounts; not changed.

Sink leaves its base cursor on the old element when `element()` answers another (B) — duplicate of A's element-swap finding, fixed c2705f4e4f. The old element now gets back what it showed before the sink wrote there, not the base, and the existing test for this case was rewritten to match.

Painted-state swap not cleaned up the way an element swap is (B) — fixed efaa626801

Invalid `fallback` throws on the CSS tier but is accepted on the painted tier (B) — fixed 37ac5e3ad6. It is a strict call: `resolveCursor` now throws on every tier, recorded in `docs/unruled.md`.

A world-unit brush ring has no one-pixel floor (B) — fixed 3665a44218. The floor is in `worldCursorPx`, so it covers every world-sized glyph, including a radius times zoom that rounds down to 0. The two property tests in `bake.pbt.test.ts` were updated for the floor.

Fractional `WEASEL_PBT_RUNS` passed straight to fast-check (B) — fixed 4a1dba28d8, in cursor's fixture only. The same pattern is in the `svg` and `paint` packages' fixtures and tests, which are outside this area and left alone.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched or related, one at a time: `cursorSink.test.ts` 12 passed, `paint.test.ts` 13 passed, `bake.pbt.test.ts` 7 passed, `resolve.test.ts` 14 passed, `resolve.pbt.test.ts` 5 passed, `pbt.fixture.test.ts` 2 passed, `brushRing.test.ts` 3 passed, routing `dispatcher/channels` 6 passed — pass
- `npm run checks:gate`: "checks:gate: all 33 passed" — pass
- `npm run lint -w packages/cursor`: the package has no `lint` script (npm error: missing script). `npx eslint packages/cursor/src` reported nothing — pass
- Tree clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 0 extra fixed