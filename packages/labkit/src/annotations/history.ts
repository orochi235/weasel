import type { Scene } from '@weasel-js/core';

/** What the ordering needs of a scene: its history depth, and the two moves. */
export interface HistoryScene {
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
  private undoable: string[] = [];
  private redoable: string[] = [];
  /** Set while this class is driving, so a redo is not read as a new change. */
  private replaying: 'undo' | 'redo' | null = null;

  /** Start following `scene` under `target`. Idempotent per target. */
  track(target: string, scene: HistoryScene): void {
    if (this.depth.has(target)) return;
    this.depth.set(target, scene.historyIndex());
  }

  /** Call on every notification from `target`'s scene. */
  observe(target: string, scene: HistoryScene): void {
    const now = scene.historyIndex();
    const before = this.depth.get(target) ?? 0;
    this.depth.set(target, now);
    if (now > before) {
      if (this.replaying === 'redo') {
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
    if (!scene) return false;
    this.replaying = 'undo';
    try {
      return scene.undo();
    } finally {
      this.replaying = null;
    }
  }

  redo(at: (t: string) => HistoryScene | undefined): boolean {
    const target = this.next(this.redoable, (s) => s.canRedo(), at);
    const scene = target === null ? undefined : at(target);
    if (!scene) return false;
    this.replaying = 'redo';
    try {
      return scene.redo();
    } finally {
      this.replaying = null;
    }
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
