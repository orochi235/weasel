// Background entry: a service worker in Chrome and Edge, an event page in Firefox.
import { extensionApi, type ExtensionApi } from '../browserApi';
import { CONNECT_REQUEST, isHello } from '../envelope';
import { createRelay } from './relay';

async function wakeTab(api: ExtensionApi, tabId: number): Promise<void> {
  try {
    await api.tabs?.sendMessage(tabId, CONNECT_REQUEST);
    return;
  } catch {
    // No content script answered: the tab loaded before the extension was installed or reloaded.
  }
  try {
    await api.scripting?.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    await api.tabs?.sendMessage(tabId, CONNECT_REQUEST);
  } catch {
    // A page no extension may script, such as the browser's own pages.
  }
}

const api = extensionApi();
const relay = createRelay({ wake: (tabId) => void wakeTab(api, tabId) });
api.runtime.onConnect.addListener((port) => relay.connect(port));
api.runtime.onMessage.addListener((message, sender, respond) => {
  const tabId = sender?.tab?.id;
  if (isHello(message) && tabId !== undefined) respond(relay.panelOpen(tabId));
});
