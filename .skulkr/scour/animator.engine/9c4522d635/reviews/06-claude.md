## A paused handoff run taken back while the animator plays backward continues forward, then ends at the release point instead of the run's start
- where: packages/animator/src/engine/handoff/run.ts:107 (launch → release)
- scenario: a tween or spring handed to the compositor, its animation paused (handle `pause()` or `pauseKey`), the animator playing backward (`setTimeScale(-1)`, or the handle's own negative time scale). A hold or a main-thread animation opens on the target, which calls `s.handoff.release()`. `backward = table.rateOf(a) < 0` reads 0 while paused, so `continueOnMainThread` builds the forward continuation: it commits `at(local)` and tweens or springs from there toward the destination. On resume the child plays at rate −1 from its own clock 0, so its first tick hits `nowMs <= 0`, ends at its start (`at(local)`), and reports the parent done. The unreleased run would have played back to `motion.at(0)`. The target stops where it was released and `onDone` fires with no motion.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/handoff/run.ts, packages/animator/src/engine/handoff/handoffs.ts
- size: line
- cause: direction read off the rate, which is 0 while paused, not off the sign of timeScale × direction
- confidence: likely

## A throw from `publish` on a target that just came to rest is swallowed with no log
- where: packages/animator/src/engine/offsets.ts:262 (createTargetBook → publish, show, showNow)
- scenario: a target's animation ends this frame, so the target moves from `showing` to `rested`. `show()` calls `shown(s, s.get())`, which queues `s.publish`, then runs `rested.clear()` before `publish()`. If that publish throws, the catch only looks for the target in `[...showing, ...rested]`. `rested` is now empty, so nothing matches, `stop` (the only place that logs) never runs, and the error vanishes. `showNow` has the same gap because it calls `rested.delete(s)` before `shown`. A broken publish on the last frame of every animation is never reported.
- evidence: read
- severity: low
- size: function
- cause: rested cleared before publish runs; catch only logs through a target match
- confidence: sure

## `cancelAll` skips `halt()` when an `onCancel` throws
- where: packages/animator/src/engine/animatorApi.ts:142 (createAnimatorApi → cancelAll)
- scenario: a target's setter throws as a canceled animation commits. `table.cancelAll` empties the table and then rethrows, so `host.halt()` on the next line never runs and the requested frame is not canceled. On unmount (`useAnimator` cleanup), the frame loop gets one more frame after everything was supposed to stop. `createHostedAnimator.dispose` also leaves `disposed` false and the overrides uncleared, because the same throw escapes there.
- evidence: read
- severity: low
- size: line
- cause: halt not in a finally
- confidence: sure

## `axesFor` accepts ±Infinity, which turns a target's offsets into NaN
- where: packages/animator/src/engine/offsets.ts:8 (axesFor)
- scenario: `animator.tween({ target, to: { x: Infinity }, ms: 300 })`. The check refuses only NaN, so `to` is committed as Infinity. `travel(base, to)` is −Infinity, and the codec's voice from −Infinity to 0 (and `plus(to, offset)` in `onTick`) produces Infinity − Infinity = NaN. The target then shows NaN, and `shareBehind` divides Infinity by Infinity. The same goes for `from`, `velocity` and `setTarget`. The frame-time check (`checkFrame`) and `timeScaleOf` both refuse non-finite values, so this is the one entry point that lets them in.
- evidence: read
- severity: low
- size: line
- cause: NaN-only guard instead of Number.isFinite
- confidence: likely

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

<!-- done: 4 findings, files read: 34 -->
