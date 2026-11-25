[A+B] WOFF table inflation has no bound until the stream ends: fixed 8bcf7a6fcf

[A] the warn-once key is the variant, so a face registered again and failing again warns nothing: fixed 856da9fb37

[A] a DOM-first read of a Blob or thunk source stays pinned when no load ever runs: not a defect. Holding the read is deliberate: commit 39422f9fe7 shares a DOM-first read with a later canvas load, and the test "reads a thunk source once when DOM text asks for the bytes before the canvas does" pins that behavior. The field's doc was wrong, though, and I corrected it in 6c6f4a7982 to say the read is held until the load settles.

[A] GPOS lookup index not checked against the LookupList's count, nor a coverage index against the pair set count: fixed 418da12f99

[A] `.dfont` reference count of 0xffff read as 65536 while the type count reads it as empty: fixed 826de234c3. No changeset: the input is damaged either way, and the face still fails to load.

[A+B] the `local()` name is quoted with JSON.stringify rather than `cssString`: fixed 36c6467fcd

[B] `embeddable` refuses a font whose fsType sets Restricted beside a looser bit: fixed e0fdb23de5. The least restrictive bit wins only for OS/2 versions 0–2, as the spec says. From version 3 the bits are exclusive, so I made the strict call: a font setting Restricted with another bit still reads as not embeddable. A test pins this; I did not add a `docs/unruled.md` entry.

[B] a GPOS `kern` feature with no readable pair lookup hides the legacy `kern` table: fixed bbce5c01a7

[B] the per-face glyph memo has no bound: fixed 09d22c0620. It now holds at most 8192 glyphs and drops its oldest entry when full.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each file below, one at a time, all pass:
  - woff.test.ts (7)
  - gposKerning.test.ts (8)
  - gposKerning.pbt.test.ts (4)
  - fontEmbedding.test.ts (9)
  - localFonts.test.ts (15)
  - dataFork.test.ts (8)
  - outlineRegistry.test.ts (29)
  - opentypeParser.test.ts (11)
  - opentypeParser.pbt.test.ts (4)
  - kernTable.pbt.test.ts (2)
- Each new test was run against the code before its fix and failed there.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed on a type error in my woff test; I fixed it and folded the fix into 8bcf7a6fcf.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/font`: fail, "Missing script: lint", because the package has none. `eslint packages/font/src/outline` passes with exit 0.
- Tree is clean.

tally: 9 of 11 fixed, 0 extra fixed