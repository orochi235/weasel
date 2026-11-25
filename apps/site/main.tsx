import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientContributionsProvider } from '@weasel-js/core';
import { DEV_DEVTOOLS } from '@weasel-js/devtools/mount';
import '@weasel-js/theme/fonts.css';
import './typography.css';
import { App } from './App';
import { reloadOnStaleChunks } from '@shared/chunkReload';

reloadOnStaleChunks();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Stash the React root on the container element so Vite HMR doesn't construct
// a second `createRoot` on the same DOM node when the module re-evaluates —
// that produces the `ReactDOMClient.createRoot() on a container that has
// already been passed to createRoot()` warning. On a fresh load we create
// the root; on HMR re-runs we reuse the existing one and just re-render.
type ContainerWithRoot = HTMLElement & { __reactRoot?: ReturnType<typeof createRoot> };
const slot = container as ContainerWithRoot;
slot.__reactRoot ??= createRoot(slot);
slot.__reactRoot.render(
  <StrictMode>
    <AmbientContributionsProvider contributions={DEV_DEVTOOLS}>
      <App />
    </AmbientContributionsProvider>
  </StrictMode>,
);
