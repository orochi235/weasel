/**
 * What a node declares for its children — the unit scope they are shown in and
 * the clip they are drawn in — and what makes it a page or the page run: the
 * kit ops that write each, and the scene methods that record them.
 */
import type { UnitScope } from '@weasel-js/quantity';
import type { LockGuard } from './lockGuard';
import { sameValue } from './sameValue';
import type { Node, NodeClip, NodeId, RegisteredOp } from './types';
import type { PageInfo, PageRunInfo } from '../pages/pageNodes';

/** The scene methods that write a node's declared `units`, `clip`, `page` and `pageRun`, each one undo step. */
export interface SceneDeclaredFieldSetters {
  /** Declare the unit scope of container `id`, or clear it with `null`. */
  setUnits(id: NodeId, units: UnitScope | null): void;
  /** Declare the clip `id` draws its children in (see `SceneNode.clip`), or clear it with `null`. */
  setClip(id: NodeId, clip: NodeClip | null): void;
  /** Make `id` a page with `page` as its name and meta, or stop it being one with `null`. Page edits go through
   *  `pageEdits`, which keep the run laid out; this is the write under them. */
  setPage(id: NodeId, page: PageInfo | null): void;
  /** Make root `id` the page run with these settings, or stop it being one with `null`. */
  setPageRun(id: NodeId, pageRun: PageRunInfo | null): void;
}

/** What `createDeclaredFieldSetters` needs from the scene it is built into. */
export interface DeclaredFieldSettersEnv<TData, TLayer extends string, TPose> {
  register(kind: string, handler: RegisteredOp<unknown>): void;
  requireNode(id: NodeId): Node<TData, TLayer, TPose>;
  refuse: LockGuard<TLayer>['refuse'];
  record(kind: string, payload: unknown, label: string): void;
}

type Declared = { units?: UnitScope; clip?: NodeClip; page?: PageInfo; pageRun?: PageRunInfo };
type Field = keyof Declared;
interface DeclaredPayload { id: NodeId; from?: unknown; to?: unknown }

/** Stored only while declared, so a snapshot of a node declaring none carries neither. */
function write(node: Declared, field: Field, to: unknown): void {
  if (to === undefined) delete node[field];
  else (node as Record<Field, unknown>)[field] = to;
}

const KIND: Record<Field, string> = {
  units: 'kit:setUnits', clip: 'kit:setClip', page: 'kit:setPage', pageRun: 'kit:setPageRun',
};

/** Register the `KIND` ops, and answer with the scene methods that record them. */
export function createDeclaredFieldSetters<TData, TLayer extends string, TPose>(
  env: DeclaredFieldSettersEnv<TData, TLayer, TPose>,
): SceneDeclaredFieldSetters {
  for (const field of ['units', 'clip', 'page', 'pageRun'] as const) {
    env.register(KIND[field], {
      apply: (p) => { const { id, to } = p as DeclaredPayload; write(env.requireNode(id), field, to); },
      revert: (p) => { const { id, from } = p as DeclaredPayload; write(env.requireNode(id), field, from); },
    });
  }

  const set = (field: Field, label: string, verb: string) => (id: NodeId, to: unknown): void => {
    const from = (env.requireNode(id) as Declared)[field];
    env.refuse(id, verb);
    if (sameValue(from, to ?? undefined)) return;
    env.record(KIND[field], { id, from, to: to ?? undefined } satisfies DeclaredPayload, label);
  };

  return {
    setUnits: set('units', 'setUnits', 'set the units of'),
    setClip: set('clip', 'setClip', 'set the clip of'),
    setPage: set('page', 'setPage', 'set the page of'),
    setPageRun: set('pageRun', 'setPageRun', 'set the page run of'),
  };
}
