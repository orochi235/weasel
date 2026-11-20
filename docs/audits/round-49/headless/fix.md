No finding was a false alarm. All six are fixed in seven commits on top of the frozen tree, and there is one more commit recording a ruling.

- **A live scene's data changed on the way to the page** (B): fixed 682021b4b7. `sceneToWire` now encodes a live scene's `toJSON()` as it is, with no decode first. A snapshot passed in is still read back first, which the 2026-11-10 ruling covers.
- **A lost WebGL context made every later render fail** (A): fixed d74be34de7. The page draws on its own canvas, checks that canvas's context before and after each render, and replaces a session whose context is lost. The headless package now lists `webgl2` under `weasel.needs`, so the README's package table gained the badge (`check:needs` required it).
- **A page that crashed between renders failed the next render** (A): fixed c8ce2df0e3. The host checks for a crashed, closed or disconnected page before it renders, and opens a new one.
- **A failing cleanup in `open` hid the real error** (A): fixed b2c08b04c8. A cleanup error is swallowed and the original error is rethrown.
- **`difference` read rasters of different lengths as identical, or gave `NaN`** (B): fixed 92332d4311. It now throws when the lengths differ. It is a test-only helper that doesn't ship, so it has no changeset.
- **A very large render failed with "Invalid string length"** (B): fixed 75fbe2d740 and e679043df1.
  - The first adds `pixelRenderSize` to core, and `planPixelRender` now uses it, so the size rule lives in one place.
  - The second adds `MAX_RESULT_BYTES` to headless. Node refuses an RGBA render past it before a browser starts; the page refuses an RGBA or PNG result past it with an error naming the limit and suggesting tiles.
  - The two property tests that generated huge requests were adjusted to match.
- **Unruled call** (8c854f55e0): refusing an oversized result, rather than sending it across in pieces, is a strict call nobody has made, so I recorded it in `docs/unruled.md`.

**Extra defects:** none.

**Checks:**
- Each touched test file, alone with `--maxWorkers=1`: `protocol.test.ts`, `protocol.pbt.test.ts`, `render.pbt.test.ts`, `host.test.ts`, `page.test.ts`, `page.contextLoss.test.ts`, `testing/compareRaster.test.ts` and `packages/core/src/canvas/` all **pass**.
- `headless.browser.test.ts` and `registered.browser.test.ts`: **unrun** (browser tests can't run here).
- `npm run checks:gate`: **pass**, "all 32 passed", after adding the `webgl2` need it first flagged.
- `npm run check:changesets`: **pass**.
- `npm run lint -w` for headless and core: **not run as asked**. Neither package has a `lint` script, so npm errored. Instead I ran eslint on every changed file, which **passed** with exit 0.
- `typecheck:packages` for headless and core: **pass**.

The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed