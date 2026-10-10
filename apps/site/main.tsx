import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { reloadOnce, sessionStore } from './chunkReload';

// A tab opened before a deploy preloads chunks that no longer exist. Left unhandled, the import rejects into PageBoundary.
window.addEventListener('vite:preloadError', (event) => {
  if (!reloadOnce(sessionStore(), Date.now())) return;
  event.preventDefault();
  window.location.reload();
});

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
    <App />
  </StrictMode>,
);
