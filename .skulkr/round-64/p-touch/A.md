I couldn't write `.skulkr/out/findings.md` because the permission was declined, so here is the whole document.

# Audit round 64: p-touch (blind reviewer)

The frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 isn't in this clone. I read the checkout's HEAD, 6f634fabe1, and the line numbers below are against it. Running `git diff -- packages/p-touch` against HEAD shows no changes, but that doesn't prove HEAD matches the frozen commit.

## Under auto length, a polyline's stroke and caps can reach past the label's end unchecked, while a rect's are checked
- where: packages/p-touch/src/lbx/writeLbx.ts:113 (`withinLength`), with packages/p-touch/src/lbx/shapes.ts:94-101 (`lineObject`)
- scenario: `autoLength: true`, `length: 100`, and a polyline from (100, 5) to (100, 30) with a 6pt stroke and a round cap. A butt-capped one at x = 99 does the same.
  - `lineObject` sets `position` to the bounding box of the points alone (x = 100, width 0), so `withinLength` passes it.
  - It is written as a `draw:poly` whose ink reaches x = 103, and P-touch grows the label for it.
  - The 2026-11-20 ruling says anything reaching past either end is rasterized and cropped instead.
  - A rect gets this right: `rectObject` grows its frame by the stroke (`grow`), so the same edge drawn as a rect is rasterized.
  - The fix is to check the line against its points' box widened by half the stroke width (plus a round cap's reach), or to rasterize it.
- evidence: read
- severity: medium

## `sceneToLbx` accepts `flattenTolerancePx` and silently drops it
- where: packages/p-touch/src/lbx/sceneLbx.ts:17-20, 40-50 (`SceneToLbxArgs`, `sceneToLbx`)
- scenario: a caller passes `flattenTolerancePx: 0.05` for smoother curves.
  - `SceneToLbxArgs` omits only `sourceRect | scale | background | gl | createCanvas` from `RenderSceneToPixelsArgs`, so the option type-checks.
  - It reaches only `warmRender` and `planPixelRender`, and `planPixelRender`'s own type omits it.
  - Rasterized content goes through `commandRasterizer(session)`, whose `session.render` call (packages/core/src/canvas/commandRasterizer.ts:41-47) never carries a tolerance.
  - The rasterized parts are drawn at the default 0.25 instead. Either forward the option to the rasterizer or omit it from the type.
- evidence: read
- severity: low

## A skipped command is reported with its only child's kind, not its own
- where: packages/p-touch/src/lbx/writeLbx.ts:220, 235-237 (`settle`, `innermost`)
- scenario: no `rasterize` hook, and a group with `effects` (or a clip, or `isolate`) holding one path.
  - `collect` pushes the command wrapped by `placed()`.
  - `innermost` unwraps every single-child group: the wrappers `placed()` added, then the original group too.
  - `skipped` reports `{ kind: 'path' }` for a command that is a group.
  - `innermost` should unwrap only `placed()`'s wrappers, for example by keeping the original command in the `Item`.
- evidence: read
- severity: low

## `tapeForWidthMm` can't find the 3.5mm tape from the width a printer's status reply gives
- where: packages/p-touch/src/tape.ts:9-11, 21-22, 28-30 (`Tape.widthMm`, `TAPES`, `tapeForWidthMm`)
- scenario: a 3.5mm cassette is loaded and an app calls `tapeForWidthMm(status.mediaWidthMm)`.
  - `Tape.widthMm`'s doc says it is "what a printer's status reply and media lookup use", and `TAPES` sets it to 3.5.
  - The status reply's width (obwat's `mediaWidthMm`, brotherDriver.js:123) is a single integer byte, so it can't hold 3.5.
  - Brother's raster reference reports this cassette as 4, so the lookup returns undefined.
  - Either map the status value to the 3.5mm tape, or correct the doc.
- evidence: read for the code. The value 4 comes from Brother's raster command reference as I remember it, not from this tree.
- severity: low

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 4 findings, files read: 10 -->