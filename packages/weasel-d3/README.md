# @orochi235/weasel-d3

d3 bridge for [weasel](https://orochi235.github.io/weasel/). Lets you drive a `useScene` from a d3-style data-join and (in Phase 2) animate updates via a `.transition()` chain over `useAnimator`.

`d3-force` already integrates via the kit's `useSimulation` — its force protocol is contract-compatible, so `import { forceManyBody } from 'd3-force'` works without anything from this package. This package is for the *non-force* d3 idioms: selection-based reconciliation and transitions.

## Status

**Phase 1 shipped.** Data-join + chainable selection. `.transition()` throws — Phase 2 (transition chain backed by the kit's animator) lands next.

## Quick taste

```ts
import { useScene } from '@orochi235/weasel';
import { d3Bind } from '@orochi235/weasel-d3';

const scene = useScene<{ color: string }, 'graph', RectPose>({
  systemLayers: [{ id: 'graph' }],
  initial: [],
});

// Reconcile `data` with the scene by id. Enter / update / exit emit
// `scene.add` / `scene.setPose` + `scene.update` / `scene.remove`
// inside one `scene.batch` (one undo entry).
const sel = d3Bind(scene, data, { key: d => d.id })
  .pose(d => ({ x: x(d), y: y(d), width: 12, height: 12 }))
  .data(d => ({ color: color(d) }))
  .join();

sel.each((d, id, i) => { /* iterate the merged selection */ });
sel.filter(d => d.kind === 'highlighted');  // narrow without re-mutating
```

Spec: [`docs/superpowers/specs/2026-05-17-d3-plugin-design.md`](../../docs/superpowers/specs/2026-05-17-d3-plugin-design.md).
