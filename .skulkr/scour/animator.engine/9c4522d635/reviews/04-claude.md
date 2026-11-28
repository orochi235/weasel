# animator.engine — blind review findings

## A throw from a just-rested target's `publish` is swallowed with no log and nothing stopped
- where: packages/animator/src/engine/offsets.ts:233 (createTargetBook `publish`, reached from `show` and `showNow`)
- scenario: a target with `show` and `publish` comes to rest (its last animation detaches, so `detach` moves it from `showing` to `rested`). The next frame's `show()` calls `shown(s, s.get())` for it, which queues `s.publish`, then runs `rested.clear()` **before** `publish()`. If that `publish` throws, the catch looks for its owner in `[...showing, ...rested]`. The target is in neither set any more, so `stop` never runs and, since only `stop` logs, nothing is logged. The error disappears without a trace. `showNow` has the same hole: `rested.delete(s)` runs before `publish()`, so a rested target whose publish throws there is also swallowed silently. What should happen: the throw is logged (`console.error`) like any other failed show or publish, whether or not some target still owns that function.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/offsets.ts
- size: function
- cause: owner lookup runs after `rested` was cleared; logging happens only inside `stop`
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

<!-- done: 1 findings, files read: 34 -->
