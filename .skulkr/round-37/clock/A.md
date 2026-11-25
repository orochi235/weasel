## A hold is not released by `clock.ramp(...)`: the clock plays away from the held time while the hold stays live
- where: packages/clock/src/hold.ts:117 (holdWhere, subscribe listener)
- scenario: `holdAt(handle, 500)` pauses the clock (rate 0) and seeks it. A transport then calls `clock.ramp(1, 300)`. `ramp` sets `run.ramp` and notifies, but `clock.rate` is still 0 and `elapsed`/`duration`/`origin`/`loop` are unchanged, so the listener neither releases nor re-places. Over the next frames the ramp moves `elapsed` while nothing notifies, and `pending()` keeps reporting the held time while the clock plays. If a `declare` or `duration` write lands before the ramp settles, `place()` seeks the playing clock back to the held time. The doc says any other change, a rate change included, releases the hold. The listener should treat a ramp as a rate change. Nothing exposes whether a ramp is running, but a hold can tell it is not inert: after `place()`, a held clock with nothing else changed reads `inert` false only until the next sync.
- evidence: read (clock.ts:252-262 `ramp` leaves `rate` at its old value and emits; hold.ts:119 checks only `clock.rate !== 0`)
- severity: medium

## `holdPosition` puts an ended integer-loop position in a pass that does not exist, so a changed origin lands it at the end instead of at the same shown time
- where: packages/clock/src/hold.ts:66 (elapsedOn)
- scenario: The position comes from a clock that ended: duration 1000, `loop: 1`, `elapsed` 1000, shown time 1000. `clockPosition` writes no `passEnd` for an ended run (clock.ts:21). The position is held on the same clock with its origin moved to 200, via `override({ origin: 200 })`. `elapsedOn` computes `pass = floor(1000/1000) = 1` and `into = 0`, and `within = max(0, 0 + 0 - 200) = 0`, so the target is 1000 and the clock comes back ended, showing 1200. Keeping "its pass and the time it showed within it" should give pass 0 and elapsed 800, which shows 1000. `applyRun` (what `declare` and `override` do) handles the same input through `placeOf`, which reads an ended run as the last pass with `into = duration`, and gets 800. So the two paths give two different answers. `elapsedOn` should clamp the pass to the last one, as `placeOf` does when `elapsed >= duration * passes`.
- evidence: read (hold.ts:66-74; place.ts:10-13; clock.ts:142-150)
- severity: medium

## `declare` re-derives the default `speed` from the clock's current rate instead of the declared rate, so re-declaring the same spec changes `speed`
- where: packages/clock/src/clock.ts:128 (declaredOf)
- scenario: `createClock({ duration: 1000 })` opens paused with `speed` 1. A transport plays it at `rate = 4`, and the host then re-declares the unchanged spec (say on a re-render). `declaredOf` takes `speed: restingSpeed(run.rate)`, which is 4. Paused and re-declared again, it falls back to 1. So the speed a transport offers flips with whatever rate the clock happened to have when the declaration arrived. `ClockSpec.speed` documents the default as `|rate|` of the spec, or 1 for a clock that opens paused, and `createClock` derives it from `openRate`. `declaredOf` should use `next.rate ?? 0`.
- evidence: read (clock.ts:123-130 vs clock.ts:308; types.ts:19-21)
- severity: medium

## `holdAt` and `holdPosition` give `pending()` two different answers for a time past the pass's end
- where: packages/clock/src/hold.ts:33 and hold.ts:52 (holdAt / holdPosition `wanted`)
- scenario: Clock with duration 1000 and origin 0. `holdAt(h, 1500)` seeks to the pass end, and `pending()` returns 1500 because the shown time is not reached yet. Now take the same wait expressed as `holdPosition(h, { elapsed: 500, origin: 1000 })`, a position recorded under origin 1000 that also showed 1500. `elapsedOn` clamps `within` to 1000 and returns target 1000. The clock stands there, so `pending()` returns null and reports the hold as satisfied while it still waits for the span to grow. Both are documented as waiting at the pass end for a span that "may not reach yet". One says it is waiting and the other says it is not.
- evidence: read (hold.ts:30-33, 51-53, 72-74)
- severity: low

## A clock that a second registration under its id shadows stops being synced, and jumps forward by the whole shadowed time when it comes back
- where: packages/clock/src/registry.ts:51 (createClockRegistry `all`) with packages/clock/src/useClockLoop.ts:14
- scenario: Clock A plays under id `x`, and clock B is registered under `x` and then released. `entries()` lists only each key's live registrant, so while B shadows A, `all()` leaves A out. The loop neither syncs A nor rebases it, and A's `last` stays at its last frame. When B is released, `attach` requests a frame, and `syncTo` advances A by the full real-time gap: A jumps by the whole shadowed span and emits one huge frame (its mix is synced across it in one step). A clock that is out of sight gets rebased so unseen time does not count, but a shadowed one gets neither treatment: it is not synced while shadowed and is not rebased when it comes back. The fix is to rebase a clock that drops out of `all()`, or to keep syncing shadowed registrants.
- evidence: read (packages/registry/src/reflectable.ts:149-162 `entriesOf` returns only `stack.at(-1)`; clock.ts:172-175)
- severity: low

## `reset()` throws on a clock opened at `start: 'end'` once a `declare` has made its run endless
- where: packages/clock/src/clock.ts:318-322 (opening) via clock.ts:352 (reset)
- scenario: `createClock({ duration: 1000, start: 'end' })`, then `h.declare({ start: 'end' })` with no duration, so the run becomes endless (the declaration is accepted). A later `h.reset()` calls `hub.opening()`, which throws "a run that never ends has no 'end' to start at". Reset is the documented way back to where the clock opened, and here it raises an error from an API call that was valid. `declare` does not check that the original `start` still has somewhere to open.
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
