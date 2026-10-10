import { Suspense, lazy, useEffect, useState } from 'react';
import { FrontPage } from './FrontPage/FrontPage';
import { atFront } from './routes';

// Everything behind the front page — the demo registry, the kit, the fonts —
// loads when a visitor first leaves it.
const Shell = lazy(() => import('./Shell'));

/** The site's root: the front page at an empty hash, the demo shell at any other. */
export function App() {
  const [front, setFront] = useState(atFront);

  useEffect(() => {
    const onHash = () => setFront(atFront());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (front) return <FrontPage />;
  return (
    <Suspense fallback={null}>
      <Shell />
    </Suspense>
  );
}
