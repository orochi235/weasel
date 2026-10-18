/**
 * `@weasel-js/diagram-elk` — lay a diagram out with ELK, the Eclipse Layout
 * Kernel, and apply the answer the way the diagram package's own layouts are
 * applied: once, or eased into by a live run.
 *
 * @packageDocumentation
 */
export { elkLayout, elkPlan, elkPlanner, rootOptions, type ElkLayoutOptions, type ElkPlan, type ElkPlanner, type ElkRunner } from './elkPlan';
export { toElk, type DrawnEdge, type ElkIndex } from './toElk';
