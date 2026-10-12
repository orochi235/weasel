/** What the bone and weight tools share between gestures: the joint they act on. */
export interface RigEditState {
  /** The active joint's name, or `null`. */
  active(): string | null;
  setActive(joint: string | null): void;
  /** Notified when the active joint changes. Returns an unsubscribe. */
  listen(fn: () => void): () => void;
}

/** A `RigEditState` with no joint active. Hand one to both tools so a joint picked with the
 *  bone tool is the one the weight tool paints. */
export function createRigEditState(): RigEditState {
  let active: string | null = null;
  const listeners = new Set<() => void>();
  return {
    active: () => active,
    setActive(joint) {
      if (joint === active) return;
      active = joint;
      for (const fn of [...listeners]) fn();
    },
    listen(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
