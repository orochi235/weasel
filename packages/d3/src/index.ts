// ─── @weasel-js/d3 ──────────────────────────────────────────────────
// d3 bridge for weasel. Currently ships Phase 1: data-join + chainable
// selection. Phase 2 (transition chain) lands separately.
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
