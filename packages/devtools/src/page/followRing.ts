/**
 * One ring a root can hold for its life over whichever ring a canvas has now: a dispatcher republishes its trace,
 * and a new scene starts a new history. Watches and subscribers move to the new ring, and cursors keep counting up,
 * so a cursor taken on the old ring reads the new one from its start. Every read checks for a new ring first.
 */
import { createEmitter } from '@weasel-js/registry';
import type { DispatchTrace, TraceLogEntry, TraceRing } from '@weasel-js/routing';

export interface FollowedRing<T> extends TraceRing<T> {
  /** Move onto `current()` if it is not the ring followed now; a move is heard as a push. */
  sync(): void;
}

export function followRing<T, R extends TraceRing<T> = TraceRing<T>>(current: () => R): FollowedRing<T> & { ring(): R } {
  // Read on first use, not at creation: a canvas makes its coord trace only once something asks for it.
  let ring: R | null = null;
  /** What this ring's cursor 0 is in the follower's count. */
  let base = 0;
  let watchers = 0;
  let releases: (() => void)[] = [];
  const pushed = createEmitter();
  let offRing: (() => void) | null = null;

  const listen = (): void => {
    offRing = ring && pushed.size > 0 ? ring.subscribe(() => pushed.emit()) : null;
  };
  const sync = (): void => {
    const next = current();
    if (next === ring) return;
    const moved = ring !== null;
    if (ring) base += ring.since(Number.MAX_SAFE_INTEGER).cursor;
    for (const release of releases) release();
    offRing?.();
    ring = next;
    releases = Array.from({ length: watchers }, () => next.watch());
    listen();
    if (moved) pushed.emit();
  };
  const now = (): R => {
    sync();
    return ring!;
  };

  return {
    sync,
    ring: now,
    recording: () => now().recording(),
    push: (entry) => now().push(entry),
    since(cursor) {
      const slice = now().since(Math.max(0, cursor - base));
      return { entries: slice.entries, cursor: base + slice.cursor };
    },
    watch() {
      const release = now().watch();
      watchers++;
      releases.push(release);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        watchers--;
        // The release belongs to whichever ring it now watches; any one of them will do.
        releases.pop()?.();
      };
    },
    subscribe(listener) {
      sync();
      const off = pushed.subscribe(listener);
      if (!offRing) listen();
      return () => {
        off();
        if (pushed.size === 0) {
          offRing?.();
          offRing = null;
        }
      };
    },
  };
}

/** {@link followRing} over a canvas's dispatch trace. */
export function followTrace(current: () => DispatchTrace): FollowedRing<TraceLogEntry> & DispatchTrace {
  const followed = followRing<TraceLogEntry, DispatchTrace>(current);
  return {
    ...followed,
    recordModeSwitch: (...args) => followed.ring().recordModeSwitch(...args),
    setLive: (explain) => followed.ring().setLive(explain),
    live: () => followed.ring().live(),
  };
}
