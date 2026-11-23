/**
 * Keeps each tab's toolbar badge on what weasel it runs. An app installs its hook when its first
 * canvas mounts, which can be after load, so a loaded page is probed again a little later; the
 * popup asks for one more whenever it opens. Tabs already open when the extension installs or reloads
 * get no update, so each is probed then.
 */
import { createLatest, type Latest } from '@weasel-js/registry';
import type { ExtensionApi } from '../browserApi';
import { refreshBadge, type TabWeasel } from '../tabWeasel';

export const BADGE_DELAYS = [0, 1000, 3000] as const;

type Refresh = (tabId: number, current: () => boolean) => Promise<TabWeasel | null>;

export interface Badges {
  /** Probe a tab now, as one more of its probes: an answer a later probe or a navigation overtakes leaves the badge alone. */
  probe(tabId: number): Promise<TabWeasel | null>;
}

export function watchBadges(api: ExtensionApi, refresh: Refresh = (tabId, current) => refreshBadge(api, tabId, current)): Badges {
  // Per tab, so a probe that answers after a later one, or after the tab navigated, leaves the badge alone.
  const probes = new Map<number, Latest>();
  // Per tab, so a closed tab's pending probes are cancelled rather than re-adding it to `probes`.
  const pending = new Map<number, Set<ReturnType<typeof setTimeout>>>();
  const probe = (tabId: number): Promise<TabWeasel | null> => {
    let latest = probes.get(tabId);
    if (!latest) probes.set(tabId, (latest = createLatest()));
    return refresh(tabId, latest.take());
  };
  api.tabs?.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') {
      probes.get(tabId)?.drop();
      void clearBadge(api, tabId);
    }
    if (info.status !== 'complete') return;
    let timers = pending.get(tabId);
    if (!timers) pending.set(tabId, (timers = new Set()));
    for (const delay of BADGE_DELAYS) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        void probe(tabId);
      }, delay);
      timers.add(timer);
    }
  });
  api.tabs?.onRemoved?.addListener((tabId) => {
    for (const timer of pending.get(tabId) ?? []) clearTimeout(timer);
    pending.delete(tabId);
    probes.get(tabId)?.drop();
    probes.delete(tabId);
  });
  api.runtime.onInstalled?.addListener(() => {
    void api.tabs?.query({}).then((tabs) => {
      for (const { id } of tabs) if (id !== undefined) void probe(id);
    });
  });
  return { probe };
}

/** A tab closed while its badge is written rejects the write; there is nothing left to show it on. */
async function clearBadge(api: ExtensionApi, tabId: number): Promise<void> {
  try {
    await api.action?.setBadgeText({ tabId, text: '' });
  } catch {
    // The tab closed.
  }
}
