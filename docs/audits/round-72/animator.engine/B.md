# Audit round 72 — animator.engine findings

## `tick` after `follow` keeps the outside clock's backward drive, so the animator's clock stops for good
- where: packages/animator/src/engine/core.ts:147 (createAnimatorCore, `tick`); packages/animator/src/engine/frame.ts:117 (createFrame, `tick`)
- scenario: a host runs the animator on an outside clock whose last move was backward (`follow(t, -1)` with `t` below the last frame, so `table.turn` sets `clock.drive = -1`), then drops the clock: `useAnimator` with `opts.clock` set and later unset (its effect calls `core.resumed()` and the rAF loop switches to `core.tick(t)`), or a `createHostedAnimator` caller switching from `follow` to `tick`. `tick` resets `pacing.outside.on` but never turns `clock.drive` back to 1. Every later frame computes `frameDt = max(0, (t - frameT) * -1)`, which is 0 for a forward rAF clock, so `clock.elapsed` never advances; `direction()` still answers -1, so every animation reads as playing backward and handed-off runs are placed at a negative rate. Nothing finishes and nothing moves. Should: `tick` (or `resumed`) turns the drive back to 1 through `table.turn` as `follow` does.
- evidence: read
- severity: high

## A primitive started at its end to play backward ends forward, at `to`, on any tick whose clock has not yet moved off the end
- where: packages/animator/src/engine/tweenAnimation.ts:57-59 (startTween, tick); packages/animator/src/engine/offsetTween.ts:88-89 (startOffsetTween, seed.tick); packages/animator/src/engine/handoff/run.ts:133-134 (launch, seed.tick)
- scenario: a tween started under `ctx.starting(true, …)` (a loop's pass run backward, or `continueOnMainThread` going back) registers with `startAt = ms`. The backward check is `scale < 0 && nowMs <= 0`; the forward one, `nowMs >= ms` (`t >= 1` in startTween), is tested whatever the direction. The first tick of a rewinding animation sees `nowMs === ms` whenever the frame advanced the clock by 0: `frame.tick` clamps `frameDt` to `max(0, …)` (a rAF timestamp behind the `now()` the idle clock was seeded from, which the comment there says jsdom does by ~600 ms), or an outside clock held still with `follow(t, -1)` (`drive` -1 at rate < 0 with no movement). The tween then reports done at its destination without playing back; a backward loop starts its next pass, which ends the same way on the next frame, so a counted loop runs through its passes while no time passes. Should: the forward end applies only when not playing backward (`scale >= 0`).
- evidence: read
- severity: medium

## fakeAnimate's `setup` defines `document.timeline` and never takes it down
- where: packages/animator/src/engine/handoff/testing/fakeAnimate.ts:71 (setup)
- scenario: a test calls `setup()`; every later test in the same jsdom environment sees `document.timeline.currentTime` reading that test's dead timeline, frozen at its last `now`. `defaultWall` (core.ts:237) reads it, so an animator a later test builds without its own `wall` gets a stale wall clock and places handed-off runs against it. The `unmount` that `setup` returns does not restore the property.
- evidence: read
- severity: low

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
