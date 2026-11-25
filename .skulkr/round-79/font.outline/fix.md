- A `.dfont` map naming one `sfnt` resource many times leads to billions of slices (A): fixed 772518fe88
- A `.ttc` member repeating one table makes `extractFont` allocate the sum of every repeat (A): fixed ebd21fc3e2
- An empty `postscriptName` counts as no name for `cssSrc` but as a name for the parser (A): fixed 7cb7ae68a5
- A CFF table whose header says version 2 skipped every structural check (B): fixed 7e31bebd3f. opentype.js reads the CFF2 Top DICT, FDArray, Private, and Subrs offsets, so the string-offset hang could be reached. The CFF2 check, with refusal when CharStrings or FDArray is missing, is my call and is recorded in `docs/unruled.md`.
- `advanceOf` and `advanceOfGlyph` let a charstring parse error throw into layout (B): fixed d8df12c986. In opentype.js 2.0 a CFF2 `blend` with no `vstore` is a confirmed throw path; the self-calling subroutine the reviewer named is capped by its depth limit.

The `.ttc` and `.dfont` refusals of overlapping tables or resources are also my call, recorded in `docs/unruled.md`. A real font whose tables legitimately overlap would now be refused too.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `opentypeCff.test.ts` pass (1)
  - `opentypeParser.test.ts` pass (11)
  - `opentypeAdvance.test.ts` pass (1)
  - `localFonts.test.ts` pass (19)
  - `sfnt.test.ts` pass (14)
  - `sfntNames.test.ts` pass (5)
  - `sfnt.pbt.test.ts` pass (6)
  - `dataFork.test.ts` pass (10)
  - `cffCheck.test.ts` pass (11)
  - `cffCheck.shrunk.test.ts` pass (3)
  - `outlineRegistry.test.ts` pass (29)
- Each new test was seen failing against the pre-fix source.
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run check:changesets`: pass ("OK"). It printed three title-length warnings, all on other changesets, none of mine.
- `npm run lint -w @weasel-js/font`: not run. `@weasel-js/font` has no `lint` script, so npm errored "Missing script". The root `npm run lint` inside the gate passed.
- Tree clean apart from `.skulkr/`.

tally: 5 of 5 fixed, 0 extra fixed