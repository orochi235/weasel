import type { NodeId } from '../../core/scene/types';

/** Common payload for any hit that references a scene node. */
export interface NodeRef {
  id: NodeId;
  pose: unknown;
  data: unknown;
  meta?: Record<string, unknown>;
}

/** No hit — pointer landed on the background. */
export interface EmptyHit {
  category: 'empty';
  kind: 'empty';
}

/** Hit on a scene node's body. */
export interface NodeHit extends NodeRef {
  category: 'node';
  kind: string;
}

/** Hit on a node's affordance chrome (handle, anchor, etc.). */
export interface AffordanceHit extends NodeRef {
  category: 'affordance';
  kind: string;
}

/** Full discriminated union — every routed action's `ctx.target`. */
export type HitResult = EmptyHit | NodeHit | AffordanceHit;

/** Convenience: any hit that references a node (i.e., not EmptyHit). */
export type NodeRefHit = NodeHit | AffordanceHit;
