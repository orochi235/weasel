import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { IconRegistryProvider } from '@weasel-js/core';
import icons from 'virtual:weasel-icons';
import { App } from './App';

const ICON_VARIANTS = { all: () => import('virtual:weasel-icons/all') };

const container = document.getElementById('root') as HTMLElement & { __reactRoot?: Root };
// Stashed on the node so HMR reuses the root instead of remounting a second one.
container.__reactRoot ??= createRoot(container);
container.__reactRoot.render(
  <StrictMode>
    <IconRegistryProvider icons={icons} variants={ICON_VARIANTS}>
      <App />
    </IconRegistryProvider>
  </StrictMode>,
);
