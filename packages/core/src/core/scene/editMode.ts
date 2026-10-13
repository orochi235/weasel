/**
 * Who is driving the scene's mutations right now.
 *
 * A bare call records itself. Inside a `batch` the batch records it; while a
 * history engine applies or replays ops the engine's entry already holds it;
 * and inside `untracked` nothing does.
 */
export type EditDriver = 'batch' | 'engine' | 'untracked';

export interface EditMode {
  /** Whether any driver is running, so a scene call is part of its edit
   *  rather than an edit of its own. */
  open(): boolean;
  /** Whether a scene call is recorded by the scene: false under an engine
   *  or an untracked run, however deep. */
  records(): boolean;
  untracked(): boolean;
  /** Run `fn` under `driver`. */
  during<T>(driver: EditDriver, fn: () => T): T;
}

export function createEditMode(): EditMode {
  const depth: Record<EditDriver, number> = { batch: 0, engine: 0, untracked: 0 };

  return {
    open: () => depth.batch + depth.engine + depth.untracked > 0,
    records: () => depth.engine + depth.untracked === 0,
    untracked: () => depth.untracked > 0,
    during(driver, fn) {
      depth[driver]++;
      try {
        return fn();
      } finally {
        depth[driver]--;
      }
    },
  };
}
