The findings file couldn't be written because permission was denied, so the whole document follows.

## holdPosition maps an ended run's position into a pass past the run, so under a new duration or origin it lands at the new run's end
- where: packages/clock/src/hold.ts:67 (elapsedOn)
- scenario: a one-pass clock, duration 1000, plays to its end; `clockPosition` records `{ elapsed: 1000 }` with no `passEnd`, since that is omitted once `ended`. Later the clock is declared at duration 2000 and `holdPosition(handle, { elapsed: 1000, duration: 1000 })` is called. `elapsedOn` takes `pass = floor(1000/1000) = 1`, `into = 0`, and the `passEnd` fix-up is skipped, so the target is `1 * 2000 + 0 = 2000`. The seek clamps that to the span and the clock stands ended at 2000. It should keep the pass the clock stood in (0) and the time it showed (1000), which gives elapsed 1000. With loop 2 and duration 1000 → 2000, the ended position 2000 maps to 4000 (the end) where pass 1 showing 1000 is 3000. An origin change does the same thing: the shown end of the pass becomes `origin − clock.origin` into a pass that does not exist. `placeOf` in clock.ts reads `elapsed >= span` as the last pass at phase 1, so the two places read the same ended position two ways.
- evidence: read
- severity: medium

## declare() without `speed` resolves the default from the clock's current rate, not the spec's, so re-declaring the same spec changes `speed`
- where: packages/clock/src/clock.ts:128 (declaredOf)
- scenario: `createClock({ duration: 1000 })` opens paused with `speed` 1, from `restingSpeed(openRate)`. A transport plays it at `rate = -2` (or 4) and the host then calls `declare({ duration: 1000 })` for an unrelated content change. `declaredOf` uses `restingSpeed(run.rate)`, so `speed` becomes 2 (or 4), and a later pause/play cycle plays at that speed. `ClockSpec.speed` documents the default as the spec's `|rate|`, or 1 for a clock that opens paused, and `createClock` reads it that way (`restingSpeed(openRate)`). `declare` should use `restingSpeed(next.rate ?? 0)`. As it stands, opening and declaring answer the same default two different ways.
- evidence: read
- severity: medium

## reset() throws on a `start: 'end'` clock whose duration later became endless
- where: packages/clock/src/clock.ts:352 (reset → opening)
- scenario: `createClock({ duration: 1000, start: 'end' })`. Then `declare({})` (duration omitted means endless) or `clock.duration = Infinity`, both of which `checkDuration` accepts. A later `reset()` calls `opening()`, which throws "a run that never ends has no 'end' to start at". `ClockHandle.reset` is documented as always available ("allowed on a clock that is not seekable") and has no throw documented. Neither declare nor the duration write refuses the change that sets up this throw, so the refusal comes late and from an unrelated call.
- evidence: read
- severity: low

## PlayheadHold.pending documents a clamped time, but holdAt returns the raw `shown`
- where: packages/clock/src/hold.ts:33 (holdAt wanted)
- scenario: `holdAt(handle, 5000)` on a clock with duration 1000 and origin 0 waits at 1000, and `pending()` returns 5000. `holdAt(handle, -200)` seeks to 0, and `pending()` returns -200 for as long as the hold lasts, even though the hold can never reach it. The interface doc says `pending` is "The held time while the clock stands elsewhere (clamped)", and `holdPosition`'s `pending` does return the clamped target. The two hold kinds answer `pending` differently.
- evidence: read
- severity: low

## Files read
packages/clock/src/clock.ts
packages/clock/src/hold.ts
packages/clock/src/index.ts
packages/clock/src/mixFollow.ts
packages/clock/src/pbt.fixture.ts
packages/clock/src/place.ts
packages/clock/src/ramp.ts
packages/clock/src/react.ts
packages/clock/src/registry.ts
packages/clock/src/speeds.ts
packages/clock/src/types.ts
packages/clock/src/useClockLoop.ts
packages/clock/src/validate.ts

<!-- done: 4 findings, files read: 13 -->