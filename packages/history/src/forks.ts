/**
 * The futures a history set aside and the floor beneath its undo stack:
 * keeping a redo stack as a branch, switching between branches, and evicting
 * entries off the bottom along with every branch that forks from them.
 */
import type { Entry, HistoryLogger } from './serialized';
import type { EvictedEntry, HistoryBranch } from './historyTypes';

export interface ForksEnv {
  undoStack: Entry[];
  redoStack: Entry[];
  /** Keep a retired redo stack as a branch rather than evicting it. */
  branching: boolean;
  onEvict: ((entry: EvictedEntry) => void) | undefined;
  logger: HistoryLogger;
}

function branchView(entries: readonly Entry[], current: boolean): HistoryBranch {
  const first = entries[0]!;
  return { id: first.id, label: first.label, timestamp: first.timestamp, length: entries.length, current };
}

export function createForks(env: ForksEnv) {
  const { undoStack, redoStack, branching, onEvict, logger } = env;
  /** Futures a push set aside, by the id of the entry they fork from (the
   *  floor's for the oldest reachable state), each in time order. Only a
   *  branching history adds to it. */
  const forks = new Map<number, Entry[][]>();
  /** Names the state beneath the undo stack: 0 at the start, then the id of
   *  the last undo entry evicted. */
  let floorId = 0;

  /** Report entries that just became permanently unreachable. A throwing
   *  callback must not desync the stacks mid-mutation, so failures are
   *  contained and surfaced via the debug flag. */
  function reportEvicted(entries: Entry[]): void {
    if (!onEvict) return;
    for (const e of entries) {
      try {
        onEvict({ id: e.id, label: e.label, forwardOps: e.forwardOps, baseOps: e.baseOps });
      } catch (err) {
        logger.warn(`onEvict callback threw for entry id=${e.id} "${e.label}": ${String(err)}`);
      }
    }
  }

  /** Report `entries` evicted, and evict every branch forking from them. */
  function evict(entries: Entry[]): void {
    reportEvicted(entries);
    for (const e of entries) {
      const kept = forks.get(e.id);
      if (!kept) continue;
      forks.delete(e.id);
      for (const branch of kept) evict(branch);
    }
  }

  /** Evict `entries` off the bottom of the undo stack, oldest first. Each one
   *  raises the floor to the state it leaves: the futures forking from the old
   *  floor go with it, and the ones forking from the entry now fork from the
   *  floor. */
  function evictFloor(entries: Entry[]): void {
    for (const e of entries) {
      if (onEvict) reportEvicted([e]);
      const stranded = forks.size > 0 ? forks.get(floorId) : undefined;
      if (stranded !== undefined) forks.delete(floorId);
      floorId = e.id;
      if (stranded !== undefined) for (const branch of stranded) evict(branch);
    }
  }

  /** The id of the entry the history stands on, the floor's beneath them all. */
  function forkPoint(): number {
    return undoStack[undoStack.length - 1]?.id ?? floorId;
  }

  /** Clear the redo stack after a push forking from `at`: kept as a branch
   *  when branching, else dropped and reported. */
  function retireRedo(at: number): void {
    if (redoStack.length === 0) return;
    const future = redoStack.splice(0);
    if (!branching) return evict(future);
    const kept = forks.get(at);
    if (kept) kept.push(future.reverse());
    else forks.set(at, [future.reverse()]);
  }

  return {
    forkPoint,
    retireRedo,
    /** Evict the oldest undo entries past `limit`, reporting each. */
    evictPast(limit: number): void {
      while (undoStack.length > limit) evictFloor([undoStack.shift()!]);
    },
    /** Evict the undo entries older than `t`, and return them. */
    evictBefore(t: number): Entry[] {
      let k = 0;
      while (k < undoStack.length && undoStack[k]!.timestamp < t) k++;
      const evicted = undoStack.splice(0, k);
      evictFloor(evicted);
      return evicted;
    },
    /** The branches forking from where the history stands, the redo stack's among them. */
    branches(): HistoryBranch[] {
      const out = (forks.get(forkPoint()) ?? []).map((b) => branchView(b, false));
      if (redoStack.length > 0) out.push(branchView([...redoStack].reverse(), true));
      return out.sort((a, b) => a.id - b.id);
    },
    /** Put branch `id` on the redo stack, keeping the current one as a branch,
     *  and return it; `undefined` when it is already there. */
    switchTo(id: number): Entry[] | undefined {
      if (redoStack[redoStack.length - 1]?.id === id) return undefined;
      const at = forkPoint();
      const kept = forks.get(at) ?? [];
      const i = kept.findIndex((b) => b[0]!.id === id);
      if (i < 0) throw new Error(`No branch ${id} forks from entry ${at}`);
      const [chosen] = kept.splice(i, 1);
      if (redoStack.length > 0) kept.push(redoStack.splice(0).reverse());
      if (kept.length > 0) forks.set(at, kept);
      else forks.delete(at);
      redoStack.push(...[...chosen!].reverse());
      return chosen;
    },
    /** Drop every branch and lower the floor to the start; returns whether any branch was kept. */
    reset(): boolean {
      const had = forks.size > 0;
      forks.clear();
      floorId = 0;
      return had;
    },
    /** Take `next`'s branches and floor in place of these. */
    replace(next: { forks: ReadonlyMap<number, Entry[][]>; floorId: number }): void {
      forks.clear();
      for (const [at, kept] of next.forks) forks.set(at, kept);
      floorId = next.floorId;
    },
    /** The live branch map and floor, for a snapshot to read. */
    state: () => ({ forks, floorId }),
  };
}

export type Forks = ReturnType<typeof createForks>;
