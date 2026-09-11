import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.less';

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';

const container = document.getElementById('root') as HTMLElement & { __reactRoot?: Root };
// Stashed on the node so HMR reuses the root instead of remounting a second one.
container.__reactRoot ??= createRoot(container);
container.__reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
