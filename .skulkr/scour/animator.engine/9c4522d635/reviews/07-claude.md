# Findings: animator.engine

## A paused handed-off run taken back loses its backward direction
- where: packages/animator/src/engine/handoff/run.ts:105 (launch → release)
- scenario: a run is handed to the compositor and plays backward, either through its own negative `setTimeScale` or through the animator's direction (`setTimeScale(-1)`, or `follow` going back). Its handle is paused, and then a hold opens on the target (`openHold` calls `s.handoff.release()`), or a main-thread animation starts on it. `release` reads `backward = table.rateOf(a) < 0`, but `rateOf` returns 0 while paused, so `backward` is false. `continueOnMainThread` then commits `at(local)` and starts the forward continuation, with its clock at 0. When playback resumes backward (the child's timeScale is set to the negative `a.timeScale`, or the global direction rerates it), that forward tween sits at clock 0 playing backward and ends at once at "its start", which is where the run stood. The move never goes back to the motion's start. It should take the backward branch: run the path back from `local` with the destination left committed.
- evidence: read
- severity: medium
- fix: packages/animator/src/engine/handoff/run.ts
- size: line
- cause: direction read through the pause-zeroed rate
- confidence: likely

## A throwing setter in holdRows' `leave` leaves the remaining rows held forever
- where: packages/animator/src/engine/holdRows.ts:51 (startHoldRows → leave)
- scenario: a rows hold over rows 0..9 is released or canceled with commit, and committing row 3 throws inside `leaveHold` → `absorb` → `s.set`. The `for` loop aborts, so rows 4..9 are never let go and `store.drop(layer)` never runs. Those rows keep `s.held > 0`, the animator still owns them (`owner` token, `live`), and their `parts` entries stay. `retire` swallows the throw and takes the row off the table, so nothing ever releases those holds again, and another animator's `check` on those targets keeps refusing. `leaveHold` says outright that a throwing setter "still takes the hold off the target", and core's own target `stop` uses `each` for this reason. `leave` should let go of every row through `each` and then drop the layer.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/holdRows.ts
- size: function
- cause: loop not guarded per item (no `each`)
- confidence: likely

## A throwing `release` leaves the hold registered on the table
- where: packages/animator/src/engine/holdAnimation.ts:45, packages/animator/src/engine/holdRows.ts:86 (release)
- scenario: `handle.release()` on a hold whose target setter throws while committing. `held.leave(...)` (or `leave(...)`) throws before `ctx.finish(id)`, so the row stays on the table with its hold already gone. `isActive(key)` still answers true, the `cancelKey` stays claimed (a `keepExisting` start then shares it), and `live()` keeps listing it until someone cancels it explicitly. `ctx.finish(id)` belongs in a `finally`.
- evidence: read
- severity: low
- size: line
- cause: finish not reached on throw
- confidence: sure

## A throwing `publish` on a target coming to rest is swallowed with no log
- where: packages/animator/src/engine/offsets.ts:222 (createTargetBook → publish)
- scenario: a target with a `publish` whose last animation just stopped is in `rested`. `show()` calls `rested.clear()` before `publish()`, and `showNow` runs `rested.delete(s)` before it. When that publish throws, the catch searches `[...showing, ...rested]` for the target, finds nothing, and the error disappears with no `console.error`, unlike every other throw this book catches. The catch should log the error once whether or not it finds a target to stop.
- evidence: read
- severity: low
- size: line
- cause: logging only inside the per-target stop
- confidence: sure

## The clock counted on read between frames double-counts up to a frame
- where: packages/animator/src/engine/core.ts:206 (createPacing → current), packages/animator/src/engine/frame.ts (tick)
- scenario: only compositor runs are active (`asleep`), and something reads `elapsed()` between frames at host time N, for example registering a new animation. `current()` adds `N - frameT` and sets `frameT = N`. The frame that follows arrives with a rAF timestamp t < N (Chrome stamps rAF with the frame's begin time, which can come before the tasks that ran in that frame). `frame.tick` computes `max(0, t - N) = 0` and then sets `frameT = t`, moving it backward. The next frame charges `t2 - t`, which counts the span t..N a second time. Every animation clock and every compositor placement then runs that much ahead. `tick` should not move `frameT` backward when that would charge time already counted.
- evidence: read
- severity: low
- fix: packages/animator/src/engine/frame.ts
- size: line
- cause: frameT rewound below a value counted on read
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
