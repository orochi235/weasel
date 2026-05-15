import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerFont } from '@orochi235/weasel/renderer';
import { ActionsProvider, SelectionContextProvider } from '@orochi235/weasel';
import { App } from './App';
import { ToolkitBuilder } from './dev/ToolkitBuilder';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Register the bundled Inter MSDF atlas as the default `sans-serif` family so
// text DrawCommands render. The GL backend silently drops glyphs when no atlas
// is registered for the requested family/variant. Atlas files are served from
// `assets/fonts/` via vite's `publicDir` (see vite.config.ts).
// `import.meta.env.BASE_URL` injects the vite `base` setting so atlas
// URLs survive the base prefix (e.g. `/weasel/swillustrator/`).
await registerFont(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.json`,
  `${import.meta.env.BASE_URL}inter/inter.png`,
).catch((err) => {
  console.warn('swillustrator: failed to register default font', err);
});

/** Hash-based router: `#/dev/toolkits` mounts ToolkitBuilder, anything else
 *  mounts the main App. Independent surfaces — they don't share providers
 *  beyond the outer ActionsProvider / SelectionContextProvider scope. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash.startsWith('#/dev/toolkits')) return <ToolkitBuilder />;
  return <App />;
}

createRoot(container).render(
  <StrictMode>
    <ActionsProvider>
      <SelectionContextProvider>
        <Root />
      </SelectionContextProvider>
    </ActionsProvider>
  </StrictMode>,
);
