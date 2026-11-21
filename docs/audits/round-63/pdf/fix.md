A `{ px }` stroke under a one-axis stretch is too thick in one direction (A): fixed d7244f3493. The stroke is now drawn in the stroke's metric (a frame where lengths measure as on screen). That covers native strokes, outlined strokes, marker heads, and natively stroked text, which keeps its text matrix so the glyphs don't move. I added an optional `spaces` argument to `markerDrawCommands` in renderer, with its own `minor` `api` changeset. I also removed the README's "uses the mean scale" approximation.

Opacity outside 0..1 is written to `/ca` and `/CA` as given (A+B): fixed 669b40e34e. The value is clamped in `extGState`, so every caller writes the same valid value.

A text command dropped for a non-finite number still sets the document's `/Lang` (A+B): fixed 2cbf359c2d. `writeOne` now takes back the languages a rolled-back command added.

An isolated group's color matrix is applied to each child, not to the whole group (A): fixed 29ae621cf2. When the matrix reads or changes alpha and a `rasterize` hook is given, the group is rasterized. Without a hook it is still applied per child and reported in `skipped`; that replaces the old alpha-offset-only skip, and the README says so.

Language tags are compared case-sensitively in one place and not in the other (A): fixed d5cbc83472. `writePages` now compares lowercased tags and writes the first spelling.

A source rect reaching past the bitmap leaves that part blank (A): fixed 81fe02aa4c. `place` fills the part past each edge from the half pixel at that edge, which repeats the edge pixels. Images and sprites both go through it.

A paint's opacity is applied after the group color matrix instead of before (A): fixed 43fdd4e596. This covers solid paints, including strokes and text, and gradient stops. Texture fills and images were left alone: I checked the renderer, and it applies their opacity after the matrix (`patternFill`, and the image quad's `a_post`), so the PDF already matched.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/pdf/src/textLang.test.ts`: pass (7)
  - `drawCommands.test.ts`: pass (13)
  - `groupOps.test.ts`: pass (25)
  - `images.test.ts`: pass (19)
  - `strokeOps.test.ts`: pass (19)
  - `textOps.test.ts`: pass (24)
  - `packages/renderer/src/markerCommands.test.ts`: pass (13)
- Also run after the image change: `images.hold`, `images.shrunk`, `hostPixels.pbt`, `roundtrip.pbt`, and `resources.pbt`, all pass.
- Each new test was seen failing with the pre-fix source.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed one TS18048 in `textSegment.ts` and four changeset titles over 140 characters. Both were fixed and folded into their own commits.
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/pdf`: neither pdf nor renderer has a `lint` script. eslint on `packages/pdf/src` and `packages/renderer/src/markerCommands.ts` passes.
- A loop meant to run every pdf test file broke on an `ls` alias and hit its time limit without running anything. The other pdf test files were not run here.
- Unrun: `packages/pdf/src/regionsPdf.browser.test.ts` (browser only).

tally: 7 of 7 fixed, 0 extra fixed