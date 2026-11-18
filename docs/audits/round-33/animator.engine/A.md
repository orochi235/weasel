# Audit round 33 — animator.engine — findings

## A hold store's growth leaves a covering layer's new rows covering no axis, so a full hold joined there shows nothing
- where: packages/animator/src/engine/holdStore.ts:99 (widenLayer), with :231 (join) and :122 (foldRow)
- scenario: a layer's `covers` is created by `join` filled with 1 ("holds every axis") the first time a hold on some row names `axes`. `grow` then widens it through `wider(l.covers, rows * n)`, whose fill defaults to 0, so every row past the old capacity reads "holds no axis". A later hold that joins one of those rows in the same layer with no `covers` (all axes — e.g. `store.free(row)` handing back the pooled layer that once held a partial-axes hold) never writes its covers, and `foldRow`'s `l.covers && !l.covers[base + a]` gives it weight 0 on every axis: the target shows its committed value instead of the held one. Should widen with fill 1 (`wider(l.covers, rows * n, 1)`), as `part` restores 1.
- evidence: read
- severity: high

## A frame's ticks stop running in registration order once a waiting animation wakes or one turns backward
- where: packages/animator/src/engine/schedule.ts:125 (ticks), :58 (wait), :115/:126 (merge)
- scenario: `every` is a Set in insertion order; `ticks` merges the woken ones into `steady` by `seq`, assuming `steady` is in `seq` order, then appends each woken animation to the end of `every`. Animation A (seq 0, a target tween with no `onTick`, or anything deferred, so it has a `due`) and B (seq 1, ticked every frame): once A wakes, `every` is {B, A}, and from the next frame on B ticks before A, and later merges compare against an unsorted `steady`, so even the merged list is out of order. The same happens when `wait` moves a rewinding animation into `every`. Two animations writing the same thing (an `onTick` each on one adapter, a supervisor reading state another tick set) then resolve the other way round from the documented "in the order they registered" (`Table.ticks`, `Schedule.ticks`).
- evidence: read
- severity: medium

## A throw from a hold's `value`/`weight` or a target tween's `interpolate` leaves `framing` true for good, and the animator never asks for another frame
- where: packages/animator/src/engine/frame.ts:107–122 (createFrame `tick`)
- scenario: `framing = true` is set before `host.codec.frame(dt)` and `host.targets.settle()`, and cleared only at line 122, with no `finally`. Both reach caller code outside any guard: `settle` → `HoldStore.frame` → `ask` calls a hold's `weight()` and `value()` (`animator.hold({ value: () => …, weight: () => … })`, a timeline track's hold), and `codec.frame` → the path patch calls `offsetAt` → the caller's `interpolate`/`interpolator` of a target tween; `host.refold()` (line 121) asks holds' sources again. One throw escapes `core.tick` (nothing in `useAnimator`/`createHostedAnimator` catches it), the frame's own `requestFrame` is never reached, and `framing` stays true, so `table.register`, `ctx.wake` and `ctx.touch` all skip `requestFrame` from then on: every animation on the animator freezes permanently, even after the bad hold is released. The tick loop (line 81) and `TargetBook.shown` both catch exactly so that one bad animation cannot stop the rest; these paths should too (at least `try/finally` on `framing`, and retire the hold/animation whose source threw).
- evidence: read
- severity: high

## A handed-off start that falls back to the main thread has already interrupted under an id that never registers
- where: packages/animator/src/engine/handoff/start.ts:39–40 (begin), :101–104 (handOffPhysics)
- scenario: `begin` runs `ctx.interrupt(o.cancelKey, seed)` with the handoff seed, then `handOffPhysics` can still return null (`motion.ms <= 0`, or `begin`'s own `!free` refusal), and `animatorApi` falls back to `startOffsetPhysics`/`startOffsetTween`, which mint a fresh id. A `watch` listener got `{ type: 'interrupt', by: { id: N } }` for an `N` that never gets a `start`, `end` or appears in `live()`; and on the `!free` path the fallback's `velocityUnder` runs after the interrupt already stopped the moving animation, so the spring starts from rest instead of carrying the interrupted one's velocity (which `begin`'s `ahead` had read and then dropped). With `compositor: 'require'` the refusal throws after the interrupt has already canceled the key's holder. Should decide eligibility (including `motion.ms`) before interrupting, or hand the read velocity and seed to the fallback.
- evidence: read
- severity: low

## `retire` asks for a frame from inside a frame's ticks, which `register` refuses to do for a stated reason
- where: packages/animator/src/engine/table.ts:109 (retire), against :146–148 (register)
- scenario: `register` skips `requestFrame` while `host.framing()`, because "asked for from a tick, it would run ahead of a paint `onTick` requests, and the tick after would paint nothing". `retire` calls `host.requestFrame()` whenever `host.resting()`, framing or not. An `onTick` that cancels another animation on a target with a `show` (the cancel's `leave` → `detach` puts it in `rested`, so `resting()` is true) requests the next frame from inside the tick: exactly the ordering `register` avoids. The frame in progress already shows `rested` targets in its own `targets.show()`, so the request is not needed there; it should be `if (host.resting() && !host.framing())`.
- evidence: read
- severity: low

## Files read
packages/animator/src/engine/animatorApi.ts
packages/animator/src/engine/axes.ts
packages/animator/src/engine/codec.ts
packages/animator/src/engine/completions.ts
packages/animator/src/engine/context.ts
packages/animator/src/engine/core.ts
packages/animator/src/engine/decay.ts
packages/animator/src/engine/frame.ts
packages/animator/src/engine/handoff/eligible.ts
packages/animator/src/engine/handoff/handoffs.ts
packages/animator/src/engine/handoff/motion.ts
packages/animator/src/engine/handoff/run.ts
packages/animator/src/engine/handoff/start.ts
packages/animator/src/engine/handoff/takeBack.ts
packages/animator/src/engine/handoff/testing/fakeAnimate.ts
packages/animator/src/engine/holdAnimation.ts
packages/animator/src/engine/holdRows.ts
packages/animator/src/engine/holdStore.ts
packages/animator/src/engine/holds.ts
packages/animator/src/engine/integrator.ts
packages/animator/src/engine/lanes.ts
packages/animator/src/engine/offsetPhysics.ts
packages/animator/src/engine/offsetTween.ts
packages/animator/src/engine/offsets.ts
packages/animator/src/engine/physicsAnimation.ts
packages/animator/src/engine/rewinds.ts
packages/animator/src/engine/roster.ts
packages/animator/src/engine/schedule.ts
packages/animator/src/engine/springRest.ts
packages/animator/src/engine/springVoices.ts
packages/animator/src/engine/table.ts
packages/animator/src/engine/tweenAnimation.ts
packages/animator/src/engine/wakes.ts

<!-- done: 5 findings, files read: 33 -->
