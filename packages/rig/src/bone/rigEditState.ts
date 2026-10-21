import type { Skin } from '@weasel-js/animator';
import { createEmitter } from '@weasel-js/registry';
import type { NodeId } from '@weasel-js/core';
import type { PaintedSkins } from '@weasel-js/core';

/** What the bone and weight tools share between gestures: the joint they act on, and the
 *  weights a stroke has painted and not yet written. */
export interface RigEditState extends PaintedSkins {
  /** The active joint's name, or `null`. */
  active(): string | null;
  setActive(joint: string | null): void;
  /** Weights a stroke of the weight tool has painted and not yet written, by node. Empty
   *  between strokes. `useRigNode` given this state as `painting` binds them as they change. */
  painted(): ReadonlyMap<NodeId, Skin>;
  /** Replace the painted weights; `null` empties them. */
  paint(next: ReadonlyMap<NodeId, Skin> | null): void;
  /** Notified when the active joint or the painted weights change. Returns an unsubscribe. */
  listen(fn: () => void): () => void;
}

const NONE: ReadonlyMap<NodeId, Skin> = new Map();

/** A `RigEditState` with no joint active. Hand one to both tools so a joint picked with the
 *  bone tool is the one the weight tool paints. */
export function createRigEditState(): RigEditState {
  let active: string | null = null;
  let painted = NONE;
  const changed = createEmitter();
  return {
    active: () => active,
    setActive(joint) {
      if (joint === active) return;
      active = joint;
      changed.emit();
    },
    painted: () => painted,
    paint(next) {
      if ((next ?? NONE) === painted) return;
      painted = next ?? NONE;
      changed.emit();
    },
    listen: changed.subscribe,
  };
}
