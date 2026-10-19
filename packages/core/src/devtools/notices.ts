/** A session's change notices: the roots it follows, and what changed in each since the last flush. */
import { DEVTOOLS_PROTOCOL, type DevtoolsArea, type PageMessage } from './protocol';
import type { DevtoolsRoot } from './root';

/** Run `flush` once, soon. The hook's default waits for the next animation frame. */
export type DevtoolsSchedule = (flush: () => void) => void;

export interface Notices {
  /** Trace this root and report its changes, until {@link Notices.unfollow}. */
  follow(root: DevtoolsRoot): void;
  unfollow(rootId: string): void;
  /** The roots followed now. */
  ids(): string[];
}

export function createNotices(
  rootOf: (id: string) => DevtoolsRoot | undefined,
  schedule: DevtoolsSchedule,
  send: (m: PageMessage) => void,
): Notices {
  const following = new Map<string, () => void>();
  const pending = new Map<string, Set<DevtoolsArea>>();
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    for (const [rootId, areas] of pending) {
      const root = rootOf(rootId);
      if (!root || !following.has(rootId)) continue;
      const versions: Partial<Record<DevtoolsArea, number>> = {};
      for (const area of areas) versions[area] = root.version(area);
      send({ type: 'changed', protocol: DEVTOOLS_PROTOCOL, rootId, areas: versions });
    }
    pending.clear();
  };

  return {
    follow(root) {
      if (following.has(root.id)) return;
      const releaseTrace = root.source.trace.watch();
      const releaseCoords = root.source.coords.watch();
      const off = root.subscribe((area) => {
        let areas = pending.get(root.id);
        if (!areas) pending.set(root.id, (areas = new Set()));
        areas.add(area);
        if (!scheduled) {
          scheduled = true;
          schedule(flush);
        }
      });
      following.set(root.id, () => { releaseTrace(); releaseCoords(); off(); });
    },
    unfollow(rootId) {
      following.get(rootId)?.();
      following.delete(rootId);
      pending.delete(rootId);
    },
    ids: () => [...following.keys()],
  };
}
