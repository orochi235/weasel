import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import './popup.css';

import { isApplePlatform } from '@weasel-js/gestures';
import { extensionApi } from '../browserApi';
import { refreshRequest } from '../envelope';
import { probeTab, type TabWeasel } from '../tabWeasel';
import { popupStatus } from './status';

const api = extensionApi();
const [active] = (await api.tabs?.query({ active: true, currentWindow: true })) ?? [];
const tab = active?.id === undefined ? null : await refreshed(active.id);

/** The background's answer, which it also puts on the badge; the popup's own probe, which leaves the badge alone, without one. */
async function refreshed(tabId: number): Promise<TabWeasel | null> {
  try {
    return ((await api.runtime.sendMessage(refreshRequest(tabId))) as TabWeasel | null | undefined) ?? null;
  } catch {
    return probeTab(api, tabId);
  }
}
const status = popupStatus(tab, isApplePlatform());

document.getElementById('title')!.textContent = status.title;
const body = document.getElementById('lines')!;
for (const line of status.lines) {
  const p = document.createElement('p');
  p.textContent = line;
  body.append(p);
}
