## `clockSpecOf` sanitizes duration, start and rate but passes `loop` through unchecked, so a CSF timeline with a non-boolean `loop` builds a clock with a NaN span
- where: packages/forge/src/timeline/clockSpec.ts:17 (clockSpecOf)
- scenario: a CSF story sets `parameters.forge.timeline = { duration: 3000, loop: 'once' }` (CSF parameters are untyped; `isSpec` in declare.ts checks only `duration`). `clockSpecOf` hands `loop: 'once'` to `createClock`; `checkLoop` rejects only a NaN number, and `passesOf('once')` is `Math.max(1, 'once')` = NaN, so `span` is NaN: `ended` never reads true, a play past the end never stops, and clamped seeks yield NaN and throw `RangeError` from `seek`. The sibling fields are normalized precisely so "a timeline can never throw"; `loop` should be too (anything but a boolean, or a positive pass count, falls back to the default `true`). `keyOf` in StoryClock.tsx keys the raw value, so it would follow the same normalization.
- evidence: read (packages/clock/src/validate.ts:34, packages/clock/src/place.ts:24, packages/clock/src/clock.ts:268)
- severity: low
- fix: packages/forge/src/timeline/clockSpec.ts, packages/forge/src/timeline/StoryClock.tsx
- size: line
- cause: unvalidated field from untyped parameters
- confidence: likely

## The test harness reads the playhead URL param by the literal `t` instead of `PLAYHEAD_PARAM`
- where: packages/forge/src/timeline/workshopHarness.tsx:99 (tParam)
- scenario: `PLAYHEAD_PARAM` (packages/forge/src/route/url.ts:15) names the param the code writes; `tParam` hard-codes `'t'`. Renaming the constant leaves every workshop test reading a param nobody writes, so tests asserting `tParam() === null` keep passing while the URL holds the playhead under the new name. One decision answered in two places.
- evidence: read
- severity: low
- size: line
- cause: duplicated constant
- confidence: sure

## Files read
packages/forge/src/timeline/Playhead.stories.tsx
packages/forge/src/timeline/RoutePlayhead.tsx
packages/forge/src/timeline/StoryClock.tsx
packages/forge/src/timeline/clockSpec.ts
packages/forge/src/timeline/context.ts
packages/forge/src/timeline/declare.ts
packages/forge/src/timeline/moves.ts
packages/forge/src/timeline/playheadUrl.ts
packages/forge/src/timeline/shown.ts
packages/forge/src/timeline/transport.css
packages/forge/src/timeline/types.ts
packages/forge/src/timeline/workshopHarness.tsx

<!-- done: 2 findings, files read: 12 -->
