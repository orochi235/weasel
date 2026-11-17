---
'@weasel-js/core': major
---

`@weasel-js/core` and `@weasel-js/core/math` no longer re-export the simulation; import it from `@weasel-js/simulation`.

`createSimulation`, `DEFAULT_ALPHA_DECAY`, `DEFAULT_ALPHA_MIN`, `DEFAULT_VELOCITY_DECAY` and the types `RunningSimulation`, `Simulation`, `SimulationForce`, `SimulationNode`, `SimulationOptions` and `UseSimulationOptions` come from `@weasel-js/simulation`; `useSimulation` comes from `@weasel-js/simulation/react`. Core no longer depends on the package, so add it to your own dependencies.

```ts
// before
import { createSimulation, useSimulation, type SimulationNode } from '@weasel-js/core';
// after
import { createSimulation, type SimulationNode } from '@weasel-js/simulation';
import { useSimulation } from '@weasel-js/simulation/react';
```

<!-- entry: breaking api -->
