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
  const probe = (tabId: number): void => {
    let latest = probes.get(tabId);
    if (!latest) probes.set(tabId, (latest = createLatest()));
    void refresh(tabId, latest.take());
  };
  api.tabs?.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') {
      probes.get(tabId)?.drop();
      void api.action?.setBadgeText({ tabId, text: '' });
    }
    if (info.status !== 'complete') return;
    for (const delay of BADGE_DELAYS) setTimeout(() => probe(tabId), delay);
  });
  api.tabs?.onRemoved?.addListener((tabId) => {
    probes.delete(tabId);
  });
  api.runtime.onInstalled?.addListener(() => {
    void api.tabs?.query({}).then((tabs) => {
      for (const { id } of tabs) if (id !== undefined) probe(id);
    });
  });
}
