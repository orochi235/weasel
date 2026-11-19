## `declare` defaults an omitted `speed` from the clock's current rate, so a paused clock redeclared loses its speed
- where: packages/clock/src/clock.ts:128 (declaredOf)
- scenario: `createClock({ duration: 1000, rate: 2 })` opens with `speed` 2 (`restingSpeed(openRate)`, line 308). The user pauses (`rate = 0`), then the host redeclares with only the duration changed, `declare({ duration: 2000, rate: 2 })` (labkit's `useTrialClockSetup` passes a `ClockCapability` whose `speed` may be undefined; its shape key even renders `undefined`). `declaredOf` takes `spec.speed ?? restingSpeed(run.rate)` = `restingSpeed(0)` = 1, so `clock.speed` drops to 1 and the transport's Play now plays at 1×. Redeclaring the same spec while it plays at −0.5 sets the speed to 0.5. `ClockSpec.speed` documents the default as `|rate|` of the spec, or 1 for a clock that *opens* paused. The default should come from `next.rate ?? 0`, as `createClock` does, not from where the run stands now.
- evidence: read
- severity: medium

## `holdPosition` reads a finished run's position as the start of a pass that does not exist, while `declare` reads it as the end of the last pass
- where: packages/clock/src/hold.ts:66 (elapsedOn)
- scenario: Take a clock with duration 100, `loop: false`, origin 0, played to its end (elapsed 100). `clockPosition` records `{ elapsed: 100, rate: 0 }` with no `passEnd`, because `ended` suppresses it. The clock's origin is then redeclared to 10. `declare` (applyRun → passOf → placeOf's ended branch) takes this as pass 0, 100 ms in, and keeps the shown time: elapsed becomes 90, shown as 100. `holdPosition(handle, { elapsed: 100, origin: 0 })` on that clock computes `pass = floor(100/100) = 1`, `into = 0`, `within = max(0, 0 + 0 − 10) = 0`, and seeks to 100, shown as 110. The same "keep the pass and the time shown in it" rule therefore gives two different answers for an ended run. The same split appears with a duration change: recorded `{ elapsed: 100, duration: 100 }` on a clock now 200 long gives a target of 200 (ended) from elapsedOn, but 100 (mid-pass, shown 100) from applyRun's rule.
- evidence: read
- severity: medium

## A ramp started from a paused, held clock does not release the hold, which keeps reporting `pending` and seeking it back
- where: packages/clock/src/hold.ts:117-121 (holdWhere subscriber)
- scenario: `holdAt(handle, 500)` pauses the clock and holds it. A transport eases into play with `clock.ramp(1, 300)`. `ramp` notifies while `rate` is still 0 and only `run.ramp` is set, so the subscriber's `clock.rate !== 0` test fails. Duration, origin and loop are unchanged, elapsed is unchanged, and the hold is not released. Over the next frames the clock plays forward, but the subscriber hears nothing until the ramp settles. Until then `pending()` still reports the held time while the clock moves. A `declare` or `duration` write that lands before the first frame calls `place()`, which seeks the playing clock back to the hold. Every other way of starting the clock (a rate write) releases the hold. The test should treat a running ramp (`!clock.inert` with rate 0, or a ramp check) as a release.
- evidence: read
- severity: low

## `setDuration` between endless and finite keeps a stale `edge`, where `applyRun` clears it
- where: packages/clock/src/clock.ts:103-107 (setDuration, non-finite branch)
- scenario: A clock with duration 100 and `loop: 3` gets `seek(100, 'end')`, so edge is true (pass 0, phase 1). Then `clock.duration = Infinity` and later `clock.duration = 50`. Both writes take the else branch, which clamps `elapsed` but never resets `run.edge`. Elapsed 100 now falls on the 50-ms pass line with edge still true, so the clock reads pass 1, phase 1, instead of pass 2, phase 0, and `clockPosition` records `passEnd: true`. The same change made through `declare` or `override` (applyRun's non-finite branch, line 153) sets `edge = false`. The two paths give different answers.
- evidence: read
- severity: low

## `reset()` throws on a clock declared `start: 'end'` once its loop is made endless
- where: packages/clock/src/clock.ts:318-323, 351-352 (opening / reset)
- scenario: Take `createClock({ duration: 1000, start: 'end' })`. A transport's loop toggle sets `clock.loop = true`, which the code allows; `declare` even preserves such a toggle. `run.span` becomes Infinity, so the Reset button's `handle.reset()` calls `opening()`, which throws `RangeError("a run that never ends has no 'end' to start at")`. Reset is documented as always available, even on a clock that is not seekable. Instead it throws from a UI handler, and the clock cannot be reset until the loop is turned off.
- evidence: read
- severity: low

## `holdAt.pending` compares a float round trip, not the elapsed it sought, so it can report a hold already met
- where: packages/clock/src/hold.ts:33 (holdAt `wanted`)
- scenario: `where` seeks to `shown − origin`, and `wanted` then tests `clock.origin + clock.elapsed === shown`. When `|origin|` is under half of `shown`, `shown − origin` is rounded (Sterbenz does not apply), and adding `origin` back can land an ulp away from `shown`. The clock then stands exactly where the hold put it, but `pending()` returns `shown` forever, and a UI reads that as "waiting for the span to reach it". `holdPosition` compares `clock.elapsed` against the elapsed it computed (line 53), so the two holds decide "arrived" differently.
- evidence: read (rounding argued, not executed)
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

<!-- done: 6 findings, files read: 13 -->
