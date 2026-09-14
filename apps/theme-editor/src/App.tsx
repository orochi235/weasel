import { useEffect, useState } from 'react';
import { PaletteLab } from './PaletteLab';
import { ThemeEditor } from './ThemeEditor';

const ROUTES = ['palette', 'theme'] as const;
type Route = (typeof ROUTES)[number];

function readHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'palette';
}

export function App() {
  const [route, setRoute] = useState<Route>(readHash);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#/${route}`) {
      window.history.replaceState(null, '', `#/${route}`);
    }
  }, [route]);

  if (route === 'theme') return <ThemeEditor />;
  return <PaletteLab />;
}
