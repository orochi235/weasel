// devtools-page entry: adds the weasel panel the first time the inspected page has a hook.
// A panel cannot be removed again, so after that the panel itself says when weasel is gone.
import { extensionApi } from '../browserApi';
import { inspectedPresence, watchHookPresence } from '../hookPresence';

const api = extensionApi();
const stop = watchHookPresence(inspectedPresence(api), (present) => {
  if (!present) return;
  stop();
  api.devtools!.panels.create('weasel', 'icons/icon-32.png', 'panel.html');
});
