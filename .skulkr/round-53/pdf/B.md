**I could not write `.skulk/out/findings.md` because permission was denied, so the whole document is below.** I read all 28 listed files end to end and made no edits.

# Audit round 53, area `pdf`: findings

## A solid stroke on a path with no commands writes `S` with no current path
- where: packages/pdf/src/strokeOps.ts:68 (writeNative)
- scenario: a `PathDrawCommand` has an empty polygon (`{ kind: 'polygon', commands: [], coords: [] }`, e.g. an empty polyline node), a native solid stroke (`{ paint: { color: '#000' }, width: 1 }`) and no `trim`.
  - With no trim, `trimmedPath` returns the path unchanged and `trimmedRuns` yields one run holding it.
  - `writeNative` writes `q`, `/GSn gs`, `RG` and the line style operators. `pathOps` then writes nothing, because the path has no contours, and `out.op('S')` paints with no path under construction.
  - That is invalid content. The package's own `pdfCheck.fixture.ts` rejects it ("paints no path"), and strict readers report the content stream as broken.
  - The fill side already guards this case with `fillsAnything` (pathOps.ts:63). The stroke side should skip a run whose path writes no operators, since the renderer draws nothing for it.
  - The property tests never reach this: `pbt.fixture.ts`'s `path()` always opens with an `M`.
- evidence: read (strokeOps.ts writeNative; pathOps.ts pathOps; stroke/src/trim/trimmedPath.ts trimmedPath and trimmedRuns)
- severity: medium

## One non-finite coordinate in any text of a `text-layer` drops every text in the layer
- where: packages/pdf/src/drawCommands.ts:130 (writeCommand)
- scenario: a `text-layer` command holds 500 labels, and one has `x: NaN` (or a run whose layout yields a non-finite position).
  - The layer is written as `for (const text of cmd.texts) await writeText(...)`, all inside the one `writeOne` that wraps the layer command.
  - That label's `Tm` operand makes `num` throw `NonFiniteNumber`. `writeOne` then rolls the content stream back to before the layer, so the other 499 labels vanish too.
  - The only report is one `text-layer has a non-finite coordinate`.
  - Sent as 500 separate `text` commands, only the bad one would be dropped. Writing the texts through `writeCommands(ctx, cmd.texts, state)` would give each text its own rollback point.
  - This was added in f3a12322ad (2026-11-18).
- evidence: read (the claim that the renderer still draws the other labels is inferred, not run)
- severity: medium

## Once a face's spare codes run out, a glyph's second reading silently takes its first reading's code
- where: packages/pdf/src/fonts/embedFont.ts:90 (Face.useGlyph)
- scenario: `spare` starts at the face's glyph count. A face with 65535 glyphs, as large CJK faces such as Noto Sans CJK have, gets one spare code (0xFFFF) and then none.
  - After that, every new reading of a glyph that already has a code falls back to `code = gid`. That code's `/ToUnicode` text and `/W` width belong to the first reading.
  - Copying text breaks: a glyph shared by two code points (a Kangxi radical and its unified ideograph map to one glyph in most CJK faces), or one drawn once with text and once reading as `''`, copies out as the first code point's text.
  - Placement breaks too. `settle` (textSegment.ts:156) asks `useGlyph(gid, '', 0)` for an off-page code that moves the pen nowhere, but gets one that advances the glyph's full width. `TJ [kern <code> -kern]` then moves the pen by that width without updating `pen`, so every later glyph in the text object lands one glyph-width off.
  - Nothing is reported in `skipped`.
- evidence: read
- severity: low

## Files read
packages/pdf/src/color.ts
packages/pdf/src/content.ts
packages/pdf/src/deflate.ts
packages/pdf/src/drawCommands.ts
packages/pdf/src/export.ts
packages/pdf/src/fonts/embedFont.ts
packages/pdf/src/fonts/fontSource.ts
packages/pdf/src/fonts/subset.ts
packages/pdf/src/fonts/toUnicode.ts
packages/pdf/src/groupOps.ts
packages/pdf/src/images.ts
packages/pdf/src/index.ts
packages/pdf/src/latin1.ts
packages/pdf/src/num.ts
packages/pdf/src/objects.ts
packages/pdf/src/pathOps.ts
packages/pdf/src/pbt.fixture.ts
packages/pdf/src/pdfCheck.fixture.ts
packages/pdf/src/pdfReader.fixture.ts
packages/pdf/src/regionsPdf.ts
packages/pdf/src/resources.ts
packages/pdf/src/shading.ts
packages/pdf/src/strokeOps.ts
packages/pdf/src/testing/noFonts.ts
packages/pdf/src/textOps.ts
packages/pdf/src/textOutlines.ts
packages/pdf/src/textSegment.ts
packages/pdf/src/writePdf.ts

<!-- done: 3 findings, files read: 28 -->