import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import './popup.css';

import { isApplePlatform } from '@weasel-js/gestures';
import { extensionApi } from '../browserApi';
import { refreshBadge } from '../tabWeasel';
import { popupStatus } from './status';

const api = extensionApi();
const [active] = (await api.tabs?.query({ active: true, currentWindow: true })) ?? [];
const tab = active?.id === undefined ? null : await refreshBadge(api, active.id);
const status = popupStatus(tab, isApplePlatform());

document.getElementById('title')!.textContent = status.title;
const body = document.getElementById('lines')!;
for (const line of status.lines) {
  const p = document.createElement('p');
  p.textContent = line;
  body.append(p);
}
