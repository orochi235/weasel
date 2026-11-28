# Findings: animator.engine

## `cancelAll` cancels the frame that an animation started by its own reports asked for
- where: packages/animator/src/engine/animatorApi.ts:150 (createAnimatorApi, `cancelAll`)
- scenario: `animator.watch((e) => { if (e.type === 'cancel') animator.tween({...}) })`, then `animator.cancelAll()`. `table.cancelAll` runs `cleared()` and then emits the `cancel` events. The listener registers a tween, and `register` calls `requestFrame` because no frame is running. Control comes back to `cancelAll`, which then calls `host.halt()` (`cancelFrame`) and drops that request. The new tween sits on the table with no frame coming and never ticks or finishes until something unrelated asks for a frame. The same happens to anything started from a completion watcher (`fireCompletion`) or from a target's `show`/`publish` called by `cleared()`. Expected: the halt covers only the frames of what was canceled, so an animation registered after the table was emptied still gets its frame.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/animatorApi.ts, packages/animator/src/engine/table.ts
- size: line
- cause: halt runs after the reports, not before them (or not only when the table is empty)
- confidence: likely

## Another animator's start takes this animator's compositor run back before refusing the target
- where: packages/animator/src/engine/offsetTween.ts:22 (startOffsetTween); same order in packages/animator/src/engine/offsetPhysics.ts:84 (startOffsetPhysics) and packages/animator/src/engine/holds.ts:160 (openHold)
- scenario: animator A hands a tween on element target `t` to the compositor. `launch` (handoff/run.ts) sets `s.handoff` but never calls `targets.attach`, so `s.owner` stays null. Animator B then starts a tween on `t`. B's `refusal` sends it to the main thread, and `startOffsetTween` runs `ctx.targets.check(s)`, which passes because the owner is null. B then calls `s.handoff?.release()`, which takes A's run back onto A's main thread: `continueOnMainThread` runs `startOffsetTween` on A's context, which attaches `t` with A's owner token. Only after that does B's `ctx.targets.attach(s)` throw "this target is being moved by another animator". B is refused correctly, but only after it has already moved A's run off the compositor (and, with a `cancelKey`, after it has run B's interrupt). Expected: the ownership refusal comes before any side effect, which means a handed-off target counts as owned.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/offsets.ts, packages/animator/src/engine/handoff/run.ts
- size: function
- cause: a handed-off run does not take ownership of its target, so `check` cannot see it
- confidence: likely

## A coast on a target with an explicit `from` is offset by what waits beside the target's holds
- where: packages/animator/src/engine/offsetPhysics.ts:95 (startOffsetPhysics, `committed`/`start`)
- scenario: a target is held by a hold covering some axes, and an earlier animation stopped while held, which left `s.beside` nonzero. A decay or coast (`to` null) then starts on the target with `from: F`. Because `dest` is null, `committed = before` leaves `beside` out (the spring branch uses `takeUp`, which includes it), and nothing clears `beside` (no `commitOver`). So `start = F - before`, while `readTarget` still adds `beside` (target.ts:261). The target shows `F + beside`, not `F`, and when the coast ends `keep` folds the offset into `beside` again. A spring, or a tween started with the same `from`, starts at `F`.
- evidence: read
- severity: low
- size: line
- cause: the coast branch reads the committed value without `beside`
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
