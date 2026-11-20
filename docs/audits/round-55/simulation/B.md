## On a clock, `restart()` called from `onEnd` is lost: the simulation stays stopped while the hook believes it runs
- where: packages/simulation/src/useSteps.ts:48-50 (clock `onFrame` loop) with packages/simulation/src/useSimulation.ts:49-55 (`step`) and 64-68 (`startRaf`)
- scenario: `useSimulation({ nodes, forces, clock, onEnd: () => sim.alpha(0.5).restart() })` (re-heat on settle, a common d3 pattern). On the settling step, `step` sets `runningRef=false` and calls `onEnd`. `restart()` → `startRaf` sets `runningRef=true` and calls `steps.start()`, which sees `running.current` still `true` (useSteps clears it only after `step` returns), so it neither rebases nor changes anything. `step` then returns `false` and useSteps sets `running.current=false`. Result: no further steps run, `runningRef` says running, and `endedRef` has been re-armed. Without a clock the same `onEnd` works, because `useVisibleRaf` clears `pending` before it calls the frame, so the `request()` from `restart` survives. Should: a restart from inside `onEnd`/`onTick` resume stepping on a clock exactly as it does on the frame loop (e.g. `start` marks a restart that the loop honours, rather than the step's answer overwriting `running`).
- evidence: read
- severity: medium

## Files read
packages/simulation/src/clockSteps.ts
packages/simulation/src/createSimulation.ts
packages/simulation/src/index.ts
packages/simulation/src/pbt.fixture.ts
packages/simulation/src/react.ts
packages/simulation/src/types.ts
packages/simulation/src/useSimulation.ts
packages/simulation/src/useSteps.ts

<!-- done: 1 findings, files read: 8 -->
