# Audit round 64 — area `text` — blind reviewer findings

## The canvas markdown layout synthesizes small caps for a face that has its own, where the GL tier and the DOM overlay draw the face's `smcp` capitals
- where: packages/text/src/markdownText.ts:97 (segmentsOf)
- scenario: a run with `fontVariantCaps: 'small-caps'` in a family whose registered shaper reports `smcp`
  (`hasOwnSmallCaps(...) === true`). `resolveRuns` (runs/resolveRuns.ts:232) and text-dom's `domRuns.ts:178/307`
  ask `hasOwnSmallCaps` and draw the face's own small capitals at the run's size. `layoutCanvasRuns` never asks: it
  always uppercases the lowercase letters and sets them at `fontSize * smallCapsScale(face)`. The same run then draws
  different glyphs at different widths, and wraps differently, on the 2D canvas than on the GL tier. `smallCaps.ts:42-44`
  says "Every reader of small caps asks here", so the 2D canvas painter breaks that one-pathway rule. Canvas 2D can draw
  a face's own small caps (`ctx.fontVariantCaps = 'small-caps'`).
- evidence: read (markdownText.ts:106-117 against resolveRuns.ts:230-242 and smallCaps.ts:42-47)
- severity: low

## `markdownToRuns` reads an unpaired delimiter as a toggle, which deletes the character and styles the rest of the text
- where: packages/text/src/runs.ts:292-307 (markdownToRuns)
- scenario: `createMarkdownRenderer(ctx, '5 * 3 = 15', 13)`, or `markdownToRuns('5 * 3')`. The lone `*` matches the
  1-repeat italic marker, so it is consumed: the result is `[{text:'5 '}, {text:' 3 = 15', italic:true}]`. The
  asterisk disappears from the label, and everything after it turns italic, with no closing delimiter ever seen. The same
  thing happens to `a*b`, `2**10` (bold to the end) and a trailing `*`. A delimiter that never closes should stay
  literal text, as it does in every markdown reader, including the CommonMark flanking rules the subset is named after.
  `runsToMarkdown` escapes its own output, so round trips survive; plain strings handed to the markdown renderer
  do not.
- evidence: read
- severity: low

## A run grammar whose delimiter is a backslash is accepted, but the reader's escape handling eats it
- where: packages/text/src/runs/delimiterRuns.ts:11-24 (markersByDelimiter), packages/text/src/runs.ts:286 (markdownToRuns)
- scenario: grammar `{ markers: [{ delimiter: '\\', repeat: 1, flags: ['bold'] }] }` passes the
  one-UTF-16-unit check. `runsToMarkdown([{ text: '\\x', bold: true }], g)` writes `\` (the marker), then `\\` (the
  escaped backslash), then `x` and `\`. `markdownToRuns` reads the leading `\\` as an escaped backslash, because the
  escape test (runs.ts:286) runs before the marker lookup. The opening marker is lost, and the result reads back as plain
  `\` plus bold `x`, where the writer meant bold `\x`. The writer's read-back check (`readDelimiters`) never applies the
  escape rule, so it doesn't catch this. Either `markersByDelimiter` should reject `\`, or the reader and the check
  should agree.
- evidence: read (traced by hand)
- severity: low

## `registerPropertyFont` replaces `global.fetch` and `global.createImageBitmap` and never restores them
- where: packages/text/src/pbt.fixture.ts:131-139 (registerPropertyFont)
- scenario: a property test file calls `registerPropertyFont()`. From then on, every later test in that worker sees
  the stub: a `fetch` that answers every URL with the property atlas JSON or a `PNG` blob, and a `createImageBitmap`
  that is always 512×512. The fixture returns no teardown and never calls `vi.stubGlobal` / `vi.unstubAllGlobals`,
  so nothing undoes this. When the pool doesn't isolate files, or a later test in the same file expects a real or
  differently stubbed fetch, that test silently loads the wrong font data.
- evidence: read
- severity: low

## Files read
packages/text/src/bakeTextFit.ts
packages/text/src/fitBoxToText.ts
packages/text/src/glyphOutlines.ts
packages/text/src/glyphTurn.ts
packages/text/src/hitTest.ts
packages/text/src/index.ts
packages/text/src/isTextData.ts
packages/text/src/joiningRuns.ts
packages/text/src/joiningTypes.gen.ts
packages/text/src/markdownRenderer.ts
packages/text/src/markdownText.ts
packages/text/src/measure/graphemes.ts
packages/text/src/measure/lineBoxes.ts
packages/text/src/measure/measureText.ts
packages/text/src/measure/measureTextBounds.ts
packages/text/src/measure/verticalAlign.ts
packages/text/src/pbt.fixture.ts
packages/text/src/pose.ts
packages/text/src/renderLabel.ts
packages/text/src/runs.ts
packages/text/src/runs/codePointCuts.ts
packages/text/src/runs/delimiterRuns.ts
packages/text/src/runs/effectiveRangeStyle.ts
packages/text/src/runs/flagRange.ts
packages/text/src/runs/rangeStyle.ts
packages/text/src/runs/resolveRuns.ts
packages/text/src/runs/smallCaps.ts
packages/text/src/runs/textTransform.ts
packages/text/src/syntheticBold.ts
packages/text/src/syntheticItalic.ts
packages/text/src/test-seams.ts
packages/text/src/textClusters.ts
packages/text/src/textStyle.ts
packages/text/src/textToPath.ts
packages/text/src/visualGraphemes.ts

<!-- done: 4 findings, files read: 35 -->
