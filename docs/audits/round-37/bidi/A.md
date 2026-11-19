# Audit round 37 — bidi

## `ReorderedLine.levels` is documented as indexed by original index, but is indexed relative to the line's start
- where: packages/bidi/src/reorder.ts:21-25 (`ReorderedLine.levels`), filled at :48-53 (`reorderLine`)
- scenario: `reorder(analysis, 10, 20)` returns `order` holding absolute indices (10..19) and `levels` as an
  `Int16Array(10)` written at `i - start`. The doc says "Level per original index over the line", so a caller pairing
  the two the obvious way, `levels[order[k]]`, reads `levels[10..19]`: `undefined` past the array, or the wrong
  character's level. Every in-repo caller that passes `start > 0` (text's `bidiLines.ts`) already indexes by line
  position, and the callers that index by `order[k]` (hud's `typedLine.ts`, text's `visualGraphemes.ts`) only pass
  `start = 0`, so the misreading shows up only for a new caller reordering a line other than the first. The doc
  should say "per line position (`index - start`)".
- evidence: read
- severity: low

## `reorder` accepts a range outside the analysis and returns indices of characters that do not exist
- where: packages/bidi/src/reorder.ts:48-53 (`reorderLine`), reached through packages/bidi/src/index.ts:43-49 (`reorder`)
- scenario: `reorder(analyze([0x61, 0x62]), 0, 4)` gives `removed[2]` and `removed[3]` as `undefined` (falsy), so 2 and 3
  are pushed into `kept`. `paraLevels[2]` is `undefined`, and the `Int16Array` stores it as 0, so `order` comes back
  `[0, 1, 2, 3]` with level 0 for two characters the paragraph does not have. A caller that is off by one at a line
  end gets phantom indices and no error. `start > end` instead throws a bare `RangeError: Invalid typed array length`
  from `new Int16Array(end - start)`. Neither case is checked. It should throw a documented error, or clamp, for a
  range outside `[0, analysis.levels.length]`.
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
