# Audit round 72 — animator.engine (blind reviewer)

## Own-loop `tick` after a backward `follow` leaves `clock.drive` at -1, freezing every animation
- where: packages/animator/src/engine/core.ts:147 (createAnimatorCore → `tick`), with frame.ts:117
- scenario: an animator on an outside clock gets `follow(t, rate)` with the clock moved back (or `rate < 0` and no move), so line 152 turns `clock.drive` to -1. The host then goes back to its own frames: `useAnimator` with its `clock` option dropped (its effect only calls `core.resumed()`), or a `createHostedAnimator` host calling `tick(t)` after `follow`. `tick` clears `pacing.outside.on` but nothing resets `clock.drive`, the only writer being `follow`. Every later frame computes `frameDt = max(0, (t - frameT) * -1) = 0` for forward time, so the clock never advances, and `direction()` still answers -1, so every animation is rated backward. Animations stop moving and never end. `tick` should turn the drive back to 1 (through `table.turn`) as `follow` does on a change.
- evidence: read (grep shows `clock.drive` written only at core.ts:152)
- severity: medium

## A target spring's `setTarget` keeps what waits beside the committed value, which a fresh spring replaces
- where: packages/animator/src/engine/offsetPhysics.ts:171-180 (startOffsetPhysics → `setTarget`)
- scenario: a spring runs on a target under a hold; another animation on the target stops while the hold stands, so `keep` puts its leftover into `s.beside`. `setTarget(next)` then commits with a bare `s.set(next)` and shifts the voices by `committed → next` only, leaving `s.beside` in place. When the hold leaves, `leaveHold` absorbs the beside value, so the spring comes to rest at `next + beside`. A new spring toward `next` instead reads the beside value into its own offset (`takeUp`) and clears it (`commitOver`), coming to rest at `next`. The same "spring to `next`" answers two ways; `setTarget` should go through `takeUp`/`commitOver` as the start does.
- evidence: read (end value inferred from `keep`, `leaveHold` and `commitOver`)
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

<!-- done: 2 findings, files read: 34 -->
