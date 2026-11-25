Text after a paragraph separator resolved with the earlier paragraph as context (B) — fixed 2fc0630dec. A paragraph separator now ends its run of characters, and the start and end of a run never take their direction from the far side of one. I reproduced each of B's four cases with a test that failed before the fix: `a LF ! b` under rtl, alef LF `$1`, an NSM opening a paragraph, and a bracket pair spanning the separator.

`reorder` accepted a range outside the analysis and returned characters that don't exist (A) — fixed 8fd6b76d95. `reorder` and `reorderLine` now throw a documented `RangeError` unless `0 <= start <= end <= length` and both are integers. This was a strict call nobody had made, so it is recorded in `docs/unruled.md` with no override. The callers in text and hud already keep their ranges in bounds.

`ReorderedLine.levels` was documented as indexed by original index, but is indexed by line position (A) — fixed b01eb080a7. This one changes only documentation, so no test fails before it; the test that pins indexing by line position (`levels[i - start]`) went in with 8fd6b76d95.

No extra defects found while fixing.

Checks:
- `npx vitest run --maxWorkers=1 packages/bidi/src/sequences.test.ts`: pass (11/11)
- `npx vitest run --maxWorkers=1 packages/bidi/src/index.test.ts`: pass (11/11)
- `npx vitest run --maxWorkers=1 packages/bidi/src/reorder.test.ts`: pass (13/13)
- `npx vitest run --maxWorkers=1 packages/bidi/src/conformance.test.ts`: pass (4/4)
- text's `bidiIntegration`, `bidiLines`, `bidiMalformed`, `bidiRegistry` and `visualGraphemes` test files (callers of `reorder`): pass
- `npm run typecheck:packages -- bidi`: pass ("1/1 bidi ok")
- eslint on the six changed bidi files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1723 changeset(s)")
- Tree clean.