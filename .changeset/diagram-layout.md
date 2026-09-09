---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

Layout: `layered`, `tree` and `force`, and the action that runs one.

A layout is a plain function of the graph — no scene, no ops, no history. It
hands back the new top-left for every node that **moves**, and a node already
standing where the layout wants it is absent from the answer, so re-running a
layout on an arrangement it produced writes nothing and pushes no undo entry.

Three rules keep a re-layout from scrambling a diagram someone has arranged.
There is no RNG anywhere in the path, so the same graph always lays out the same
way. Within-rank order is seeded from where the nodes already sit on the cross
axis rather than from crossing-minimization, so two branches an author dragged
into an order come back in it. And a node carrying `pinned: true` never moves,
with the rest of the layout translated to sit around it — with no pin, the
layout lands on the diagram's own bounding box rather than at the origin.

`layered` ranks by longest path, breaking cycles with a depth-first walk in node
order so a loop draws as an edge running back up the page. `tree` centers a
parent over its children's block; a graph that is not a tree still lays out,
since roots are the nodes nothing points at and anything the walk cannot reach
becomes a root of its own. `force` is an iterative relaxation seeded from the
current positions — **the one layout that is not idempotent**, since re-running
it keeps relaxing.

`buildGraph` reads the adjacency index from the same participant source the port
affordance takes, per invocation rather than maintaining one. `createLayoutAction`
rebuilds it on each press and writes the whole move as a single `scene.batch`,
carrying a container's whole subtree — `setPose` does not cascade, and a built
body would otherwise walk out from under its own label rows.

In core, `createSimulation` is the velocity-Verlet integrator with no clock
attached: `tick()` is the only thing that moves a node, so a pure function can
run a whole relaxation and read the result. `useSimulation` is now that
integrator on a frame loop and is otherwise unchanged. `SimulationCore` and
`SimulationOptions` name the halves, and forces can be handed a seeded `random`
in place of `Math.random`.
