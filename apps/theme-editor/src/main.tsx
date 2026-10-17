import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';
import { App } from './App';

const ICONS = [coreIcons, uiIcons];

const container = document.getElementById('root') as HTMLElement & { __reactRoot?: Root };
// Stashed on the node so HMR reuses the root instead of remounting a second one.
container.__reactRoot ??= createRoot(container);
container.__reactRoot.render(
  <StrictMode>
    <IconRegistryProvider icons={ICONS}>
      <App />
    </IconRegistryProvider>
  </StrictMode>,
);
