I couldn't save `.skulk/out/findings.md`: permission to write it was declined. As the brief allows in that case, the full findings document is below. Two notes on scope: commit d4226fab… isn't in this clone, so I reviewed the working tree as I found it (HEAD 4c701b3803, with uncommitted edits in `animatorApi.ts` and `axes.ts`). I also read blits' `.d.ts` files and `cue.js`/`held.js` to check `push` and error handling.

# Audit round 33, area animator.engine: blind reviewer findings

## A user callback that throws inside the codec or hold pass leaves `framing` stuck true, and the animator never runs another frame
- where: packages/animator/src/engine/frame.ts:105-123 (createFrame `tick`)
- scenario: some user code throws while a frame reads its voices or holds. Examples: a tween's custom `easing`, which runs inside blits during `host.codec.frame(dt)`; a target tween's `interpolate`/`interpolator`, which is `codec.path`'s `at`; a function-valued `animator.hold({ value: () => … })`, which `targets.settle()` → `store.frame()` → `ask` calls. Only the per-animation ticks are wrapped in try/catch. A throw here leaves the frame after `framing = true` and before `framing = false` and `requestFrame()`, and `useAnimator`/`hostAnimator` don't catch it. After that, `framing()` answers true forever:
  - `table.register` never asks for a frame (`!host.framing()`).
  - `ctx.touch` only adds the target to `touched`.
  - `ctx.wake` does nothing.
  - The voice that threw stays in the codec, so any frame that does run throws again.

  Every animation on that animator stops for good. `tickEach` and `TargetBook.shown` both say a throw must not stop the frame loop for everything; this path should catch, retire the offender and reset `framing` in a `finally`.
- evidence: read
- severity: medium

## `holdRows` leaves the rows it already held held forever when a later row throws
- where: packages/animator/src/engine/holdRows.ts:36-46 (startHoldRows)
- scenario: `animator.holdRows({ table, rows: [0, 1, 99] })` on a 3-row table, or a list where row 2's target is being moved by another animator. Rows 0 and 1 go through `enterHold`: their target is attached and owned by this animator, `held` goes up, they join the layer, and the `part` is added. Then `table.target(99)` (`index.check`) or `attach` throws. Nothing was registered and no handle was returned, so nothing ever calls `letGo` for rows 0 and 1. They show the hold's layer at weight 1 for good, they stay attached (another animator gets "being moved by another animator"), and the store counts them as held. The `cancelKey` interrupt has also already run. Validate every row first, or undo the rows already entered when one throws.
- evidence: read
- severity: medium

## A compositor tween with `ms: Infinity` commits `to`, then throws from `Element.animate`
- where: packages/animator/src/engine/handoff/start.ts:46,64-68 (handOffTween); handoff/run.ts:33-38 (animate); handoff/motion.ts:139-143 (sampleTimes)
- scenario: `animator.tween({ target: elementTarget, to, ms: Infinity, compositor: 'prefer' })`. `!(o.ms > 0)` lets Infinity through. `sampleTimes(Infinity, …)` gives `Infinity * 0 / n = NaN` for the first time and `Infinity / Infinity = NaN` for the offsets. The keyframes come out as `offset: NaN` with `translateX(NaNpx)`, and `Element.animate` throws a TypeError. By then the key has been interrupted and `s.set(o.to)` has committed the destination, but no animation is registered. The target's committed value has jumped to `to`, nothing shows it, and `'prefer'` never falls back. On the main thread an infinite tween is valid and "never finishes" (`checkTweenMs`). `handOffTween` should refuse a non-finite `ms` and fall back, as it does for `ms <= 0`.
- evidence: read
- severity: medium

## After any `due` animation wakes, a frame no longer ticks animations in the order they registered
- where: packages/animator/src/engine/schedule.ts:114-131 (ticks), :121-127
- scenario: A registers with `due: 50` (seq 0) and B is ticked every frame (seq 1). On the frame A wakes, `ticks()` merges correctly and returns [A, B], but `every.add(a)` appends A to the Set, so `every` is now {B, A}. The next frame's `steady = [...every]` comes out as [B, A], so B ticks, writes and finishes (`onDone`) before A. The merge loop also assumes `steady` is sorted by `seq`, so later wakes interleave wrongly. The interface and `ActiveAnimation.seq` say "a frame ticks in this order" (registration order). `frame.due.test.ts:143` only checks the frame where the wake happens, not the one after. Fix: insert the woken animation in seq order, or sort `steady` by seq.
- evidence: read
- severity: low

## `cancelAll` reports a `cancel` for an animation already reported ended, where `retire` does not
- where: packages/animator/src/engine/table.ts:192-204 (cancelAll), vs :111 (retire)
- scenario: a tween's `onDone` calls `animator.cancelAll()`. `onDone` runs after `reportEnd` sets `ended`, and the tween stays on the table until the frame's ticks are done. `cancelAll` walks the table, finds the finished tween and emits `{ type: 'cancel' }` for it, so a `watch` listener hears `end` and then `cancel` for the same animation. From the same `onDone`, `handle.cancel()` or `cancelKey` goes through `retire`, which skips the event for an `ended` row. One question gets two answers; `cancelAll` should skip `a.ended` rows when it emits.
- evidence: read
- severity: low

## The compositor path interrupts the key before it validates `to`, `from` and the spring constants; the main-thread path validates first
- where: packages/animator/src/engine/handoff/start.ts:47-54 (handOffTween), :84-93 (handOffPhysics)
- scenario: `animator.spring({ target: el, to: wrongShape, cancelKey: 'k', compositor: 'prefer' })`, or the same with `damping: 0`. `begin()` runs `ctx.interrupt('k', …)` first, retiring and committing whatever held `k`. Only then do `axesFor(…'to')` and `constantsFor` throw. Without `compositor`, `startOffsetPhysics`/`startOffsetTween` run `axesFor` and `constantsFor` before the interrupt, so the bad call throws and leaves the running animation alone. The same bad input does different things depending on the `compositor` option.
- evidence: read
- severity: low

## A spring interrupting a target tween that has `interpolate`/`interpolator` inherits zero velocity
- where: packages/animator/src/engine/codec.ts:236-238 (own, path voices); used by core.ts:122-130 (velocityUnder)
- scenario: a target tween with an `interpolator` runs as a codec `path` voice, and `codec.own` always answers velocity zeros for it. A `spring({ target, to, cancelKey })` that interrupts it mid-flight reads `velocityUnder` and gets 0, so it starts from rest with a visible jolt. The same tween without an interpolator (a `tween` voice) hands over its real velocity. Target-spring interruption is meant to carry the summed velocity, and the handoff run does compute one (`seed.velocity`). The path voice could answer a finite-difference velocity, as `tweenMotion.velocity` does.
- evidence: read
- severity: low

## `retire`/`cancelAll` don't guard `onCancel`, so a throwing target setter leaves rows on the table and aborts the cancel partway
- where: packages/animator/src/engine/table.ts:105 (retire), :195-200 (cancelAll)
- scenario: a target whose `set` throws (a validating setter) has a tween running on it, and `animator.cancelAll()` is called (for example on unmount). The tween's `onCancel` → `leave(true)` → `commitOffset` → `absorb` → `s.set` throws. `cancelAll` stops in the middle of its loop:
  - Rows already visited have had their voices stopped but stay on the table, because `roster.clear()` never runs.
  - Later rows are not canceled.
  - `cleared()` (`frameT = null`, show) and `host.halt()` never run.
  - No completion or cancel reports go out.

  In `retire` the throw skips `codec.stop`, `remove` and `fireCompletion`, and `cancelByKey`'s loop stops too. The animator does guard `show` throws and setter throws at start (`commitOrLeave`), but not here.
- evidence: read
- severity: low

## Files read
packages/animator/src/engine/animatorApi.ts
packages/animator/src/engine/axes.ts
packages/animator/src/engine/codec.ts
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

<!-- done: 8 findings, files read: 33 -->