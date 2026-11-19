# Audit round 38 — `bidi`

## A long level run throws RangeError: `indices.push(...run.indices)` spreads the whole run as call arguments
- where: packages/bidi/src/sequences.ts:76 (buildSequences)
- scenario: `analyze` on one paragraph of ~150k+ code points at one level (a pasted single-line log or minified JSON, no paragraph separator; text's layout cuts only at separators, so the whole thing is one paragraph) → the first sequence's run has every index, and `Array.prototype.push(...arr)` passes each element as an argument, which V8 rejects past roughly 120k elements with `RangeError: Maximum call stack size exceeded`. `analyze` throws instead of returning levels. It should append in a loop (or `concat`), which has no argument limit.
- evidence: read (the limit is V8's argument-count limit for spread calls; not run here, since I could not run node in this tree)
- severity: medium

## Unmatched isolate initiators make analysis quadratic
- where: packages/bidi/src/sequences.ts:42-49 (buildSequences); packages/bidi/src/explicit.ts:91 (resolveExplicit, FSI); packages/bidi/src/paragraph.ts:24 (matchingPDI)
- scenario: a paragraph holding N isolate initiators with no PDIs (text pasted with N stray U+2066/U+2068, or a generated string) → `buildSequences` calls `matchingPDI` once per initiator, and each call scans to the paragraph's end, so O(N²) work. FSIs pay it again in `resolveExplicit`, where `paragraphLevelOf` hits the next FSI and calls `matchingPDI` a second time. At N = 50k that is over 10⁹ steps, so `analyze` stalls the main thread for seconds. One stack-based pass over the paragraph can pair every initiator with its PDI in O(n), and `resolveExplicit` and `buildSequences` could share it.
- evidence: read
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

<!-- done: 2 findings, files read: 11 -->
