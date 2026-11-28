# Findings: forge.timeline

## A story's `seek` and the transport's seek answer "move the playhead to shown time t" two ways: the story's drops the run to its first pass
- where: packages/forge/src/timeline/shown.ts:9 (seekShown)
- scenario: a looping story clock has played into pass 4 (elapsed = 4·duration + x). The story calls `useTimeline().seek(t)`: `seekShown` seeks to `within` (0..duration), so `clock.pass` falls from 4 to 0 and `useClockFrame` listeners get `pass` 0. The transport's `seek` (labkit `transportControl.ts:107`) seeks to `passStart + within` and keeps pass 4, and its end goes to `(pass + 1)·duration`, 'end'. The same move from the story and from the scrub bar leaves the clock in different passes, so a position recorded afterward (`clockPosition`) differs too. One definition should serve both, presumably the transport's current-pass rule.
- evidence: read (shown.ts against labkit/src/clock/transportControl.ts seek; clock.ts seek/passAt)
- severity: low
- fix: packages/forge/src/timeline/shown.ts, packages/labkit/src/clock/transportControl.ts
- size: function
- cause: duplicated seek rule, first pass vs current pass
- confidence: likely

## A URL `t` that equals the shown time of a playing clock is dropped instead of pausing there
- where: packages/forge/src/timeline/RoutePlayhead.tsx:32 (PlayheadSync fromUrl)
- scenario: the clock is playing, and the hash is changed (or the route first applied) with `t` equal to `shownTime(clock)`. Two cases: a clock just played from its start before its first sync, with `t=0` and origin 0; or a looping clock that crosses an integer ms on the frame. `fromUrl` returns at `t === shownTime(clock)` without a hold, so the clock keeps playing, and `toUrl` sees `rate !== 0` and erases `t` from the URL. Elsewhere a `t` in the URL means "paused here" (the hold pauses), so the equality short-cut should apply only when the clock is already paused (`clock.rate === 0`).
- evidence: read
- severity: low
- size: line
- cause: equality short-cut ignores play state
- confidence: likely

## The workshop test helper reads the playhead param under a hard-coded `t` rather than `PLAYHEAD_PARAM`
- where: packages/forge/src/timeline/workshopHarness.tsx:99 (tParam)
- scenario: `playheadUrl.ts` reads and writes the URL key through `PLAYHEAD_PARAM` (`route/url`), but `tParam` reads `readRouteParams().t`. If `PLAYHEAD_PARAM` is renamed, every workshop test asserting `tParam()` reads a key nothing writes and gets null. Tests asserting the param is absent would still pass, so the rename would go unnoticed.
- evidence: read
- severity: low
- size: line
- cause: duplicated key literal
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

<!-- done: 3 findings, files read: 12 -->
