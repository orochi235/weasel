# Findings: animator.engine

## A handed-off run whose target setter throws on end or cancel never lets go of its browser animation
- where: packages/animator/src/engine/handoff/run.ts:110 (launch → end), packages/animator/src/engine/handoff/run.ts:156 (seed.onCancel)
- scenario: An element target's setter throws when the run commits. `end` calls `s.set(...)` before `letGo`. The throw escapes the tick, and `retireThrown` → `table.retire` → `onCancel` calls `s.set(...)` again before `letGo`. That throw is caught as "threw again", and `letGo` is never reached. Result: the `Element.animate` animation (`fill: 'both'`) keeps showing on the element, `s.handoff` still points at the dead run (so later handoffs on that target are refused as "another animator"), and the run stays in `Handoffs.runs`. Because the run stays in `runs`, `keepsTime()` is true forever, `frameT` is never nulled, and `handoffs.frame()` re-places a dead animation every frame. The main-thread path guards exactly this case with `leaveTarget`'s try/finally ("a setter that throws there still stops its voices"); this path should do the same.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/handoff/run.ts
- size: function
- cause: commit not wrapped in try/finally around letGo
- confidence: likely

## A hold's `release` that throws while committing leaves its row on the table for good
- where: packages/animator/src/engine/holdAnimation.ts:43 (release), packages/animator/src/engine/holdRows.ts:83 (release)
- scenario: `release()` calls `held.leave(...)` / `leave(...)`, which can throw from the target's setter (`leaveHold` re-throws after its cleanup), then calls `ctx.finish(id)`. On a throw, `finish` is skipped. The hold is already gone from the target, but its table row remains: `idle`, `due: Infinity`, never ticked. It keeps its `cancelKey`, `isActive` says true, and `live()` lists it until someone cancels it explicitly. `finish` should run in a `finally`.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/holdAnimation.ts, packages/animator/src/engine/holdRows.ts
- size: line
- cause: finish not in finally
- confidence: likely

## holdRows' leave stops at the first row whose setter throws, leaving the other rows held and attached
- where: packages/animator/src/engine/holdRows.ts:52 (leave)
- scenario: Cancel or release a rows-hold where one row's target setter throws as `leaveHold` commits it. The `for (const row of [...held.keys()]) letGo(row, commit)` loop exits on that throw. The remaining rows keep `s.held > 0`, stay attached to this animator (`s.owner` is set, `s.live > 0`, so every other animator is refused), and keep their part in `s.parts`. The layer is never dropped from the store, so it is folded into those rows on every frame. The animation row itself is gone, because `retire` swallows the throw, so nothing can release them afterward. The target book's `stop` uses `each` for exactly this case; `leave` should too, and should drop the layer and refill in a `finally`.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/holdRows.ts
- size: function
- cause: loop not using each/finally
- confidence: likely

## A throw from a rested target's `publish` is swallowed with no log
- where: packages/animator/src/engine/offsets.ts:252 (createTargetBook → publish)
- scenario: `show()` clears `rested` before calling `publish()`. When a `publish` throws, the catch looks for its owner only in `showing` and `rested`. A target that just came to rest is in neither any more, so the loop finds nothing, `stop` (the only thing that logs) never runs, and the error disappears silently. The same happens in `showNow`, which deletes `s` from `rested` before publishing. The catch should log when no target matches.
- evidence: read
- severity: low
- size: line
- cause: rested cleared before publish's error lookup
- confidence: likely

## A closed-form spring played back to its start emits its voice's reading, not `from`
- where: packages/animator/src/engine/physicsAnimation.ts:101 (startPhysics tick)
- scenario: The comment promises "Played backward, it ends where it started, as a tween does." On the axes path it emits `axes.from(reader.motion().value)` instead. When `nowMs <= 0` arrives before the voice is rewound, that reading is one frame's step short of `from`. After a `setTarget` that switches held↔free, `codec.retarget` re-cues the voice, `spring.from` becomes the re-cue point, and a fully rewound voice reports that point instead of `o.from`. The tween path emits `o.from` exactly. The non-axes path emits `o.from` too, so the two paths answer the same question differently.
- evidence: read
- severity: low
- size: line
- cause: end value read from voice, not from o.from
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

<!-- done: 5 findings, files read: 34 -->
