import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

/** The part of a scene a record restores poses through. */
interface RecordScene<TPose> {
  get(id: NodeId): { pose: TPose } | undefined;
  setPose(id: NodeId, pose: TPose): void;
}

/**
 * What a cascading `setPose` and the batch it runs in tell each other.
 *
 * A cascade moves descendants by the container's delta, worked out from the
 * poses in the scene at that moment. Replayed backwards that delta is worked
 * out against different poses, so a batch that also poses a descendant itself
 * comes back wrong. A recorded op's inverse does not work the cascade out
 * again: it puts back every pose the op changed.
 */
export interface CascadeRecord<TPose> {
  /** False while an inverse runs, which restores descendants itself. */
  cascades(): boolean;
  /** Called before each pose write, the op's own or a cascade's. */
  note(id: NodeId, before: TPose): void;
  /** `ops`, each remembering the poses it changes so that its inverse can
   *  restore them. */
  recorded(ops: readonly Op[]): Op[];
}

export function cascadeRecord<TPose>(scene: RecordScene<TPose>): CascadeRecord<TPose> {
  let noting: Map<NodeId, TPose> | null = null;
  let restoring = false;

  const forward = (op: Op, before: Map<NodeId, TPose>): Op => ({
    name: op.name,
    args: op.args,
    label: op.label,
    get coalesceKey() { return op.coalesceKey; },
    elideNoop: op.elideNoop,
    apply(adapter) {
      before.clear();
      const outer = noting;
      noting = before;
      try {
        return op.apply(adapter);
      } finally {
        noting = outer;
      }
    },
    invert: () => backward(op, before),
  });

  const backward = (op: Op, before: Map<NodeId, TPose>): Op => {
    const inverse = op.invert();
    return {
      name: inverse.name,
      args: inverse.args,
      label: inverse.label,
      get coalesceKey() { return inverse.coalesceKey; },
      apply(adapter) {
        const outer = restoring;
        restoring = true;
        try {
          const result = inverse.apply(adapter);
          for (const [id, pose] of before) if (scene.get(id)) scene.setPose(id, pose);
          return result;
        } finally {
          restoring = outer;
        }
      },
      invert: () => forward(op, before),
    };
  };

  return {
    cascades: () => !restoring,
    note(id, before) {
      if (noting && !noting.has(id)) noting.set(id, before);
    },
    recorded: (ops) => ops.map((op) => forward(op, new Map())),
  };
}
