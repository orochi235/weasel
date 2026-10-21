/**
 * Where each of the diagram's scene edit passes runs among the others
 * (`scene.addEditPass`'s `order`). Each pass hears what the ones before it
 * wrote: markers are placed before routing sees them, routes before labels
 * dodge them, and line jumps last, on the routes as they end up.
 */
export const DIAGRAM_PASS_ORDER = { offPage: 100, avoid: 200, labels: 300, hops: 400 } as const;
