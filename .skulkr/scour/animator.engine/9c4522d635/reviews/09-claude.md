# animator.engine findings

## A run handed to the compositor never attaches its target, so another animator's start passes `check`, tears the run down, and then throws
- where: packages/animator/src/engine/handoff/start.ts:121 (handOffTween), packages/animator/src/engine/handoff/run.ts:156 (launch)
- scenario: animator A hands a tween on element target `t` to the compositor (`compositor: 'auto'`). `launch` sets `s.handoff` but nothing calls `ctx.targets.attach(s)`, so `s.owner` stays null and `s.live` 0. Animator B then calls `tween({ target: t, ... })`. `startOffsetTween` (or `startOffsetPhysics`, or `openHold` through `checkHold`) runs `ctx.targets.check(s)`, which passes because `s.owner` is null, runs B's interrupt, then calls `s.handoff?.release()`. That takes A's run back to the main thread: A's `continueOnMainThread` starts a child on A, which attaches `t` to A. B's own `ctx.targets.attach(s)` then throws "this target is being moved by another animator". B's call is refused, as it should be, but only after it has moved A's run off the compositor and run B's interrupt. It should throw at `check`, before changing anything, the way it does for a target A moves on the main thread.
- evidence: read (`TargetBook.check` in offsets.ts tests only `s.owner`; `refusal` in eligible.ts treats `s.handoff` with no run of its own as "another animator", but the main-thread paths never consult `s.handoff` before releasing it)
- severity: medium
- fix: packages/animator/src/engine/offsets.ts, packages/animator/src/engine/handoff/run.ts
- size: function
- cause: handoff ownership not recorded in TargetBook
- confidence: likely

## A timeline track's hold is not stopped by `target.stop()`, by removing a table row, or after the target's `show` throws
- where: packages/animator/src/engine/animatorApi.ts:84 (startTimeline's `hold`), packages/animator/src/engine/holds.ts:150 (openHold)
- scenario: a timeline track holds element or row target `t`. `openHold` attaches `t` (raising `live`) but registers no table row on `t` and adds nothing to `s.parts`. The owner's `stop` in core.ts:90 stops only `table.on(s)` and `s.parts`. So (a) `t.stop()`, documented as "Stops every animation moving it", leaves the track's hold showing and `t.active` true. (b) `RowTable.remove(row)`, which stops whatever moves the row through the same owner stop, leaves the hold on a freed row whose index is reused by the next `add`. (c) When `t`'s `show` throws, `TargetBook.stop` calls `owner.stop(s)`, the hold stays, `t` stays in `showing`, and every following frame calls the throwing `show` and logs again. `startHoldRows` avoids this by adding a `part` per row; the timeline's holds should do the same (or leave through `parts`).
- evidence: read (`parts` is only written in holdRows.ts:62; `openHold` never touches it)
- severity: medium
- fix: packages/animator/src/engine/holds.ts, packages/animator/src/engine/animatorApi.ts
- size: function
- cause: open hold not registered as a part of its target
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

<!-- done: 2 findings, files read: 34 -->
