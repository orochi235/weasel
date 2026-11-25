# Audit round 68: animator.engine findings

## A target tween whose `interpolator`/`interpolate`/`easing` throws at its start leaves the target attached, its destination committed, and a dead `Behind` on it
- where: packages/animator/src/engine/offsetTween.ts:34-47 (startOffsetTween); packages/animator/src/engine/codecVoice.ts:124-125 (joinPath)
- scenario: `animator.tween({ target, to, ms: 300, interpolator: () => () => { throw new Error() } })` (or an `easing` that throws at 0). `ctx.targets.attach(s)` (line 34) and `commitOrLeave(..., o.to)` (line 35) run first; then `offsetAt(0)` at line 40, and again `s.at(0)` / `s.at(1)` inside `joinPath` (unguarded, unlike the per-frame `fault` path) call the user's function and throw. Nothing detaches the target or rolls back the commit: `s.live` stays 1 and `s.owner` stays set forever, so the committed value has jumped to `to` with no animation, the target is never shown at rest again, compositor hand-off refuses it for good ("another animator is moving its target"), and if the throw is in `joinPath` the `Behind` pushed by `goBehind` at line 43 stays in `s.behind` with an `own()` that dereferences `codec.own(id)!` on a voice that never existed. unruled.md (round 33) says a throw at the start goes to the caller; it does not say the target is left half-started. Expected: the start-time throw undoes attach/commit/goBehind (as `commitOrLeave` does for the setter) or the path is sampled before attaching.
- evidence: read
- severity: medium

## `takeUp` clears what waits beside the committed value before `attach`/`commitOrLeave` can refuse, so a refused start loses it
- where: packages/animator/src/engine/offsetTween.ts:26 then :34-35 (startOffsetTween); packages/animator/src/engine/offsetPhysics.ts:98 then :103-104 (startOffsetPhysics)
- scenario: a target with `s.beside` set (an offset canceled under a hold) gets a new tween/spring whose `attach` throws ("this target is being moved by another animator") or whose setter throws in `commitOrLeave`. `takeUp(s)` has already called `setBeside(s, null)` (offsets.ts:148), so the throw leaves the target without its beside offset — the shown value jumps when the hold leaves. In the other-animator case it mutates a target that belongs to a different animator (and its row table's `beside`) before refusing. Expected: read `beside` without clearing it until the start can no longer fail.
- evidence: read
- severity: low

## A throw from `owner.stop` inside `targets.show()` escapes the frame after `framing` is cleared, so no next frame is requested and the loop stops
- where: packages/animator/src/engine/frame.ts:143-151 (createFrame tick); packages/animator/src/engine/offsets.ts:182-191 (shown); packages/animator/src/engine/core.ts:89-92 (stop)
- scenario: a target's `show` throws; `shown` catches it and calls `owner.stop(s)`, which retires every animation on it. `table.retire` rethrows an `onCancel` throw (table.ts:162) — e.g. the offset animation's `leave(true)` committing through a setter that also throws. That throw leaves `show()` (outside the frame's try at frame.ts:120-142), so `rested.clear()`, the rest of the targets' shows, `afterShow`, subscribers and `if (table.awake) host.requestFrame()` are all skipped: every other running animation freezes until something else asks for a frame. The comment at offsets.ts:186 says the point of catching is to keep the frame loop alive; frame.ts:138 guards the same case for the ticks section only. Also `core.ts:90` stops at the first throwing retire, leaving later animations on the target and its `parts` unrun.
- evidence: read
- severity: low

## Hold starts refuse bad `axes`/`value` after they have already interrupted the key's holder
- where: packages/animator/src/engine/holdRows.ts:25 then :54 (startHoldRows, `coverOf` inside the try); packages/animator/src/engine/holdAnimation.ts:23 then :24 (startHold → openHold's `axesFor`/`coverOf` at holds.ts:143,154)
- scenario: `animator.holdRows({ table, cancelKey: 'k', axes: ['nope'] })` while another hold holds `'k'`: `ctx.interrupt('k', seed)` retires the existing hold (committing what it showed), then `coverOf` → `axisIndexes` throws "names "nope" on a target…"; the call fails and the interrupted hold is gone with nothing in its place. holdRows.ts:15 states the intent ("so a row not in the table refuses the call before it interrupts"); the axes check and the per-row `attach` refusal break it. Same for `animator.hold({ cancelKey: 'k', value: wrongShape })`. Expected: validate `axes`/`value` before `ctx.interrupt`, as `startOffsetTween`/`startOffsetPhysics` read their `to`/`from` first.
- evidence: read
- severity: low

## `compositor: 'require'` physics at rest throws after interrupting, as do the begin-time refusals
- where: packages/animator/src/engine/handoff/start.ts:120-121 (handOffPhysics); :43-45 (begin)
- scenario: `animator.spring({ target, to: here, cancelKey: 'k', compositor: 'require' })` where the spring starts at rest: `begin` has already run `ctx.interrupt('k', seed)` (line 42), then `refuse(o, 'it starts at rest')` throws. The animation holding `'k'` is retired (and an `interrupt` event names a `by` id that never registers) and nothing replaces it. `motion.ms` depends only on `start`, `velocity`, `dest` and constants, all of which `ahead` reads before the interrupt, so the check could run there; begin's comment says `ahead` exists so "a call refused for it leaves what holds its key running".
- evidence: read
- severity: low

## A handed-off tween whose `interpolator`/`easing`/`style` throws while keyframes are sampled leaves its destination committed with no animation
- where: packages/animator/src/engine/handoff/start.ts:78 then :82 (handOffTween → launch → animate at run.ts:36-37)
- scenario: `s.set(o.to)` runs at line 78 and the interrupt has run in `begin`; `launch` then samples `motion.at(t)` (the user's `interpolator` result / `easing`) and `binding.style` for up to 600 keyframes. A throw there leaves the target committed at `to` with no registered animation and the interrupted one already gone: the element snaps to the destination on its next show. The main-thread path (`startOffsetTween`) at least has `commitOrLeave`; here nothing restores the committed value.
- evidence: read
- severity: low

## Compositor runs are placed against `clock.frameT`, which is on the host's `now()` clock, not the document timeline `Element.animate` uses
- where: packages/animator/src/engine/core.ts:204 (createPacing `host.wall`)
- scenario: `wall()` answers `clock.frameT ?? wallNow()` whenever no outside clock drives the frames. `frameT` comes from frame timestamps / `host.now()` (core.ts:64, frame.ts:118), and useAnimator accepts a custom `now` (useAnimator.ts:76). With a host clock on another origin (e.g. `now: Date.now`, or jsdom where frame.ts:113-115 notes the two start ~600 ms apart), `handoffs.place` sets `animation.startTime = wall() - own / rate` on the wrong timeline, so the browser shows the run far ahead of or behind the animator's own clock; before the first frame (frameT null) it uses the document timeline instead, so the two branches answer the same question on different clocks. `CoreHost.wall` is documented as "now on the document timeline" but is consulted only when `frameT` is null.
- evidence: read (the misplacement under a custom `now` is inference)
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

<!-- done: 7 findings, files read: 34 -->
