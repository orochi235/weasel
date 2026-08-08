import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

let counter = 0;

/**
 * Mint a fresh `NodeId` for a node an action materializes itself.
 *
 * Actions that build `createInsertOp` ops can't let the scene generate the id
 * the way `scene.add(spec)` does — the op carries a whole node, so the id has
 * to exist before the op does. Mirrors the scene's own `n{counter}-{random}`
 * scheme, which `core/scene/scene.ts` keeps module-private.
 */
export function freshNodeId(): NodeId {
  return asNodeId(`n${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}
