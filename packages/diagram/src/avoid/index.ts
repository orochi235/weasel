/**
 * The obstacle-avoiding router as arithmetic: plain obstacles and connectors
 * in, routes out. Nothing here reads a scene; `sceneInput` and `install` do.
 */
export { AVOID_DEFAULTS } from './types';
export type { AvoidEdge, AvoidEnd, AvoidInput, AvoidObstacle, AvoidOptions, AvoidPort } from './types';
export { createAvoidRouter } from './router';
export type { AvoidRouter, AvoidRoutes, AvoidUpdateOptions } from './router';
export { routeHolds } from './holds';
