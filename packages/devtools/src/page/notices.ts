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
  /** Each followed root's info as last announced: a canvas's label or dimension can change after it registers. */
  const announced = new Map<string, string>();
  const infoKey = (root: DevtoolsRoot): string => {
    const { label, dimension } = root.info();
    return `${dimension}\u0000${label}`;
  };
  const pending = new Map<string, Set<DevtoolsArea>>();
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    // Taken whole first: a send can change a root again, and that change belongs to the next flush.
    const batch = [...pending];
    pending.clear();
    for (const [rootId, areas] of batch) {
      const root = rootOf(rootId);
      if (!root || !following.has(rootId)) continue;
      const key = infoKey(root);
      if (key !== announced.get(rootId)) {
        announced.set(rootId, key);
        send({ type: 'root-added', protocol: DEVTOOLS_PROTOCOL, root: root.info() });
      }
      const versions: Partial<Record<DevtoolsArea, number>> = {};
      for (const area of areas) versions[area] = root.version(area);
      send({ type: 'changed', protocol: DEVTOOLS_PROTOCOL, rootId, areas: versions });
    }
  };

  return {
    follow(root) {
      if (following.has(root.id)) return;
      announced.set(root.id, infoKey(root));
      const releaseTrace = root.source.trace.watch();
      const releaseCoords = root.source.coords.watch();
      const releaseHistory = root.source.history?.watch();
      const off = root.subscribe((area) => {
        let areas = pending.get(root.id);
        if (!areas) pending.set(root.id, (areas = new Set()));
        areas.add(area);
        if (!scheduled) {
          scheduled = true;
          schedule(flush);
        }
      });
      following.set(root.id, () => { releaseTrace(); releaseCoords(); releaseHistory?.(); off(); });
    },
    unfollow(rootId) {
      following.get(rootId)?.();
      following.delete(rootId);
      pending.delete(rootId);
      announced.delete(rootId);
    },
    ids: () => [...following.keys()],
  };
}
