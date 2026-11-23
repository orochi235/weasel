// Background entry: a service worker in Chrome and Edge, an event page in Firefox.
import { extensionApi } from '../browserApi';
import { isHello, isRefreshRequest } from '../envelope';
import { answerProbe } from '../tabWeasel';
import { watchBadges } from './badge';
import { createRelay } from './relay';
import { wakeTab } from './wake';

const api = extensionApi();
const relay = createRelay({ wake: (tabId) => void wakeTab(api, tabId) });
api.runtime.onConnect.addListener((port) => relay.connect(port));
const badges = watchBadges(api);
api.runtime.onMessage.addListener((message, sender, respond) => {
  const tabId = sender?.tab?.id;
  if (isHello(message) && tabId !== undefined) respond(relay.panelOpen(tabId));
  if (isRefreshRequest(message)) {
    void badges.probe(message.tabId).then(respond);
    return true;
  }
  return answerProbe(api, message, respond);
});
