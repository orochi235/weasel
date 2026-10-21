// Content-script entry, in every frame.
import { extensionApi } from '../browserApi';
import { startContentScript } from './start';

const marked = globalThis as { __weaselDevtoolsBridge__?: true };

// The background injects this file into tabs that loaded before the extension did, so it may run twice.
if (!marked.__weaselDevtoolsBridge__) {
  marked.__weaselDevtoolsBridge__ = true;
  startContentScript(extensionApi(), window);
}
