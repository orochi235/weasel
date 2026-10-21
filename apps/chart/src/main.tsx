import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ActionsProvider,
  DepRegistryProvider,
  IconRegistryProvider,
  SelectionContextProvider,
} from '@weasel-js/core';
import { ThemeProvider } from '@weasel-js/theme/react';
import icons from 'virtual:weasel-icons';
import { App } from './App';
import { registerDefaultFont } from '../../shared/defaultFont';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

registerDefaultFont('WeaselChart');

// Reuse the root across HMR re-evaluations; a second createRoot on one node warns.
type ContainerWithRoot = HTMLElement & { __reactRoot?: ReturnType<typeof createRoot> };
const slot = container as ContainerWithRoot;
slot.__reactRoot ??= createRoot(slot);
slot.__reactRoot.render(
  <StrictMode>
    <IconRegistryProvider icons={icons}>
      <DepRegistryProvider>
        <ActionsProvider>
          <SelectionContextProvider>
            <ThemeProvider selection={{ mode: 'auto' }} className="wc-theme">
              <App />
            </ThemeProvider>
          </SelectionContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>
    </IconRegistryProvider>
  </StrictMode>,
);
