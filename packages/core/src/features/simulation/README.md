# simulation

Continuous N-body simulation — force-directed layout, physics-ish motion.

`useSimulation` owns a RAF loop and a velocity-Verlet integrator. Forces are
pluggable functions matching **d3-force's protocol**, so d3-force's bundled
forces (`forceManyBody`, `forceLink`, `forceCenter`, …) work here without
translation. That compatibility is deliberate — don't invent a parallel force
signature.

## The kit doesn't write to your scene

`onTick(nodes)` fires after each integration step and **the consumer decides**
how, and whether, to write through to scene ops. The simulation holds its own
node array; it never touches the adapter.

That matters for undo: a simulation running at 60fps would otherwise produce 60
history entries per second. Typical wiring is to let the sim run free and commit
a single op when it settles (or on user action), not per tick.

## Alpha and settling

The usual d3 convention: `alpha` decays each tick by `DEFAULT_ALPHA_DECAY`
until it drops below `DEFAULT_ALPHA_MIN`, at which point the layout is
considered settled and the loop can stop. `DEFAULT_VELOCITY_DECAY` is the
per-tick friction.

Reheating (bumping alpha back up) is how you restart motion after a user drags
a node — otherwise a settled simulation stays settled.

## Related

`@weasel-js/d3` is the packaged integration if you want the d3 ecosystem wired
up for you rather than assembling forces by hand.
