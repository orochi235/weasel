---
'@weasel-js/simulation': major
'@weasel-js/core': major
---

`Simulation` is now the type `createSimulation` returns, and the frame-loop handle `useSimulation` returns is `RunningSimulation`.

The old `SimulationCore` is `Simulation`, and the old `Simulation` is `RunningSimulation`. `@weasel-js/core/math` re-exports both under the new names.

```ts
// before
const core: SimulationCore<N> = createSimulation({ nodes });
const sim: Simulation<N> = useSimulation({ nodes });
// after
const core: Simulation<N> = createSimulation({ nodes });
const sim: RunningSimulation<N> = useSimulation({ nodes });
```

<!-- entry: breaking api -->
