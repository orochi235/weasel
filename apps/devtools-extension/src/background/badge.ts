/**
 * Keeps each tab's toolbar badge on what weasel it runs. An app installs its hook when its first
 * canvas mounts, which can be after load, so a loaded page is probed again a little later; the
 * popup probes once more whenever it opens. Tabs already open when the extension installs or reloads
 * get no update, so each is probed then.
 */
import { createLatest, type Latest } from '@weasel-js/registry';
import type { ExtensionApi } from '../browserApi';
import { refreshBadge } from '../tabWeasel';

export const BADGE_DELAYS = [0, 1000, 3000] as const;

type Refresh = (tabId: number, current: () => boolean) => unknown;

export function watchBadges(api: ExtensionApi, refresh: Refresh = (tabId, current) => refreshBadge(api, tabId, current)): void {
  // Per tab, so a probe that answers after a later one, or after the tab navigated, leaves the badge alone.
  const probes = new Map<number, Latest>();
  // Per tab, so a closed tab's pending probes are cancelled rather than re-adding it to `probes`.
  const pending = new Map<number, Set<ReturnType<typeof setTimeout>>>();
  const probe = (tabId: number): void => {
    let latest = probes.get(tabId);
    if (!latest) probes.set(tabId, (latest = createLatest()));
    void refresh(tabId, latest.take());
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
        probe(tabId);
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
      for (const { id } of tabs) if (id !== undefined) probe(id);
    });
  });
}

/** A tab closed while its badge is written rejects the write; there is nothing left to show it on. */
async function clearBadge(api: ExtensionApi, tabId: number): Promise<void> {
  try {
    await api.action?.setBadgeText({ tabId, text: '' });
  } catch {
    // The tab closed.
  }
}
