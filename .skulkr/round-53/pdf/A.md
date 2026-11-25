I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole findings document is below. It has three findings: one medium, two low.

# Audit round 53, area `pdf`

## writeSegment throws a TypeError on a synthetic-bold run with no fill and a stroke whose dash is non-finite
- where: packages/pdf/src/textSegment.ts:263 (writeSegment)
- scenario: a text run in a face drawn with synthetic bold (`syntheticBoldOffset` is non-null). The run has no fill ink and an inked stroke whose `dash` holds NaN or Infinity. `writeText` keeps the glyph because `strokeHasInk` is true, then `writeSegment` runs:
  - `fill` is undefined.
  - `rawStroke` is undefined, because a non-finite dash drops it, so `stroke` is undefined too.
  - `solidFill = !fill`, which is true.
  - `boldInText = bold && !stroke && solidFill && fillColor!.alpha >= 1` then reads `.alpha` of an undefined `fillColor` and throws a TypeError.

  That is not a `NonFiniteNumber`, so `writeOne` rethrows it and the whole `writePdf` rejects. The fix should make it draw nothing for the segment, as the non-bold path does (`if (!paintsFill && !strokeColor) return`). `docs/unruled.md` (2026-11-10) says the writer must refuse bad input "with its documented report, never a `TypeError`".
- evidence: read
- severity: medium

## A non-finite opacity draws an image, an isolated group or a raster fully opaque, but drops the command on a path
- where: packages/pdf/src/images.ts:156 (place); packages/pdf/src/groupOps.ts:157 (isolatedGroup)
- scenario: the alpha checks there are `p.opacity < 1` and `inner.alpha < 1`, and both are false for NaN. So these are written with no ExtGState and come out fully opaque, with no report:
  - an `image` command with `opacity: NaN`;
  - a sprite whose opacity slot is NaN;
  - an `isolate` group with `alpha: NaN`, whose children are written at alpha 1;
  - an effects/composite raster placed through `writeRaster` with a NaN alpha.

  The same NaN on a path fill, a stroke or a texture fill reaches `extGState` → `num`, which throws `NonFiniteNumber`, so that command is dropped and reported. A non-isolated group with NaN alpha therefore draws nothing, while the same group with `isolate: true` draws opaque. One non-finite input gets two different answers depending on the path it takes.
- evidence: read
- severity: low

## A texture pattern's memo key leaves out the texture's source, so a re-registered texture reuses the old pixels
- where: packages/pdf/src/images.ts:207 (texturePattern)
- scenario: the pattern cache key is `pattern ${paint.texture.id} ${matrix} ${colorMatrix}`, and the cache lasts for the whole document. The texture registry can replace an entry's `source` under the same id (`TextureEntry.size` exists for exactly this, a re-rasterized SVG). `writePdf` awaits between pages and inside them (the `rasterize` hook, font loading), so a texture re-registered during an export is still drawn with the first image XObject on every later fill at the same matrix. `imageXObject` itself keys on `idOf(source)` and would have picked up the new bitmap, but the pattern lookup returns before it is consulted. The key should include the source's identity.
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

`git log` was also blocked, so I couldn't single out last week's changes and read every file to the same depth instead.

<!-- done: 3 findings, files read: 28 -->