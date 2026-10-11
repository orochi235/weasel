import type { Scene } from '@weasel-js/core';

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
  private undoable: string[] = [];
  private redoable: string[] = [];

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
      if (current !== undefined && redoable?.has(current)) {
        drop(this.redoable, target);
      } else {
        // A change dropped whatever was redoable — weasel's own scene did the
        // same to its stack.
        this.redoable = [];
      }
      this.undoable.push(target);
    } else if (now < before) {
      drop(this.undoable, target);
      this.redoable.push(target);
    }
  }

  /** The target `undo` would act on, skipping any whose scene has nothing
   *  left — a scene can drop entries this ordering still lists. */
  private next(
    stack: string[],
    can: (s: HistoryScene) => boolean,
    at: (t: string) => HistoryScene | undefined,
  ): string | null {
    for (let i = stack.length - 1; i >= 0; i--) {
      const target = stack[i];
      if (target === undefined) continue;
      const scene = at(target);
      if (scene && can(scene)) return target;
    }
    return null;
  }

  canUndo(at: (t: string) => HistoryScene | undefined): boolean {
    return this.next(this.undoable, (s) => s.canUndo(), at) !== null;
  }

  canRedo(at: (t: string) => HistoryScene | undefined): boolean {
    return this.next(this.redoable, (s) => s.canRedo(), at) !== null;
  }

  undo(at: (t: string) => HistoryScene | undefined): boolean {
    const target = this.next(this.undoable, (s) => s.canUndo(), at);
    const scene = target === null ? undefined : at(target);
    return scene ? scene.undo() : false;
  }

  redo(at: (t: string) => HistoryScene | undefined): boolean {
    const target = this.next(this.redoable, (s) => s.canRedo(), at);
    const scene = target === null ? undefined : at(target);
    return scene ? scene.redo() : false;
  }
}

/** Remove the last occurrence of `value`, in place. */
function drop(stack: string[], value: string): void {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === value) {
      stack.splice(i, 1);
      return;
    }
  }
}

/** A `Scene` satisfies `HistoryScene`; this names the narrowing once. */
export const asHistoryScene = (scene: Scene<never, never, never> | HistoryScene): HistoryScene =>
  scene as HistoryScene;
