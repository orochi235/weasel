## A call refused for another animator's target first takes that animator's compositor run back and drops its `beside`
- where: packages/animator/src/engine/offsetTween.ts:24 (startOffsetTween); also packages/animator/src/engine/offsetPhysics.ts:96-103 (startOffsetPhysics) and packages/animator/src/engine/holds.ts:142 (openHold)
- scenario: animator A hands a tween on element target `t` to the compositor (`s.handoff` set, `s.owner` = A). Animator B then calls `tween({ target: t, … })`. `eligible` refuses ("another animator is moving its target"), so B falls to `startOffsetTween`, which calls `s.handoff?.release()` — A's own `release` closure, which cancels A's browser animation and starts a main-thread continuation on A — and `takeUp(s)`, which clears A's `beside` without absorbing it, before `ctx.targets.attach(s)` throws "being moved by another animator". B's call fails as it should, but A's run has been forced off the compositor and any offset A kept beside its holds is lost (the target jumps). The same order holds in `startOffsetPhysics` (release, takeUp, then attach) and `openHold` (release, then `enterHold` → attach). The ownership check should come before anything that touches the target's state.
- evidence: read
- severity: medium

## A target's `publish` that throws escapes the frame unguarded and stops the frame loop
- where: packages/animator/src/engine/offsets.ts:194-197 (createTargetBook publish/show), reached from packages/animator/src/engine/frame.ts:144
- scenario: a target made with a `publish` callback that throws (user code, `target.ts:48`). `shown` guards `s.show` with a try/catch whose comment says a throw out of a frame "would stop the frame loop, and every animation with it", but `publish()` runs `p()` unguarded. In `frame.tick` the call `host.targets.show()` is after the try block, so the throw leaves `tick` before `table.awake` is checked and no next frame is requested: every running animation freezes. `publishes.clear()` is also skipped, so the next `show`/`showNow` calls the throwing publish again. It should be guarded as `show` is (stop what moves the targets publishing through it).
- evidence: read
- severity: medium

## `compositor: 'require'` on a spring that starts at rest throws only after interrupting what held its key
- where: packages/animator/src/engine/handoff/start.ts:120-121 (handOffPhysics)
- scenario: `spring({ target, to, cancelKey: 'k', compositor: 'require' })` with the target already at `to` and no velocity. `begin` runs `ctx.interrupt('k', seed)` (retiring the animation holding `k`), then `motion.ms <= 0` hits `refuse(o, 'it starts at rest')`, which throws. The caller gets an error and nothing runs, yet the animation under `k` was already canceled. `begin`'s own doc says input checks run in `ahead` "so a call refused for it leaves what holds its key running"; this refusal is decided from the call's own input but after the interrupt. The at-rest check belongs in `ahead` (it needs only `start`, `velocity`, `dest`, constants, all read there).
- evidence: read
- severity: low

## A throwing interrupt in `register` leaks the codec voice a plain tween or spring started ahead of it
- where: packages/animator/src/engine/table.ts:183 (register), with packages/animator/src/engine/tweenAnimation.ts:38-44 (startTween) and packages/animator/src/engine/physicsAnimation.ts:56-74 (startPhysics)
- scenario: `startTween`/`startPhysics` cue their codec voice (`codec.tween`/`codec.spring`) before `ctx.register`, and the interrupt of their `cancelKey` happens inside `register` via `cancelByKey`. If the animation holding the key has an `onCancel` that throws (e.g. a target setter throwing as an offset tween commits), `retire` rethrows, `each` rethrows, and `register` exits before `roster.add`. Nothing ever calls `codec.stop(id)` for the new id: the voice stays in `voices`, its slot stays in its lane and is pulled every frame, `voiceCount()` grows by one per such call.
- evidence: read
- severity: low

## A handed-off run taken back stays on the table forever when its continuation leaves on unmount
- where: packages/animator/src/engine/handoff/run.ts:128-130 (launch, seed.tick)
- scenario: a compositor run is taken back (`release`), so `child` is a main-thread animation and the run's row is deferred to `Infinity`. The host unmounts; on the next frame `tickEach` ticks everything (`waiting > 0 && tripwire()`). The child's tick sees `tripwire()`, leaves and returns true, and is finished without calling its `onDone`, so the parent's `ctx.finish(id)` never runs. The parent's tick returns `false` at `if (child) return false` before its own `tripwire()` check, so it never leaves: `isActive()` stays true and the row is never removed after unmount. The tripwire check should come before the `child` early return (or the child's leaving should end the parent).
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

<!-- done: 5 findings, files read: 34 -->
