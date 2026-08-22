// ─── @weasel-js/d3 ──────────────────────────────────────────────────
// d3 bridge for weasel: data-join, chainable selection, and the transition
// chain — `d3Bind(...).join().transition()`, which needs `animator` in
// `BindOptions`.
//
// d3-force already integrates via the kit's `useSimulation` — its force
// protocol is contract-compatible, so `import { forceManyBody } from
// 'd3-force'` works without anything from this package.
export { d3Bind } from './bind';
export type {
  BindOptions,
  D3Binding,
  D3Selection,
  D3Transition,
} from './types';
