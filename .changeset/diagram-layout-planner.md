---
'@weasel-js/diagram': patch
'@weasel-js/diagram-elk': patch
---

A live layout and `DiagramView`'s `layout()` take a `LayoutPlanner`: an object whose `plan(graph, opts)` answers with a whole `LayoutPlan`, now or as a promise. The run asks it once, with the graph as it stands, and eases to the answer as it eases to `layered`'s, with the same route easing and the same moves, routes and ports reported to `onMove`. While the answer is pending, a newer request, `cancel`, `stop`, or a graph that moved or changed drops it, and `isRunning()` is true. A change of shape mid-run asks the planner again. A planner that rejects starts no run and reports the reason to the new `onError` option (`DiagramView`'s `live.onError`), or to `console.error` when that is unset; it is never left an unhandled rejection. `plannerPlan` lays a planner's graph out by footprint the way `planOf` does, and `DiagramLayout` names what `layout()` takes. `DiagramView` now fits again once a layout run settles, while the view is still its fit. `@weasel-js/diagram-elk` adds `elkPlanner(opts)`, ELK as a `LayoutPlanner`. Additive.
