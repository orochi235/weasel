FDArray Private unchecked (A+B): fixed 7fc86ef100

CFF/cmap checks skipped for WOFF input (A, part a): fixed 87081e1d8d. A WOFF face is now unpacked to the sfnt it wraps before anything reads it.

CFF check runs only under an `OTTO` signature (A, part b): fixed 18e311f70f. The check now runs whenever opentype.js will read `CFF `, meaning the font has no glyf+loca pair.

WOFF face loses kerning behind a GPOS Extension lookup (A): fixed 87081e1d8d. Same fix as the WOFF checks; the WOFF face now kerns exactly as the TTF does. The same change also gives a WOFF face an embedding, so `fontEmbedding` no longer answers null for it. The existing test that expected null now expects the unpacked sfnt.

gposPairKerning memo unbounded (A+B): fixed 681fe8119e. The memo now clears once it holds 4096 pairs.

loadFontOutlines / fontEmbedding report a replaced registration (A+B): fixed 9e72283973. `loadFontOutlines` now waits on whatever registration holds the variant when the load settles, and answers null if the face was dropped. `domFace.test.ts` and the `outlineRegistry.pbt` model were updated to this behavior.

Local variable font registers default outlines under every named instance (B): fixed 52ae7aacab. The parser now rejects a font with `fvar` when the PostScript name asked for is not its nameID 6, the default instance's. This was a behavior call I made myself; it is recorded in `docs/unruled.md`.

Thunk or Blob source read twice when DOM text asks first (B): fixed 7e75fe9983. The read is shared through the slot, dropped once the load settles, and dropped on failure so a later call can retry.

`kern` lookups summed across scripts (B): fixed 7947c1e4e3. A pair now takes one LangSys's lookups: `latn`, then `DFLT`, then the rest, using the first whose lookups cover the pair. This was also my call, recorded in `docs/unruled.md`, though the entry landed in commit 52ae7aacab rather than this one. Inter's kerning is unchanged: 0 of 4141 kerned pairs differ.

Extra: `outlineRegistry.ts` grew to 413 lines, past `check:size`'s 400-line cap. Moved `closeContours` into a module of its own in db96969b67; this was not a defect.

Checks:
- Every touched test file, run one at a time with `--maxWorkers=1`: all outline/*.test.ts files, plus domFace, resolveGlyph and registerFont: pass. outlineRegistry.pbt failed under the old model; it passes after the model update, three reruns.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run had failed only on check:size, before the split.
- `npm run check:changesets`: pass ("OK — 2238 changeset(s)").
- `npm run lint -w packages/font`: not run, because the package has no lint script ("Missing script: \"lint\""). I ran eslint on every changed .ts file instead: pass (exit 0).
- No browser tests were touched.

tally: 11 of 11 fixed, 0 extra fixed