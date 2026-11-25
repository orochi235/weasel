# Audit round 38 — area `clock`

## A hold is not released by a ramp, and later snaps a playing clock back to the held time
- where: packages/clock/src/hold.ts:117-122 (holdWhere subscriber)
- scenario: `holdAt(handle, 500)` pauses the clock (rate 0). A transport then calls `clock.ramp(1, 400)`. `ramp` sets `run.ramp` and emits `subscribe`, but `clock.rate` is still 0, duration/origin/loop are unchanged and `elapsed === set`, so the hold stays. Frames now move the clock (syncTo emits no subscribe until the ramp settles), and during those 400 ms `pending()` still reports 500 while the clock plays, and a `declare`/`duration` write in that window calls `place()`, which seeks the moving clock back to 500. The doc says any rate change releases the hold; a ramp off 0 is one. Should release when `rate !== 0` *or a ramp is set* (e.g. `!clock.inert` after a non-span change, or check the ramp).
- evidence: read
- severity: medium

## A clock shadowed in the registry stops being synced, then jumps by the whole shadowed time when it comes back
- where: packages/clock/src/registry.ts:51 (all), :41-49 (targets); packages/clock/src/useClockLoop.ts:14-19,121-133
- scenario: `register('a', h1)` with h1 playing at rate 1; later `register('a', h2)` shadows it. `all()` reads `entries.entries()`, which lists only each id's visible registration, so h1 leaves `useClockLoop`'s entries: no sync, no rebase, no `onWake`. Ten seconds later h2's release brings h1 back; `attach` re-adds it without rebasing, and its next `sync` advances by `timestamp - last` ≈ 10 s (or to the run's end). Either a shadowed clock keeps being driven (it is still a registered, possibly visible clock) or a returning one is rebased; today it neither runs nor rests. Same stale-`last` jump for any handle released and registered again while playing. `targets(handle)` likewise ignores a shadowed registration's target.
- evidence: read (createReflectable.entries() returns visible entries with a `shadowed` list — packages/registry/src/reflectable.test.ts:19-55)
- severity: medium

## `declare` defaults `speed` from the live rate, `createClock` from the declared rate
- where: packages/clock/src/clock.ts:128 (declaredOf) vs :308 (createClock)
- scenario: `createClock({ rate: 2 })` → `speed` 2. The user pauses (rate 0) and the host re-declares the same spec `{ rate: 2 }`: `declaredOf` computes `restingSpeed(run.rate)` = 1, so the transport's play speed silently drops from 2 to 1. Played backward at −0.5 and re-declared, speed becomes 0.5. `ClockSpec.speed` documents the default as `|rate|` of the spec (“or 1 for a clock that opens paused”); `declare` should use `restingSpeed(spec.rate ?? 0)` (or keep `run.speed`), not the momentary rate.
- evidence: read
- severity: medium

## `reset()` throws on a `start: 'end'` clock once its run has become endless
- where: packages/clock/src/clock.ts:318-323,351-352 (opening, reset)
- scenario: `createClock({ duration: 1000, start: 'end' })`; a transport's loop toggle sets `clock.loop = true` (or a `duration = Infinity` write, which `checkDuration` accepts). Pressing Reset calls `hub.opening()`, which throws `RangeError("a run that never ends has no 'end' to start at")` from a UI handler. Same for a clock reopened with `at` under such a spec. `reset` is documented as always allowed; creation validated `'end'` against the span at the time, but nothing revalidates it when the span later becomes infinite.
- evidence: read
- severity: low

## `holdPosition`'s `elapsedOn` splits a pass with a bare floor/remainder, unlike the clock's own `placeOf`
- where: packages/clock/src/hold.ts:66-67 (elapsedOn)
- scenario: `at = { elapsed: 50, duration: 0.1, origin: 0.05 }` on a clock now at duration 0.2, origin 0. `Math.floor(50 / 0.1)` = 500 but `500 * 0.1` = 50.00000000000001 > 50, so `into` is −7e-15; `placeOf` (place.ts:16-18, written for exactly this case) puts it in pass 499, ~0.1 in. `elapsedOn` gives pass 500, within 0.05 → 100.05; the clock's own rule gives pass 499, within 0.15 → 99.95. The pass/time split is answered two ways, and the hold lands a pass off from where `clock.pass` says the recorded position stood.
- evidence: read
- severity: low

## `holdPosition` clamps a pass beyond the current loop to the run's end instead of the last pass, unlike `loop`/`declare`
- where: packages/clock/src/hold.ts:63-74 (elapsedOn)
- scenario: recorded `{ elapsed: 2500, duration: 1000 }` (pass 2, 500 in); the clock is now duration 800, loop 2. `elapsedOn` returns `2*800 + 500 = 2100`, which `seek` clamps to 1600 (end of run). The clock's own rule for a span that shrinks past `elapsed` (`placeIn`, used by `loop` writes and `declare`) keeps the time within the pass in the last pass left: 1300. And when duration and origin match, `at.elapsed` is returned unremapped, so a recorded later pass on a now-shorter loop also lands at the end. Documented as "keeps its pass and the time it showed within it".
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

<!-- done: 6 findings, files read: 13 -->
