# Findings: animator.engine

## A handed-off run taken back while paused carries on forward even when it was playing backward
- where: packages/animator/src/engine/handoff/run.ts:101 (launch → release)
- scenario: a compositor run is playing backward (animator under a negative time scale, or `follow` driving it back), and its handle is paused; then something releases it (a hold opens on the target, or an animation starts on it with no cancelKey). `backward` is `table.rateOf(a) < 0`, and `rateOf` answers 0 while paused, so `backward` is false. The continuation is a forward `startOffsetTween` from `local` to the end. Registered while the animator's direction is -1, it is rerated backward and, at clock 0, ends at once at its own start: the target stays where the run stood instead of running back to the run's start, as it would have unpaused.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/handoff/run.ts
- size: line
- cause: direction read from the rate, which pause zeroes
- confidence: likely

## A taken-back run's parent row stays on the table for good if its child is retired without finishing
- where: packages/animator/src/engine/handoff/run.ts:105 (launch → release)
- scenario: after `release`, the parent is deferred to `Infinity` and leaves only through the child's `onDone` (`ctx.finish(id)`) or a cancel that reaches the parent. When the child is retired on its own, for example by the frame's `retireThrown` because its tick threw (a target setter throwing as it commits), the child's `onDone` never runs. The parent (idle, `due: Infinity`) stays in `animations` with no voice. `isActive(key)` stays true, `live()` lists it, and `table.on(s)` keeps reporting it, so every later handoff on that target is refused with "another animation is moving its target".
- evidence: read
- severity: low
- fix: packages/animator/src/engine/handoff/run.ts, packages/animator/src/engine/handoff/takeBack.ts
- size: function
- cause: the child's cancel/retire path doesn't finish the parent
- confidence: likely

## A compositor run never claims its target, so another animator can take it back before being refused
- where: packages/animator/src/engine/offsets.ts:262 (createTargetBook → check)
- scenario: animator A hands a tween on an element target to the compositor. `launch` sets `s.handoff` but never calls `targets.attach`, so `s.owner` stays null. Animator B then starts `tween({ target })`. `startOffsetTween` → `check(s)` passes because the owner is null, and `s.handoff?.release()` takes A's run back onto A's main thread, where A's continuation attaches and makes A the owner. B's `attach` then throws "being moved by another animator". B's call is refused, but by then it has already turned A's compositor run into a main-thread tween, and has already interrupted B's own cancelKey. `refusal` in eligible.ts does treat `s.handoff` with no row of its own as another animator, so the two checks answer the same question differently.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/offsets.ts, packages/animator/src/engine/handoff/run.ts
- size: function
- cause: ownership check ignores s.handoff
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

<!-- done: 3 findings, files read: 34 -->
