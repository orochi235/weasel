---
'@weasel-js/simulation': minor
---

A simulation can run in three dimensions: `createSimulation({ dimensions: 3 })` moves `z` as well, under d3-force-3d's node shape.

`SimulationNode` gains `z`, `vz` and `fz`, read only when `dimensions` is 3 (it is 2 by default, and may be 1). A three-dimensional run primes a missing `z` to 0, and a force's `initialize` receives the dimensions as its third argument, as d3-force-3d's forces expect. `SIMULATION_AXES` lists the position, velocity and pin fields of each axis, and `sim.dimensions` reads the setting back.

<!-- entry: rank=5 new api -->
