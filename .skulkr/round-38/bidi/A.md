## `bidiClassOf`'s docstring misstates what unassigned code points resolve to
- where: packages/bidi/src/tables.ts:159 (bidiClassOf docstring; emitted by packages/bidi/scripts/gen-bidi-tables.mjs)
- scenario: the docstring says unassigned code points resolve to "`R` or `AL` inside the right-to-left blocks and `L` elsewhere". The table is built from DerivedBidiClass.txt's `@missing` lines (as the CLASS_PACKED comment says), and those also default the Currency Symbols block's unassigned points (U+20A0..U+20CF, e.g. U+20C1) to `ET`, and noncharacters and default-ignorable points (e.g. U+FDD0, U+E0080) to `BN`. A caller who reads the doc expects `bidiClassOf(0x20C1) === 'L'` and gets `ET`; for `BN`, the character is dropped by X9 rather than treated as strong L. The code is right; the doc is wrong, and since the file is generated, the fix belongs in the generator's template.
- evidence: read (the docstring against DerivedBidiClass.txt's `@missing` defaults as I know them; I could not run `bidiClassOf` here to confirm the decoded values)
- severity: low

## Files read
packages/bidi/src/__fixtures__/parseConformance.ts
packages/bidi/src/explicit.ts
packages/bidi/src/implicit.ts
packages/bidi/src/index.ts
packages/bidi/src/paragraph.ts
packages/bidi/src/pbt.fixture.ts
packages/bidi/src/reorder.ts
packages/bidi/src/resolve.ts
packages/bidi/src/sequences.ts
packages/bidi/src/tables.ts
packages/bidi/src/types.ts

<!-- done: 1 findings, files read: 11 -->
