Fixed: cssFontFamily quoting (A) facdb8c2a3 | …

tally line format per brief. Report:

- Within-family chain misses a family whose faces are all far from the request, e.g. only a 300, only a 700, or only an italic face (A+B) — fixed 9cedc2b4eb
- An outline-only default family is never substituted (A) — fixed b8e9b972c0
- `cssFontFamily` returns the family unquoted when the DOM uses it as it stands (A) — fixed facdb8c2a3
- Resolving a canvas font with no canvas throws (A) — fixed 70121e6edc
- Under `'none'`, a `registerCanvasFont` family gets no per-code-point escalation, and the warning says to call `registerCanvasFont` (A) — fixed ff563ac060
- Text lays out in a landed stand-in while the variant the chain would pick is still fetching (A) — fixed ce187b68ee
- `warmFonts(['Brand'])` resolves when that family's loads have already failed (A) — fixed 3b1b40f06a
- `warmFonts` with a `FontRequest` doesn't warm the substitute for a registered family whose chain finds no face (A) — fixed 9cedc2b4eb (the chain now always lands within a family that has a face) and ce187b68ee (`variantLoads` follows the resolver's pick and falls through to the substitute for a family with no landed face)
- Font picker lists a lazy variant at once but an eager one only after it lands (A) — fixed 3885a95f05
- A replaced or superseded atlas `ImageBitmap` is never closed (A) — fixed ad95a163c0
- Resolving a landed face wakes every other lazily declared variant of its family (B) — fixed ce187b68ee
- A multi-page BMFont atlas draws its page-1+ glyphs from page 0's image (B) — fixed 8001cff189. The fix refuses such an atlas, naming the glyph. That is a strict call, recorded in `docs/unruled.md`: whether the registry should take one URL per page is open.
- Chain serves nothing for an italic-only family, or one whose only faces are in the other weight bucket (B) — duplicate of the first finding, fixed 9cedc2b4eb
- `warmFonts` does not warm the substitute a registered family falls back to (B) — duplicate of the `FontRequest` finding, fixed 9cedc2b4eb + ce187b68ee
- A canvas glyph that found no room right after an emptying stays invisible until a new glyph is asked for (B) — fixed 99908f1b90. Asking for it again once the pages settle bakes it again. That retry happens at most once until the text changes, so text needing more than the pages hold doesn't empty them every frame.
- The dynamic tier keeps one face per (family, weight, style) forever (B) — fixed a66f29194d (cap of 256, oldest dropped as `unregisterCanvasFont` drops one)
- A family name with an apostrophe is written raw into the canvas `font` and the DOM `font-family` (B) — fixed 36aa4e0eff
- The dynamic tier's test resets leave a reclaim timer and per-cache upload progress behind (B) — fixed 3efd3d1362

Changes in behavior that the fixes above brought with them:
- The extended chain ranks below the outline tier and explicit `registerCanvasFont`, so those still serve a request first.
- The "has no variant matching" substitute warning is now reachable only for a family that is registered but has nothing loaded. It now says "none of its atlas faces loaded" (9cedc2b4eb).
- `fallback.test.ts` had three tests built on the old dead end; they now use a family whose registration failed.

Checks:
- Test files, each run alone with `--maxWorkers=1`:
  - `packages/font/src/domFace.test.ts` pass
  - `packages/font/src/cssFamily.test.ts` pass
  - `packages/font/src/cssFamily.pbt.test.ts` pass
  - `packages/font/src/cssFamily.shrunk.test.ts` pass
  - `packages/font/src/registerFont.test.ts` pass
  - `packages/font/src/registerFont.pbt.test.ts` pass
  - `packages/font/src/registerFont.shrunk.test.ts` pass
  - `packages/font/src/fallback.test.ts` pass
  - `packages/font/src/resolveGlyph.test.ts` pass
  - `packages/font/src/resolveGlyph.pbt.test.ts` pass
  - `packages/font/src/cachedFontVariant.test.ts` pass
  - `packages/font/src/variantKey.pbt.test.ts` pass
  - `packages/font/src/FontAtlas.test.ts` pass
  - `packages/font/src/FontAtlas.pbt.test.ts` pass
  - `packages/font/src/FontAtlas.shrunk.test.ts` pass
  - `packages/font/src/dynamic/dynamicAtlas.test.ts` pass
  - `packages/font/src/dynamic/dynamicAtlas.pbt.test.ts` pass
  - `packages/font/src/dynamic/sharpColor.test.ts` pass
  - `packages/font/src/dynamic/colorGlyphs.test.ts` pass
  - `packages/font/src/dynamic/lateFace.test.ts` pass
  - `packages/text-dom/src/domRuns.face.test.ts` pass
  - `packages/text-dom/src/pasteRuns.test.ts` pass
  - `packages/text-dom/src/useTextEdit.rangeStyle.test.ts` pass
  - `packages/text-dom/src/domRuns.smcp.test.ts` pass
  - `packages/text-dom/src/useTextEdit.pbt.test.ts` pass
  - `packages/diagram/src/rowMeasure.pbt.test.ts` pass
  - `packages/hud/src/fonts/registerDefaultFont.test.ts` pass
  - `packages/hud/src/attach.test.ts` pass
  - `packages/ui/src/components/FontOptions/fontFamilyOptions.test.tsx` pass
- No `*.browser.test.*` file touched.
- `npm run checks:gate`: all 32 passed. That includes root `npm run typecheck`, `typecheck:packages`, `check:size`, `check:changesets`, and root `npm run lint`.
- `npm run lint -w @weasel-js/font`: unrun. This machine's hook refused it as a suite-sized script and said to send it to the fleet, which this brief forbids. ESLint on every changed file passed.
- Tree clean; `.skulk/` untouched.

tally: 18 of 18 fixed, 0 extra fixed