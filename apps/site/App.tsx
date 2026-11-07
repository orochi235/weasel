import { Suspense, lazy, useEffect, useState } from 'react';
import { CanvasBackendProvider } from '@weasel-js/core';
import { FrontPage } from './FrontPage/FrontPage';
import { atFront } from './routes';
import { backendFromUrl } from './canvasBackend';

// Everything behind the front page — the demo registry, the kit, the fonts —
// loads when a visitor first leaves it.
const Shell = lazy(() => import('./Shell'));

/** The site's root: the front page at an empty hash, the demo shell at any other,
 *  every canvas in either painting with the backend `?backend=` names. */
export function App() {
  const [front, setFront] = useState(atFront);
  const [backend] = useState(backendFromUrl);

  useEffect(() => {
    const onHash = () => setFront(atFront());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <CanvasBackendProvider value={backend}>
      {front ? <FrontPage /> : (
        <Suspense fallback={null}>
          <Shell />
        </Suspense>
      )}
    </CanvasBackendProvider>
  );
}
