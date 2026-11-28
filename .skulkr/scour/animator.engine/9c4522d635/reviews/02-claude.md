# Findings: animator.engine

## A paused animation at its end while it plays backward is treated as playing forward and finishes at `to`
- where: packages/animator/src/engine/tweenAnimation.ts:69 (startTween tick); same test at packages/animator/src/engine/offsetTween.ts:106 and packages/animator/src/engine/handoff/run.ts:139
- scenario: a loop run backward (or a timeline under a negative time scale) starts a tween at its end (`startAt = ms`, playing backward). Then the animator is paused (`api.pause()`), or the tween's handle is paused. `frame.tick` passes `scale = 0`, because `clock.paused` and `anim.paused` both zero the scale. The animation's own clock still reads `ms`, so `t >= 1 && scale >= 0` holds and the tween emits `o.to` and finishes. offsetTween's `scale >= 0 && nowMs >= o.ms` and run.ts's `scale >= 0 && at >= motion.ms` do the same. A paused animation should stay where it is. Instead it completes forward, at the wrong end, and fires `onDone`. startTween has no `due`, so it is ticked every frame while paused. offsetTween and runs stay in the schedule's every-frame set under `clock.paused`, because `schedule.rateOf` does not read the animator's pause.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/tweenAnimation.ts, packages/animator/src/engine/offsetTween.ts, packages/animator/src/engine/handoff/run.ts
- size: function
- cause: a scale of 0 is read as forward; the direction is lost while paused
- confidence: likely

## A handed-off run released while paused and playing backward continues forward
- where: packages/animator/src/engine/handoff/run.ts:107 (release)
- scenario: a compositor run plays backward because of a negative per-animation time scale or the animator's backward direction, and its handle is paused. Then a hold or a main-thread animation on the target calls `s.handoff.release()`. `backward = table.rateOf(a) < 0` reads 0 while `a.paused`, so `takeBack` builds a forward continuation. With a negative `timeScale`, `child.setTimeScale(a.timeScale)` then runs that forward tween backward from 0, so it ends at once at where the run stood rather than at the run's start. With the animator's direction negative, the child is registered under that direction and runs backward from 0 in the same way. In both cases the continuation does not carry the backward run on to the start. The direction should come from `timeScale * direction` whatever the pause.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/handoff/run.ts
- size: line
- cause: `rateOf` is 0 while paused, so it loses the sign
- confidence: likely

## A throw from `onDone` in a taken-back run's continuation leaves the original run's row on the table forever
- where: packages/animator/src/engine/handoff/run.ts:113 (release, done callback)
- scenario: a run handed to the compositor is taken back (for example by a hold), and the caller's `onDone` throws when the continuation ends. The callback calls `ctx.reportEnd(id); ends.onDone?.(); ctx.finish(id)`. The throw skips `ctx.finish(id)` and propagates out of the child's tick. `frame.retireThrown` drops only the child. The parent row stays: `ended`, deferred to `Infinity`, counted in `waiting`. `isActive(key)` stays true, it shows in `live()`, and it keeps its key until something interrupts or cancels it. A main-thread tween whose `onDone` throws is dropped by `retireThrown` instead.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/handoff/run.ts
- size: line
- cause: finish is not in a `finally` around the user's onDone
- confidence: sure

## Files read
packages/animator/src/engine/animatorApi.ts
packages/animator/src/engine/axes.ts
packages/animator/src/engine/codec.ts
packages/animator/src/engine/codecVoice.ts
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

<!-- done: 3 findings, files read: 34 -->
