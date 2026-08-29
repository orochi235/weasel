# text

Text as a first-class scene citizen: draw commands, picking, and in-place
editing. This file is a map, not a tour.

**Typography lives in `@weasel-js/text`** — the run model, style resolution,
`layoutRuns`, wrap and measurement all moved there so a consumer can lay out
text without the scene graph. What stays here is what needs a scene, a
renderer or React. The two halves are described together below, because the
editing surface is unreadable without the model it edits.

## Runs are the data model

Text isn't a string with one style — it's a sequence of **`StyledRun`s**. The
conversions in `runs.ts` are the boundary with everything else:

| Function | Direction |
| --- | --- |
| `toRuns` | anything → runs |
| `runsToPlainText` | runs → plain text (clipboard, search) |
| `runsToMarkdown` / `markdownToRuns` | runs ⇄ an inline grammar, `MARKDOWN_RUN_GRAMMAR` by default |

`runs.ts`, `runs/resolveRuns.ts` and `textStyle.ts` — the conversions above,
plus `resolveRuns` and `DEFAULT_TEXT_STYLE` / `resolveTextStyle` /
`fontString` — are in `@weasel-js/text`, and re-exported from
`@weasel-js/core` unchanged.

`runs/rangeStyle.ts` stays here — it is the **public run algebra**: `styleAtRange` reports
what a character range shares (`MIXED` where the runs disagree),
`applyStyleToRange` patches one, splitting and re-coalescing around it. A
caret addresses a range, not a path, which is why this is a separate surface
from the schema-driven property panel.

> **Run-level flags are additive over the node's `TextStyle`.** A run turns
> `bold` / `italic` / `underline` / `strikethrough` on, never off — setting
> one to `false` deletes the key, and resolution reads `run.flag ||
> style.flag`. See that file's header for why, and `docs/TODO.md` for the two
> ways out if it needs to change.

`letterSpacing` is **world units**, applied after every glyph including the
last (CSS semantics), per code point rather than per grapheme cluster. Note
that `letter-spacing` is not part of the CSS `font` shorthand — every
`ctx.font = fontString(style)` / `el.style.font = …` site needs its own
assignment, which is what `measuredWidth` exists to keep consistent.

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
fit-to-box and baseline placement. Every 2D-side width goes through
`measuredWidth`, which adds tracking the way `layoutRuns` does — the two
paths have to agree on where a line breaks or `caretIndexAt` maps a click to
the wrong line.

`lineBoxes.ts` answers the other measurement question: not how big is the
text, but **where inside its box does it sit**. A text pose is a *wrap box* —
`"Away"` in a 600-unit box leaves most of the box empty — so anything treating
the pose as the node's extent claims empty space. `textLineBoxes` returns the
per-line rects, read straight off `layoutRuns`'s own line walk rather than
re-measured, and honoring `align` and `verticalAlign`. The `kit:text`
silhouette is built from it, which is how shape-accurate picking stops a text
box from swallowing clicks on whatever is behind it.

> **`TextDrawCommand.y` is the top of the first line box, not a baseline.**
> `layoutRuns` walks down from it by `common.base * scale`, and
> `verticalAlign` aligns the block within `[y, y + height]`. Passing a
> baseline there — the canvas-2D `fillText` convention — puts the text about
> an em too low and hands `verticalAlign` the wrong box.

## Subdirectories

| Dir | Role |
| --- | --- |
| `runs/` | `rangeStyle` / `flagRange` — the caret-range patch algebra, which serves the editor. |

`layoutRuns` — the runs-aware glyph layout, and the only glyph walk in the
kit — is `@weasel-js/text`'s `layout/`. The atlas itself (`FontAtlas`,
`registerFont`) and runtime rasterization are in `@weasel-js/font`.

## Editing

`useTextEdit` is the primitive; `useSceneTextEdit` is the scene-wired version.
`domRuns.ts` bridges to a DOM editing surface (contenteditable) — text editing
uses real DOM for IME, spellcheck, and accessibility rather than reimplementing
a caret on canvas. `hitTest.ts` provides `pointInTextPose` and `caretIndexAt`
to map clicks back into the run model.

Two things a consumer building character controls needs:

- **`isEditorChrome`.** Focus moving into a control that styles the text must
  not commit the edit. Without it, clicking the bar is what destroys the
  caret it was about to act on.
- **`selection` / `rangeStyle` / `applyStyleToSelection`.** The published
  range survives focus leaving the overlay (it clears on `startEdit` and when
  the edit ends), so a control can read and patch the range it is pointed at
  even while it holds focus itself.

Set `TextEditScreenPose.zoom` on a canvas that pans or zooms: the overlay is
then CSS-scaled and every metric on it stays in world units, which is the
only arrangement in which run-level `fontSize` / `letterSpacing` are right at
a zoom other than 1.

## Odds and ends

- `markdownText.ts` (in `@weasel-js/text`) — `createMarkdownRenderer` /
  `layoutMarkdown`, the richer layout path (`PositionedRun`, `LayoutLine`,
  `LayoutResult`).
- `renderLabel.ts` — the small pill-with-text used for chrome labels, with a
  pluggable `TextRenderer`. Unrelated to scene text nodes.
- `textCommand.ts` — the draw-command shape. `textCommandFromRuns` is the
  one builder; `createTextLayer` and the `kit:text` node painter both go
  through it so they can't derive `align` or run resolution differently.
