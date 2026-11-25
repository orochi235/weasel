Boolean result keeps its source's generator, geometry-bound data, and per-anchor arrays (A+B): fixed 00170ab0c6

`insert` dep's `build` drops a factory's `batch` and `inserted` hooks (A): fixed 3433b2f716. `build` now returns `{ id, ops, batch?, inserted? }` (a `minor` changeset), and the pen's join honors both.

Weasel paste that makes nothing lets kit:svg paste the copy's SVG flavor as an image (B): fixed bf82c8b4f5. The copy is now claimed before parsing, but only on a canvas whose clipboard can paste weasel copies. An existing svgHandler test keeps an unwired canvas falling back to the SVG flavor, and that still holds.

Counting strokes changes whether an outline that inks nothing is an operand (B): fixed bcc6f58c57

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/core`, `-w @weasel-js/editing` and `-w @weasel-js/path-tools`: fail, `Missing script: "lint"`. None of these packages has a lint script. The gate's root `npm run lint` passed, and eslint on every changed file passed (exit 0).
- `packages/editing/src/deps/booleans.test.tsx`: pass (5 passed)
- `packages/editing/src/deps/insert.test.tsx`: pass (11 passed)
- `packages/path-tools/src/pen/usePenTool.join.test.tsx`: pass (16 passed)
- `packages/editing/src/ingest/weaselJsonHandler.test.ts`: pass (26 passed)
- `packages/editing/src/booleans/booleans.test.ts`: pass (21 passed)
- `packages/editing/src/ingest/svgHandler.test.ts`, `packages/editing/src/ingest/weaselJsonHandler.pbt.test.ts`, `packages/editing/src/booleans/booleans.strokes.test.ts`, `packages/editing/src/booleans/booleans.pieces.test.ts`: pass (18, 8, 11, and 5 passed)

tally: 4 of 4 fixed, 0 extra fixed