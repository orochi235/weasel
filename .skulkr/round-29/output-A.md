# Audit 29 — reviewer A (drawing and output)

## A failed `replace` leaves the old atlas registered but its URLs unheld, so a later registration with any other URLs silently keeps the old atlas
- where: packages/font/src/registerFont.ts:184-185, 275-277 (registerFont / fetchVariant) with packages/font/src/heldFontUrls.ts:37 (releaseFontUrls)
- scenario: `registerFont('A', 400, m1, a1)` lands; `registerFont('A', 400, m2, a2, { replace: true })` fails (404). `fetchVariant`'s catch calls `releaseFontUrls`, which deletes the variant's held URL pair, while `registry` still holds the m1/a1 atlas. Now `registerFont('A', 400, m3, a3)` (no `replace`): `claimFontUrls` sees no held pair, records m3/a3 and returns false; `registry.get('A').has(key)` is true, so it returns `Promise.resolve()` and never fetches. The caller is told m3/a3 is usable, the held table says m3/a3, and the face drawn is still m1/a1. Should either restore the m1/a1 hold on a failed replace, or fetch/throw when the held URLs differ from what the registry entry came from.
- evidence: read
- severity: medium

## A paint-kind loader declared over one that already started never runs: `LOADS` keeps the first load per id forever
- where: packages/renderer/src/paintKinds.ts:213-232 (startLoad), 207-209 (registerPaintDrawKindLoader)
- scenario: Loaders now stack (e30b99badb), and the doc says "Declaring a second loader for an id overrides the first". But `startLoad` caches one promise per id in `LOADS` and never clears it: once any frame has looked up the kind under loader L1 (still pending, or failed — a failure is kept on purpose), a later `registerPaintDrawKindLoader(id, L2)` (or paint-kinds' `registerPaintKindLoader`) is never called; `getPaintDrawKind`/`warmPaintKinds` keep returning L1's promise. Disposing L1 does not clear it either, so a consumer replacing a broken or stale loader gets the old failure or the old kind. The cache should be keyed by the loader (or dropped when the loader it ran is displaced/disposed).
- evidence: read
- severity: medium

## The lazy `mesh-gradient` built-in's loader is pushed without `fallback`, so a consumer's own loader for it draws a dev clash warning
- where: packages/paint-kinds/src/paintKinds.ts:133-136 (seed) and 165-171 (registerPaintKindLoader); packages/renderer/src/paintKinds.ts:207-209
- scenario: `seed()` calls `registerPaintKindLoader('mesh-gradient', load, { fallback: true })`, but `registerPaintKindLoader` forwards `options` only to the eventual `registerPaintKind`; `registerPaintDrawKindLoader` takes no options and pushes the wrapper into `LOADERS` as a non-fallback registrant. A consumer calling `registerPaintKindLoader('mesh-gradient', mine)` pushes a different function at the same rank over a non-fallback, so `reflectable.ts:240` warns of a clash in development — the warning e0f4c91b27 ("mark every engine built-in pushed to a registry as a fallback") meant to remove. The option is silently dropped on the loader path.
- evidence: read
- severity: low

## `exportRegions` warns about an option whose value is `undefined`, which `pickExportOptions` treats as not given
- where: packages/export/src/exportFormats.ts:85-96 (warnUnreadOptions) vs 99-107 (pickExportOptions)
- scenario: A caller building options generically, e.g. `exportRegions(scene, r, 'svg', { background, scale: opts.scale })` with `scale` undefined (or a UI spreading one options object across formats with unset fields), gets `the "svg" format does not read the option "scale"` in development, although the value is `undefined` and nothing was dropped. `pickExportOptions` (and the PNG format's own copying) skip undefined keys, so the two halves of the same change answer "was this option given?" differently. `warnUnreadOptions` should skip keys whose value is `undefined`.
- evidence: read
- severity: low

## A non-finite text command rolled back by `writeOne` erases the face's embed-failure skip for the whole document
- where: packages/pdf/src/drawCommands.ts:160-176 (writeOne) with packages/pdf/src/fonts/embedFont.ts:200-224 (DocumentFonts.face/load)
- scenario: The first text command set in face F has a non-finite `x`/`y` (or any number `num` refuses inside `writeSegment`). `writeText` awaits `ctx.fonts.face(F)`, whose load fails and pushes a `{ kind: 'font' }` skip (5db4fbd607); then `num` throws `NonFiniteNumber`, and `writeOne`'s catch does `ctx.skipped.length = skips`, removing that skip. `DocumentFonts` caches the `null` promise per face, so every later text in F draws as outlines with no skip recorded: the export never reports that F failed to embed, and a `strict` export writes the file. The rollback should keep skips that belong to document-wide state (font loads), or the font skip should be recorded where it is consumed rather than once at load.
- evidence: read
- severity: low

<!-- done: 5 findings, files read: 34 -->
