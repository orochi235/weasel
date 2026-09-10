import { useEffect, useState } from 'react';
import { PaletteLab } from './PaletteLab';
import styles from './PaletteLab.module.css';

/**
 * The app holds more than one tool. The palette lab is the built one; the
 * theme editor proper — token editing, the ramps, the semantic layer — is the
 * other half and is not here yet.
 */
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

  if (route === 'theme') {
    return (
      <div className={styles.stub}>
        <h1>Theme editor</h1>
        <p>
          Not built yet. This is where the token set itself gets edited — the neutral ramp, the
          semantic assignments, the scales — with the palette lab supplying the categorical colors.
        </p>
        <p>
          <a href="#/palette">Go to the palette lab</a>
        </p>
      </div>
    );
  }
  return <PaletteLab />;
}
