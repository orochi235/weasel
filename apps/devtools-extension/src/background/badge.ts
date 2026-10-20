/**
 * Keeps each tab's toolbar badge on what weasel it runs. An app installs its hook when its first
 * canvas mounts, which can be after load, so a loaded page is probed again a little later; the
 * popup probes once more whenever it opens. Tabs already open when the extension installs or reloads
 * get no update, so each is probed then.
 */
import type { ExtensionApi } from '../browserApi';
import { refreshBadge } from '../tabWeasel';

export const BADGE_DELAYS = [0, 1000, 3000] as const;

export function watchBadges(api: ExtensionApi, refresh = (tabId: number) => refreshBadge(api, tabId)): void {
  api.tabs?.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') void api.action?.setBadgeText({ tabId, text: '' });
    if (info.status !== 'complete') return;
    for (const delay of BADGE_DELAYS) setTimeout(() => void refresh(tabId), delay);
  });
  api.runtime.onInstalled?.addListener(() => {
    void api.tabs?.query({}).then((tabs) => {
      for (const { id } of tabs) if (id !== undefined) void refresh(id);
    });
  });
}
