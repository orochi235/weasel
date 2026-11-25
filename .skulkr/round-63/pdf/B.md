I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so here is the whole document:

# Audit round 63, area `pdf`: blind reviewer findings

Note: the brief names frozen commit 1b4edb3a93db1759496d564da57eb13020b3d7d2, but that commit isn't in this clone (`git cat-file` reports a bad object). I read the tree at HEAD 6f634fabe1, which has no local changes under `packages/pdf`.

## A dropped text command's language still decides the catalog's `/Lang`
- where: packages/pdf/src/textOps.ts:141 (writeText), read by packages/pdf/src/writePdf.ts:142 (writePages)
- scenario: every text run in a document has `lang: 'de'`. One more text command has `lang: 'fr'` and a non-finite coordinate (for example `x: NaN`), and no `opts.lang` is given.
  - `writeText` calls `ctx.langs.add('fr')` before `writeSegment` writes the `Tm` that throws `NonFiniteNumber`.
  - `writeOne` then rolls back the content stream, the objects and the skips, but nothing removes `'fr'` from `ctx.langs`.
  - `langs` ends up as `{de, fr}`, so the catalog gets no `/Lang` even though all the text in the file is German.
  - Expected: `/Lang (de)`, the same as for this document without the dropped command.
  - It also works the other way: a dropped run with no `lang` adds `undefined`, which clears a language that every written run shares.
- evidence: read
- severity: low

## Alpha outside 0..1 reaches an ExtGState's `/ca` and `/CA` unclamped on some paths but not others
- where: packages/pdf/src/resources.ts:19 (PageResources.extGState); callers packages/pdf/src/drawCommands.ts:114 (writeFill), :96 (writeTextureFill), packages/pdf/src/strokeOps.ts:63 (writeNative), packages/pdf/src/textSegment.ts:280 (writeSegment)
- scenario: a solid fill with `opacity: 1.5`, a group with `alpha: 1.5`, or a negative opacity.
  - `writeFill` always calls `setAlpha`, which writes `/ca 1.5 /CA 1.5`. ISO 32000 limits both to 0..1, so the value is invalid and each viewer handles it its own way. `extGState` only checks that the value is finite.
  - The writer handles alpha above 1 in two different ways. `place` (images) and `writeShadedFill` skip the ExtGState when `alpha >= 1`, so those draw opaque. Solid fills, texture fills, native strokes and text write the invalid value.
  - Negative alpha gets through on every path, because `!(−0.5 >= 1)` is true.
  - Expected: alpha clamped to 0..1 in one place (`extGState`), so every path writes a valid value and they all agree.
- evidence: read. I didn't check whether the renderer clamps paint opacity before it reaches the writer.
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

<!-- done: 2 findings, files read: 28 -->