/**
 * A node's own `hidden` and `locked` flags: the kit ops that write them, and
 * the scene methods that record those ops. What the flags mean to every
 * reader is `nodeGates`.
 */
import type { Node, NodeId, RegisteredOp, Scene } from './types';

/** The two per-node flags. */
export type NodeFlag = 'hidden' | 'locked';

export interface NodeFlagsEnv<TData, TLayer extends string, TPose> {
  register(kind: string, handler: RegisteredOp<unknown>): void;
  requireNode(id: NodeId): Node<TData, TLayer, TPose>;
  record(kind: string, payload: unknown, label: string): void;
  /** Drop from the selection whatever is now hidden or locked. */
  narrowSelection(): void;
}

interface FlagPayload { id: NodeId; from: boolean; to: boolean }

/** Stored only while set, so a snapshot of an unflagged node carries neither. */
function write(node: { hidden?: boolean; locked?: boolean }, flag: NodeFlag, to: boolean): void {
  if (to) node[flag] = true;
  else delete node[flag];
}

const KIND: Record<NodeFlag, string> = { hidden: 'kit:setHidden', locked: 'kit:setLocked' };

/** Register `kit:setHidden` and `kit:setLocked`, and answer with the scene
 *  methods that record them. Neither is refused by a lock: like a layer's,
 *  a node's lock is what lifts it. */
export function createNodeFlags<TData, TLayer extends string, TPose>(
  env: NodeFlagsEnv<TData, TLayer, TPose>,
): Pick<Scene<TData, TLayer, TPose>, 'setHidden' | 'setLocked'> {
  for (const flag of ['hidden', 'locked'] as const) {
    env.register(KIND[flag], {
      apply: (p) => {
        const { id, to } = p as FlagPayload;
        write(env.requireNode(id), flag, to);
        if (to) env.narrowSelection();
      },
      revert: (p) => {
        const { id, from } = p as FlagPayload;
        write(env.requireNode(id), flag, from);
      },
    });
  }

  const set = (flag: NodeFlag, label: string) => (id: NodeId, to: boolean): void => {
    const from = env.requireNode(id)[flag] === true;
    if (from === to) return;
    env.record(KIND[flag], { id, from, to } satisfies FlagPayload, label);
  };

  return { setHidden: set('hidden', 'setHidden'), setLocked: set('locked', 'setLocked') };
}
