# text

Text as a first-class scene citizen: styled runs, measurement, layout, GL
rendering, and in-place editing.

The largest feature module in the kit. This file is a map, not a tour.

## Runs are the data model

Text isn't a string with one style — it's a sequence of **`StyledRun`s**. The
conversions in `runs.ts` are the boundary with everything else:

| Function | Direction |
| --- | --- |
| `toRuns` | anything → runs |
| `runsToPlainText` | runs → plain text (clipboard, search) |
| `runsToMarkdown` / `markdownToRuns` | runs ⇄ markdown |

`runs/resolveRuns.ts` resolves inherited style down each run.
`textStyle.ts` owns `DEFAULT_TEXT_STYLE`, `resolveTextStyle`, and
`fontString`.

## The rendering path, and its one hard requirement

`createTextLayer` emits **one `TextDrawCommand` per text node**, carrying
resolved runs and a bounding rect. Word wrap and multi-line layout happen
*downstream* in `drawText` / `layoutRuns`, not in the layer.

> **The GL renderer uses MSDF text.** Font registration lives in
> `@weasel-js/font` (`registerFont(family, variant, metricsUrl, atlasUrl)`,
> re-exported from `@weasel-js/core/renderer`). An unregistered family now
> renders in the default family with a one-time warning; call
> `setFontFallbackPolicy('none')` to restore the old hard-miss behavior.

Related: never mipmap the GL texture cache for MSDF atlases — mipmapping
destroys the distance field.

## Measurement

`measureText` (advance/metrics) and `measureTextBounds` (ink bounds) are
distinct; `fitTextPose.ts` and `verticalAlign.ts` build on them for
fit-to-box and baseline placement.

## Subdirectories

| Dir | Role |
| --- | --- |
| `atlas/` | `layoutRuns` — the runs-aware glyph layout, and the only glyph walk in the kit. The atlas itself (`FontAtlas`, `registerFont`) and runtime rasterization live in `@weasel-js/font`. |
| `runs/` | Run resolution. |

## Editing

`useTextEdit` is the primitive; `useSceneTextEdit` is the scene-wired version.
`domRuns.ts` bridges to a DOM editing surface (contenteditable) — text editing
uses real DOM for IME, spellcheck, and accessibility rather than reimplementing
a caret on canvas. `hitTest.ts` provides `pointInTextPose` and `caretIndexAt`
to map clicks back into the run model.

## Odds and ends

- `markdownText.ts` — `createMarkdownRenderer` / `layoutMarkdown`, the richer
  layout path (`PositionedRun`, `LayoutLine`, `LayoutResult`).
- `renderLabel.ts` — the small pill-with-text used for chrome labels, with a
  pluggable `TextRenderer`. Unrelated to scene text nodes.
- `textCommand.ts` — the draw-command shape.
