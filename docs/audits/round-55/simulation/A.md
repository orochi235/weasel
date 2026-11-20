## On a clock, `restart()` called from `onEnd` is swallowed: the run stays stopped while the hook believes it is running
- where: packages/simulation/src/useSteps.ts:48-49 (clock `onFrame` loop) with packages/simulation/src/useSimulation.ts:49-55 (`step`)
- scenario: `useSimulation({ clock, onEnd: () => sim.alphaTarget(0.3).restart() })`, or any `onEnd` that restarts. On the settling tick, `step` sets `runningRef = false` and calls `onEnd`. `restart()` sets alpha to 1, `runningRef = true`, and calls `steps.start()`. `running.current` is still `true` at that point, so `start` only leaves it `true`. Then `step` returns false and the loop in useSteps runs `running.current = false`. Result: alpha is 1, `runningRef` is true, but nothing steps again until something else calls `restart()`. A later clock swap does restart it, because `runningRef` is true, so the behavior also depends on unrelated re-renders. The frame-loop path works: `useScheduledFrame` clears `pending` before it calls the frame, so the `request()` made inside `onEnd` survives. The two paths give opposite answers to the same call.
- evidence: read
- severity: medium

## Clock mode runs every owed step synchronously in one frame, with no cap
- where: packages/simulation/src/useSteps.ts:46-50 (clock `onFrame` handler), packages/simulation/src/clockSteps.ts:32-40 (`owed`)
- scenario: a `seekable` clock (the default; the doc only says to declare `seekable: false`) is sought forward by an hour, or a host syncs a clock whose elapsed jumps. `owed` returns `floor(Δ / stepMs)`, about 216,000 steps at 1000/60. With `alphaTarget` held above `alphaMin` (the usual "keep warm during drag" setup), the run never settles. All of those `core.tick()` + `onTick` calls then run inside one frame callback, and the tab freezes for as long as that takes. The frame-loop path is bounded at one step per frame. The clock path has no per-frame budget and no clamp, so a large time jump turns into a hang rather than a skipped interval.
- evidence: read
- severity: medium

## A pinned node with a non-finite `fx`/`fy` writes NaN into `x`/`y`, skipping the finiteness guard the free path has
- where: packages/simulation/src/createSimulation.ts:74-76, 83-85 (`step`)
- scenario: a node with `fx: NaN` (for example a drag handler computing `fx` from a degenerate inverse transform), or `fx: Infinity`. The free branch resets a non-finite `x` to 0 so that non-finite geometry never reaches the renderer (the comment at :68-70 says why). The pinned branch assigns `n.x = n.fx` unchecked, so NaN reaches `onTick` consumers and the renderer, which is the case the guard exists to prevent. The NaN then also reaches the forces that read the node's position (for example a many-body force's quadtree).
- evidence: read
- severity: low

## Files read
packages/simulation/src/clockSteps.ts
packages/simulation/src/createSimulation.ts
packages/simulation/src/index.ts
packages/simulation/src/pbt.fixture.ts
packages/simulation/src/react.ts
packages/simulation/src/types.ts
packages/simulation/src/useSimulation.ts
packages/simulation/src/useSteps.ts

<!-- done: 3 findings, files read: 8 -->
