// Background entry: a service worker in Chrome and Edge, an event page in Firefox.
import { extensionApi } from '../browserApi';
import { isHello } from '../envelope';
import { answerProbe } from '../tabWeasel';
import { watchBadges } from './badge';
import { createRelay } from './relay';
import { wakeTab } from './wake';

const api = extensionApi();
const relay = createRelay({ wake: (tabId) => void wakeTab(api, tabId) });
api.runtime.onConnect.addListener((port) => relay.connect(port));
api.runtime.onMessage.addListener((message, sender, respond) => {
  const tabId = sender?.tab?.id;
  if (isHello(message) && tabId !== undefined) respond(relay.panelOpen(tabId));
  return answerProbe(api, message, respond);
});
watchBadges(api);
