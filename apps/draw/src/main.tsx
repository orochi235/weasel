import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IconRegistryProvider, WeaselProvider } from '@weasel-js/core';
import { ThemeProvider } from '@weasel-js/theme/react';
import icons from 'virtual:weasel-icons';
import { App } from './App';
import { drawTheme } from './theme';
import { ColorModeProvider } from './colorMode';
import { registerAvailableFonts } from './fonts';
import { registerDefaultFont } from '../../shared/defaultFont';
import { migrateLegacyPanelFlags } from './surfaces/surfaceState';
import { drawPrefs, importLegacyPrefs } from './prefs';
const ICON_VARIANTS = {
  all: () => import('virtual:weasel-icons/all'),
  draw: () => import('virtual:weasel-icons/draw'),
};

// The dev surfaces are only reachable at `#/dev/*`, and `RegistryInspector`
// reaches `dev/sourceLookup`, which embeds this app's own source as strings.
// Importing them statically put all of that in the entry bundle for every
// visitor who never opens them.
const ToolkitBuilder = lazy(() =>
  import('./dev/ToolkitBuilder').then((m) => ({ default: m.ToolkitBuilder })));
const RegistryInspector = lazy(() =>
  import('./dev/RegistryInspector').then((m) => ({ default: m.RegistryInspector })));

const AssetsPage = lazy(() =>
  import('./dev/AssetsPage').then((m) => ({ default: m.AssetsPage })));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

registerDefaultFont('WeaselDraw');

// Everything past the baked default comes from the machine: each candidate
// family that's actually installed is enrolled with the kit's dynamic
// canvas-SDF tier, which rasterizes glyphs on demand. See `./fonts`.
registerAvailableFonts();

// The v2 blob lands first, so the panel flags fold into what it held.
importLegacyPrefs(drawPrefs());
migrateLegacyPanelFlags();

/** Hash-based router: `#/dev/toolkits` mounts ToolkitBuilder, `#/dev/registry`
 *  the bundle inspector, `#/dev/assets` the asset editor, anything else
 *  the main App, whose `<EditorShell>` mounts the kit's providers. The dev
 *  surfaces get theirs from a `<WeaselProvider>`. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // The inspector is read rather than worked in, so it sets its text a density up.
  const inspector = hash.startsWith('#/dev/registry');
  const dev = hash.startsWith('#/dev/toolkits') ? (
    <ToolkitBuilder />
  ) : inspector ? (
    <RegistryInspector />
  ) : hash.startsWith('#/dev/assets') ? (
    <AssetsPage />
  ) : null;
  const surface = dev ? <WeaselProvider>{dev}</WeaselProvider> : <App />;
  return (
    <ColorModeProvider>
      {(mode) => (
        <ThemeProvider theme={drawTheme} selection={{ mode, ...(inspector ? { density: 'roomy' } : {}) }}>
          <Suspense fallback={null}>{surface}</Suspense>
        </ThemeProvider>
      )}
    </ColorModeProvider>
  );
}

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
    <IconRegistryProvider icons={icons} variants={ICON_VARIANTS}>
      <Root />
    </IconRegistryProvider>
  </StrictMode>,
);
