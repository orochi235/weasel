/**
 * The scene's touched-ids feed: which nodes its changes reached since a
 * reader's last look, so an index over the scene updates those alone.
 */
import type { DependentsIndex } from './dependents';
import { nodeMemoGeneration } from './nodeMemo';
import { outsideGeneration } from './outsideReads';
import { TOUCH_CHILDREN, TOUCH_CONTENT, TOUCH_ORDER, type TouchJournal } from './touchJournal';
import type { NodeId } from './types';

/** What changed in a scene since a token: see {@link SceneTouchesMembers.changesSince}. */
export interface SceneTouches {
  /** Pass this to the next call. */
  readonly token: number;
  /**
   * Every node whose paint, pose or box can have changed — the ones an op
   * named, every node deriving from one, every descendant, each container
   * hugging its children above one, and each node a pose preview or a scroll
   * set or cleared. Ids no longer in the scene are among them. `'unknown'`
   * when the journal no longer reaches back to the token, or something
   * outside the nodes changed: start over from the whole scene.
   */
  readonly ids: ReadonlySet<NodeId> | 'unknown';
  /** Containers whose children changed, `null` standing for the roots. Empty under `'unknown'`. */
  readonly parents: ReadonlySet<NodeId | null>;
  /** Whether the render order can have moved. Always true under `'unknown'`. */
  readonly structural: boolean;
}

export interface SceneTouchesMembers {
  /**
   * What changed since `token`, a token an earlier call answered. Without one,
   * or once the journal no longer reaches back that far, `ids` is `'unknown'`.
   * The journal is bounded, so a reader that falls far behind starts over, as
   * it would on its first read.
   */
  changesSince(token?: number): SceneTouches;
}

/** The view state one session holds: its pose previews and its scroll offsets. */
interface ShownSource {
  getGeneration(): number;
  ids(): Iterable<NodeId>;
}

export interface SceneTouchesEnv {
  journal: TouchJournal;
  nodes: ReadonlyMap<NodeId, { parent: NodeId | null; children?: readonly NodeId[] }>;
  dependents: Pick<DependentsIndex, 'transitiveDependentsOf' | 'isEmpty'>;
  childDerived: ReadonlySet<NodeId>;
  /** Call `fn` with each session's previews and scroll. */
  eachShown(fn: (source: ShownSource) => void): void;
}

const EMPTY: ReadonlySet<never> = new Set();

export interface SceneTouchesFeed extends SceneTouchesMembers {
  /** Record what an op of `kind` with `payload` touched. */
  noteOp(kind: string, payload: unknown): void;
}

export function createSceneTouches(env: SceneTouchesEnv): SceneTouchesFeed {
  const { journal, nodes } = env;
  /** Each preview or scroll table's generation and ids when last looked at. */
  const shown = new WeakMap<ShownSource, { at: number; ids: NodeId[] }>();
  let ambient = [nodeMemoGeneration(), outsideGeneration()];

  function noteOp(kind: string, payload: unknown): void {
    const p = (payload ?? {}) as {
      id?: unknown; parent?: NodeId | null; fromParent?: NodeId | null; toParent?: NodeId | null;
      nodes?: readonly { id: NodeId }[]; detached?: readonly { parent: NodeId | null }[];
    };
    if (!kind.startsWith('kit:')) {
      // A consumer's op says nothing of what it reaches.
      journal.reset();
      return;
    }
    switch (kind) {
      case 'kit:add':
        journal.note(p.id as NodeId, TOUCH_CONTENT);
        journal.note(p.parent ?? null, TOUCH_CHILDREN);
        return;
      case 'kit:remove':
        for (const n of p.nodes ?? []) journal.note(n.id, TOUCH_CONTENT);
        for (const d of p.detached ?? []) journal.note(d.parent, TOUCH_CHILDREN);
        return;
      case 'kit:move':
        journal.note(p.id as NodeId, TOUCH_CONTENT);
        journal.note(p.fromParent ?? null, TOUCH_CHILDREN);
        journal.note(p.toParent ?? null, TOUCH_CHILDREN);
        return;
      case 'kit:setLayer':
        journal.note(p.id as NodeId, TOUCH_CONTENT | TOUCH_ORDER);
        return;
      default:
        // A layer's own record: its visibility, parallax, place or name.
        if (typeof p.id === 'string') journal.note(p.id as NodeId, TOUCH_CONTENT);
        else journal.reset();
    }
  }

  /** Bring the journal up to date with what is not an op: previews, scroll, and ambient generations. */
  function poll(): void {
    const now = [nodeMemoGeneration(), outsideGeneration()];
    if (now[0] !== ambient[0] || now[1] !== ambient[1]) {
      ambient = now;
      journal.reset();
    }
    env.eachShown((source) => {
      const at = source.getGeneration();
      const held = shown.get(source);
      if (held !== undefined && held.at === at) return;
      const ids = [...source.ids()];
      // Before and after together hold every id whose entry was set, changed or cleared.
      for (const id of held?.ids ?? []) journal.note(id, TOUCH_CONTENT);
      for (const id of ids) journal.note(id, TOUCH_CONTENT);
      shown.set(source, { at, ids });
    });
  }

  /** `content` with everything a change to it reaches. */
  function reached(content: ReadonlySet<NodeId>, parents: ReadonlySet<NodeId | null>): Set<NodeId> {
    const out = new Set<NodeId>();
    const queue: NodeId[] = [];
    const add = (id: NodeId): void => {
      if (out.has(id)) return;
      out.add(id);
      queue.push(id);
    };
    for (const id of content) add(id);
    const hugging = (from: NodeId | null): void => {
      for (let cursor = from; cursor !== null;) {
        if (env.childDerived.has(cursor)) add(cursor);
        cursor = nodes.get(cursor)?.parent ?? null;
      }
    };
    if (env.childDerived.size > 0) for (const p of parents) hugging(p);
    const deriving = !env.dependents.isEmpty();
    while (queue.length > 0) {
      const id = queue.pop()!;
      const node = nodes.get(id);
      if (node === undefined) continue;
      for (const c of node.children ?? []) add(c);
      if (deriving) for (const d of env.dependents.transitiveDependentsOf(id)) add(d);
      if (env.childDerived.size > 0) hugging(node.parent);
    }
    return out;
  }

  return {
    noteOp,
    changesSince(token) {
      poll();
      const now = journal.token();
      const span = token === undefined ? 'unknown' : journal.since(token);
      if (span === 'unknown') return { token: now, ids: 'unknown', parents: EMPTY, structural: true };
      if (span.content.size === 0 && span.parents.size === 0) {
        return { token: now, ids: EMPTY, parents: EMPTY, structural: span.structural };
      }
      return { token: now, ids: reached(span.content, span.parents), parents: span.parents, structural: span.structural };
    },
  };
}
