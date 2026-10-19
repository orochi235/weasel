// Content-script entry, in every frame. It stays idle until the background asks it to connect,
// which happens only while a weasel panel is open on this tab.
import { extensionApi } from '../browserApi';
import { PORT_PAGE, isConnectRequest } from '../envelope';
import { createContentBridge } from './bridge';

const marked = globalThis as { __weaselDevtoolsBridge__?: true };

// The background injects this file into tabs that loaded before the extension did, so it may run twice.
if (!marked.__weaselDevtoolsBridge__) {
  marked.__weaselDevtoolsBridge__ = true;
  const api = extensionApi();
  let connected = false;
  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!isConnectRequest(message)) return;
    respond(true);
    if (connected) return;
    connected = true;
    createContentBridge(window, api.runtime.connect({ name: PORT_PAGE }), () => { connected = false; });
  });
}
