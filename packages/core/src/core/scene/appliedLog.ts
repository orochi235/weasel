/**
 * The scene's atomic-revert log: every kit op applied since the innermost
 * `atomically` opened, so an edit that is refused partway can take back what
 * it already did.
 */
import type { NodeId, RegisteredOp } from './types';

/** What the log needs from the scene it reverts. */
export interface AppliedLogEnv {
  /** The op table a logged kind is reverted through. */
  registered: ReadonlyMap<string, RegisteredOp<unknown>>;
  /** Run with the lock guard lifted: a revert restores a state that was legal. */
  lifted<T>(fn: () => T): T;
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;
  notify(): void;
}

export interface AppliedLog {
  /**
   * Run `fn` as all-or-nothing: if it throws, every kit op it applied is
   * reverted, newest first, and the selection goes back to where it was.
   * The log is at kit-op grain rather than per external op, because one
   * external op can issue several scene mutations (a container move cascading
   * to its children) and fail halfway through its own.
   *
   * On success the ops join an enclosing log only when `ownsEntry` says no
   * history entry holds them: reverting ops an entry still claims would leave
   * undo replaying a change that is no longer there.
   */
  atomically<T>(fn: () => T, ownsEntry: () => boolean): T;
  /** Note a kit op that was just applied, or with `reverted`, just reverted.
   *  Does nothing outside `atomically`. */
  logApplied(kind: string, payload: unknown, reverted?: boolean): void;
}

export function createAppliedLog(env: AppliedLogEnv): AppliedLog {
  let applied: { kind: string; payload: unknown; reverted?: boolean }[] | null = null;

  return {
    atomically(fn, ownsEntry) {
      const outer = applied;
      const log: NonNullable<typeof applied> = [];
      const selectionBefore = env.getSelection();
      applied = log;
      try {
        const result = fn();
        if (outer && !ownsEntry()) outer.push(...log);
        return result;
      } catch (err) {
        applied = null;
        env.lifted(() => {
          for (let i = log.length - 1; i >= 0; i--) {
            const { kind, payload, reverted } = log[i];
            const handler = env.registered.get(kind)!;
            (reverted ? handler.apply : handler.revert)(payload);
          }
        });
        env.setSelection(selectionBefore);
        if (log.length > 0) env.notify();
        throw err;
      } finally {
        applied = outer;
      }
    },
    logApplied(kind, payload, reverted) {
      applied?.push(reverted === undefined ? { kind, payload } : { kind, payload, reverted });
    },
  };
}
