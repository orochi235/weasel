/** Getting a tab's content scripts to connect to the relay. */
import type { ExtensionApi } from '../browserApi';
import { CONNECT_REQUEST } from '../envelope';

/**
 * Inject the content script into every frame of `tabId`, then ask each to connect. Injecting every
 * time, not only when no frame answers, reaches the frames that loaded before the extension did while
 * another frame of the tab has a live script; the script starts only where no live copy runs.
 */
export async function wakeTab(api: ExtensionApi, tabId: number): Promise<void> {
  try {
    await api.scripting?.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  } catch {
    // A page no extension may script, such as the browser's own pages.
  }
  try {
    await api.tabs?.sendMessage(tabId, CONNECT_REQUEST);
  } catch {
    // No frame has a content script to answer.
  }
}
