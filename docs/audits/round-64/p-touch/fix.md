- Polyline stroke, caps, or miter can reach past the label's end unchecked (A+B): fixed 5288fb9df6. This also covers a line's reach before the label's start, which is how rects were already treated. I moved existing test lines off x = 0 and changed the property fixture so lines still get written as objects often enough to be checked.
- `sceneToLbx` silently drops `flattenTolerancePx` (A), and drops `pixelRatio`/`screen` (B), one finding: fixed d6584cf1ad. This adds a `CommandRasterizerOptions` argument to core's `commandRasterizer` (`screen`, `flattenTolerancePx`), with a `minor` changeset for core.
- A skipped command is reported under its only child's kind (A): fixed 26c30b0bf2.
- `tapeForWidthMm` can't find 3.5mm tape from the status reply's 4 (A): fixed 96ab69d45e. `tapeForWidthMm(4)` now returns the 3.5mm tape and the `widthMm` doc is corrected. This is my call and is recorded in `docs/unruled.md`. The "status reports 4" fact comes from Brother's reference and nobody has checked it on a printer. obwat's own `queryMedia` still passes 4 to `media()` and gets a computed dot count; that is outside this area and was not fixed.
- A justified text box drops its `align` (B): fixed e25b472db3.
- An auto-length label longer than the 1000mm ceiling is written without complaint (B): fixed 84b752c67c. This is my call (it throws a `RangeError`; writing the label at a fixed length is the way out) and is recorded in `docs/unruled.md`.

Extra: none.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - shapes.test.ts: pass
  - writeLbx.test.ts: pass
  - writeLbx.pbt.test.ts: pass
  - writeLbx.edges.pbt.test.ts: pass
  - writeLbx.shrunk.test.ts: pass
  - sceneLbx.test.ts (new): pass
  - tape.test.ts (new): pass
  - print.test.ts: pass
  - render.test.ts: pass
  - core commandRasterizer.test.ts (new): pass
  - p-touch.browser.test.ts: pass. The bare vitest run executed it here, but it is a browser test, so treat it as unrun for the GUI node.
- `npm run checks:gate`: pass ("all 32 passed"). It failed on typecheck in the first run; I fixed those errors and the rerun passed.
- `npm run check:changesets`: pass.
- `npm run lint -w packages/p-touch` and `-w packages/core`: not run. Neither package has a `lint` script ("Missing script"). eslint on every changed file: pass.
- Tree clean apart from `.skulkr/`.

tally: 8 of 8 fixed, 0 extra fixed