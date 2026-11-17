// Content-script entry, in every frame.
import { extensionApi } from '../browserApi';
import { startContentScriptOnce } from './start';

startContentScriptOnce(extensionApi(), window, globalThis as never);
