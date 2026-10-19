import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import './panel.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { extensionApi } from '../browserApi';
import { inspectedPresence } from '../hookPresence';
import { createPortTransport } from './portTransport';
import { PanelHost } from './PanelHost';

const api = extensionApi();
const transport = createPortTransport(api.devtools!.inspectedWindow.tabId, (name) => api.runtime.connect({ name }));
const presence = inspectedPresence(api);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PanelHost presence={presence} transport={transport} />
  </StrictMode>,
);
