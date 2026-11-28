## A taken-back compositor run stays on the table forever when its main-thread continuation leaves without finishing
- where: packages/animator/src/engine/handoff/run.ts:107 (launch → release)
- scenario: An element-target tween with `compositor: 'prefer'` is handed off. A hold or a second animation on the target then calls `s.handoff.release()`. `release` defers the parent row to `Infinity` and starts a child through `continueOnMainThread`. Only the child's `onDone` ends the parent (`ctx.reportEnd`/`ctx.finish`). If the child leaves any other way, the parent row is never taken off. Two such ways: the child's commit in `end` throws because the target's setter throws, so `retireThrown` cancels the child; or the user's `easing`/`interpolate` throws on a progress value that keyframe sampling never hit, so the codec faults the child id. Either way the parent stays on the table with `due: Infinity`, holding its `cancelKey` and its target. Consequences: `isActive()` and `isActive(key)` stay true, `onDone` never fires, and every later handoff on that target is refused with "another animation is moving its target". The parent should leave whenever its child does, finished or canceled.
- evidence: read (run.ts `release`, takeBack.ts `continueOnMainThread`, frame.ts `retireThrown`, table.ts `retire`)
- severity: medium
- fix: packages/animator/src/engine/handoff/run.ts, packages/animator/src/engine/handoff/takeBack.ts
- size: function
- cause: parent's exit wired only to the child's onDone
- confidence: likely

## `follow` measures a frame against a clock seeded from `host.now()`, which a hosted animator's outside clock need not share
- where: packages/animator/src/engine/core.ts:151 (createAnimatorCore → follow; seedClock at :62)
- scenario: Take `createHostedAnimator({ now: () => performance.now(), … })` driven by `follow(timelineT, 1)`. Its docs put `tick`'s `t` on the host's clock and `follow`'s `t` on an outside clock. With the animator idle (`frameT` null), a tween starts. `seedClock` sets `frameT = host.now()`, say 50000. The next `follow(1200, 1)` computes `moved = 1200 - 50000 < 0`, so `driveTo` turns the drive to -1, and `frame.tick` advances `elapsed` by about 48800 ms played backward. The new tween reads `nowMs <= 0` at once and ends at its `from`, with `onDone` fired, instead of playing forward. The same happens when one host mixes `tick` and `follow`: `frameT` is left on the other clock and the first frame jumps. `useAnimator` hides this because its `now()` returns `clock.elapsed` and it calls `resumed()` when the clock changes; the core and `createHostedAnimator` do neither. The first followed frame after a seed should advance by 0, not by the gap between clocks.
- evidence: read (core.ts follow/seedClock, frame.ts tick, createHostedAnimator.ts, useAnimator.ts `now`)
- severity: medium
- fix: packages/animator/src/engine/core.ts, packages/animator/src/createHostedAnimator.ts
- size: function
- cause: seed clock and followed clock not the same origin
- confidence: likely

## A target whose `show` throws while only a timeline hold moves it logs every frame and is never stopped
- where: packages/animator/src/engine/core.ts:89 (targets `stop`), packages/animator/src/engine/offsets.ts:203 (createTargetBook `stop`)
- scenario: A timeline track holds an element target through `startTimeline`'s `openHold` (animatorApi.ts:85), and that target's `show` throws. `createTargetBook.stop` calls `owner.stop(s)`. That retires only what `table.on(s)` lists, plus `s.parts`. The timeline's hold is in neither: the timeline row is not filed under the target, and `openHold` never adds a part (only holdRows does). So nothing detaches the target. It stays in `showing`, `show` throws again next frame, and `console.error` fires every frame for as long as the timeline holds. The hold that should stop never does.
- evidence: read (offsets.ts stop/shown, core.ts stop, holds.ts openHold; Grep shows `parts.add` only in holdRows.ts)
- severity: low
- fix: packages/animator/src/engine/holds.ts, packages/animator/src/engine/animatorApi.ts
- size: function
- cause: openHold registers no stop with the target
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
