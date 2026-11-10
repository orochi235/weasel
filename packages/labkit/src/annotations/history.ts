import type { Scene, SerializedHistory } from '@weasel-js/core';
import { maxOf } from '@weasel-js/geom';
import { editStamp, seedEditStamp } from '../undo/editStamp';

/** What the ordering needs of a scene: its history entries and depth, and the two moves. */
export interface HistoryScene {
  /** Every entry reachable from the present state, the applied ones first, each under an id that lasts as
   *  long as the entry does. */
  historyEntries(): readonly { id: string }[];
  historyIndex(): number;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Where `dropRedo` takes its redo from. A scene without one keeps its redo. */
  history?: { dropRedo?(): void };
}

/**
 * One undo ordering over several scenes.
 *
 * Each target's marks live in their own scene and each scene owns its own undo
 * stack, so "take back the last thing I did" is a question no single scene can
 * answer. This keeps the order changes arrived in.
 *
 * The order is maintained from each scene's `historyIndex()`, not from its
 * subscribe callback: a scene notifies on ephemeral changes that are not
 * history at all, and an undo driven from inside a pane's own keymap has to
 * *move* this ordering rather than append to it.
 */
export class MarkHistory {
  private readonly depth = new Map<string, number>();
  /** Per target, the ids of the entries its scene could redo when last seen. */
  private readonly ahead = new Map<string, ReadonlySet<string>>();
  /** Per change, its target and when it was first made. */
  private undoable: Step[] = [];
  private redoable: Step[] = [];

  private see(target: string, scene: HistoryScene): { now: number; current: string | undefined } {
    const now = scene.historyIndex();
    const entries = scene.historyEntries();
    this.depth.set(target, now);
    this.ahead.set(target, new Set(entries.slice(now).map((e) => e.id)));
    return { now, current: entries[now - 1]?.id };
  }

  /** Start following `scene` under `target`. Idempotent per target. */
  track(target: string, scene: HistoryScene): void {
    if (this.depth.has(target)) return;
    this.see(target, scene);
  }

  /** Call on every notification from `target`'s scene. */
  observe(target: string, scene: HistoryScene): void {
    const before = this.depth.get(target) ?? 0;
    const redoable = this.ahead.get(target);
    const { now, current } = this.see(target, scene);
    if (now > before) {
      // Depth cannot tell a redo from a change, whoever ran it: the entry that became current can.
      const isRedo = current !== undefined && redoable?.has(current) === true;
      const redone = isRedo ? drop(this.redoable, target) : undefined;
      // A change drops whatever was redoable — weasel's own scene did the same to its stack.
      if (!isRedo) this.redoable = [];
      this.undoable.push(redone ?? { target, stamp: editStamp() });
    } else if (now < before) {
      const undone = drop(this.undoable, target);
      this.redoable.push(undone ?? { target, stamp: editStamp() });
    }
  }

  /** The change `undo` would act on, skipping any whose scene has nothing
   *  left — a scene can drop entries this ordering still lists. */
  private next(
    stack: readonly Step[],
    can: (s: HistoryScene) => boolean,
    at: (t: string) => HistoryScene | undefined,
  ): Step | null {
    for (let i = stack.length - 1; i >= 0; i--) {
      const step = stack[i];
      if (step === undefined) continue;
      const scene = at(step.target);
      if (scene && can(scene)) return step;
    }
    return null;
  }

  canUndo(at: (t: string) => HistoryScene | undefined): boolean {
    return this.next(this.undoable, (s) => s.canUndo(), at) !== null;
  }

  canRedo(at: (t: string) => HistoryScene | undefined): boolean {
    return this.next(this.redoable, (s) => s.canRedo(), at) !== null;
  }

  /** When the change `undo` would take back was made. */
  undoStamp(at: (t: string) => HistoryScene | undefined): number | undefined {
    return this.next(this.undoable, (s) => s.canUndo(), at)?.stamp;
  }

  /** When the change `redo` would make again was first made. */
  redoStamp(at: (t: string) => HistoryScene | undefined): number | undefined {
    return this.next(this.redoable, (s) => s.canRedo(), at)?.stamp;
  }

  /** Drop everything the marks could redo, as a new change elsewhere does. */
  dropRedo(at: (t: string) => HistoryScene | undefined): void {
    const targets = new Set(this.redoable.map((s) => s.target));
    this.redoable = [];
    for (const target of targets) at(target)?.history?.dropRedo?.();
  }

  undo(at: (t: string) => HistoryScene | undefined): boolean {
    const step = this.next(this.undoable, (s) => s.canUndo(), at);
    const scene = step === null ? undefined : at(step.target);
    return scene ? scene.undo() : false;
  }

  redo(at: (t: string) => HistoryScene | undefined): boolean {
    const step = this.next(this.redoable, (s) => s.canRedo(), at);
    const scene = step === null ? undefined : at(step.target);
    return scene ? scene.redo() : false;
  }

  /** The order as data: each change's target and when it was first made, both ways. */
  toJSON(): MarkOrder {
    return {
      undoable: this.undoable.map((s) => ({ ...s })),
      redoable: this.redoable.map((s) => ({ ...s })),
    };
  }

  /** Put back an order `toJSON` wrote, once every target it names is tracked. A stamp
   *  handed out after is later than any it holds. */
  fromJSON(saved: unknown): void {
    const order = saved as Partial<MarkOrder> | null | undefined;
    this.undoable = steps(order?.undoable);
    this.redoable = steps(order?.redoable);
    seedEditStamp(maxOf([...this.undoable, ...this.redoable], (s) => s.stamp));
  }
}

/** What `MarkHistory.toJSON` writes. */
export interface MarkOrder {
  undoable: Step[];
  redoable: Step[];
}

/** A mark store's undo as data: each target's scene history and the order across them. */
export interface SerializedMarkHistory extends MarkOrder {
  /** Keyed by target, each as its scene's `serializeHistory` wrote it. */
  scenes: Record<string, SerializedHistory>;
}

/** What saving and restoring a target's history needs of its scene. */
type SavedScene = Pick<Scene<never, never, never>, 'serializeHistory' | 'restoreHistory'>;

/** `history`'s order, with the history of each scene in `scenes`. */
export function markHistoryOf(
  history: MarkHistory,
  scenes: ReadonlyMap<string, SavedScene>,
): SerializedMarkHistory {
  const out: Record<string, SerializedHistory> = {};
  for (const [target, scene] of scenes) out[target] = scene.serializeHistory();
  return { scenes: out, ...history.toJSON() };
}

/** Restore `target`'s scene history from `saved`, over the marks it was saved beside. */
export function restoreSceneHistory(scene: SavedScene, target: string, saved: unknown): void {
  const held = (saved as Partial<SerializedMarkHistory> | null | undefined)?.scenes?.[target];
  if (held) scene.restoreHistory(held);
}

/** A saved mark set without its undo history: what a copy of the marks starts from. */
export function withoutMarkHistory(doc: unknown): unknown {
  if (doc === null || typeof doc !== 'object' || !('history' in doc)) return doc;
  const { history: _history, ...rest } = doc as Record<string, unknown>;
  return rest;
}

function steps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Step => typeof s?.target === 'string' && typeof s?.stamp === 'number',
  );
}

/** A mark store's undo, over `history`'s ordering of the scenes `at` finds. */
export function markUndo(history: MarkHistory, at: (t: string) => HistoryScene | undefined) {
  return {
    canUndo: () => history.canUndo(at),
    canRedo: () => history.canRedo(at),
    undo: () => history.undo(at),
    redo: () => history.redo(at),
    undoStamp: () => history.undoStamp(at),
    redoStamp: () => history.redoStamp(at),
    dropRedo: () => history.dropRedo(at),
  };
}

/** One change in the ordering. */
interface Step {
  target: string;
  stamp: number;
}

/** Remove the last step on `target`, in place, and return it. */
function drop(stack: Step[], target: string): Step | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.target === target) return stack.splice(i, 1)[0];
  }
  return undefined;
}

/** A `Scene` satisfies `HistoryScene`; this names the narrowing once. */
export const asHistoryScene = (scene: Scene<never, never, never> | HistoryScene): HistoryScene =>
  scene as HistoryScene;
