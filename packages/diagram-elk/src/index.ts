/**
 * `@weasel-js/diagram-elk` — lay a diagram out with ELK, the Eclipse Layout
 * Kernel, once, and apply the answer the way the diagram package's own
 * layouts are applied.
 *
 * @packageDocumentation
 */
export { elkLayout, elkPlan, rootOptions, type ElkLayoutOptions, type ElkPlan, type ElkRunner } from './elkPlan';
export { toElk, type DrawnEdge, type ElkIndex } from './toElk';
