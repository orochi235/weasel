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

/** Hit on a tool-defined target (anchor, handle, segment, etc.) supplied
 *  via the tool's `hitOverride`. The `kind` string is the tool's own
 *  vocabulary; the dispatcher does not interpret it. */
export interface ToolHit {
  category: 'tool';
  kind: string;
  extra?: unknown;
}

/** Full discriminated union — every routed action's `ctx.target`. */
export type HitResult = EmptyHit | NodeHit | AffordanceHit | ToolHit;

/** Convenience: any hit that references a node (i.e., not EmptyHit). */
export type NodeRefHit = NodeHit | AffordanceHit;
