import { useEffect } from 'react';
import { useHashRoute } from '@shared/hashRoute';
import { PaletteLab } from './PaletteLab';
import { ThemeEditor } from './ThemeEditor';
import { ThemePrefs } from './ThemePrefs';

const ROUTES = ['palette', 'theme', 'prefs'] as const;

export function App() {
  const route = useHashRoute(ROUTES, 'palette');

  useEffect(() => {
    if (window.location.hash !== `#/${route}`) {
      window.history.replaceState(null, '', `#/${route}`);
    }
  }, [route]);

  if (route === 'theme') return <ThemeEditor />;
  if (route === 'prefs') return <ThemePrefs />;
  return <PaletteLab />;
}
