import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerFont, registerFontOutlines } from '@weasel-js/core/renderer';
import {
  ActionsProvider,
  DepRegistryProvider,
  SelectionContextProvider,
} from '@weasel-js/core';
import { ThemeProvider } from '@weasel-js/theme/react';
import { App } from './App';
import { drawTheme } from './theme';
import { ColorModeProvider } from './colorMode';
import { registerAvailableFonts } from './fonts';
import { migrateLegacyPanelFlags } from './panels';

// The dev surfaces are only reachable at `#/dev/*`, and `RegistryInspector`
// reaches `dev/sourceLookup`, which embeds this app's own source as strings.
// Importing them statically put all of that in the entry bundle for every
// visitor who never opens them.
const ToolkitBuilder = lazy(() =>
  import('./dev/ToolkitBuilder').then((m) => ({ default: m.ToolkitBuilder })));
const RegistryInspector = lazy(() =>
  import('./dev/RegistryInspector').then((m) => ({ default: m.RegistryInspector })));

const PrefSchemaPage = lazy(() =>
  import('./dev/PrefSchemaPage').then((m) => ({ default: m.PrefSchemaPage })));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Register the bundled Inter MSDF atlas as the default `sans-serif` family so
// text DrawCommands render. The GL backend silently drops glyphs when no atlas
// is registered for the requested family/variant. Atlas files are served from
// `assets/fonts/` via vite's `publicDir` (see vite.config.ts).
// `import.meta.env.BASE_URL` injects the vite `base` setting so atlas
// URLs survive the base prefix (e.g. `/weasel/draw/`).
// Lazy: the 212 kB atlas is fetched the first time text lays out, so a
// document with none never pays for it. `<SceneCanvas>` subscribes to
// `subscribeGlyphReady`, which `registerFont` fires, so text repaints once the
// atlas lands.
void registerFont(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.json`,
  `${import.meta.env.BASE_URL}inter/inter.png`,
  { lazy: true },
).catch((err) => {
  console.warn('WeaselDraw: failed to register default font', err);
});

// The same face again, as outlines. Above ~48 on-screen pixels the kit
// renders glyphs as tessellated geometry instead of sampling the atlas, which
// is exact at any zoom and takes the same fills paths do. The TTF is a subset
// of Inter cut to the atlas's own charset (U+0020–00FF) so the two tiers
// cover exactly the same characters and neither can serve one the other
// can't — 27 kB, fetched lazily the first time large text is drawn. It is
// also the face the text edit overlay sets its glyphs in.
registerFontOutlines(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.ttf`,
);

// Everything past the baked default comes from the machine: each candidate
// family that's actually installed is enrolled with the kit's dynamic
// canvas-SDF tier, which rasterizes glyphs on demand. See `./fonts`.
registerAvailableFonts();

migrateLegacyPanelFlags();

/** Hash-based router: `#/dev/toolkits` mounts ToolkitBuilder, `#/dev/registry`
 *  the bundle inspector, `#/dev/prefs` the prefs schema editor, anything else
 *  the main App. Independent surfaces — they don't share providers
 *  beyond the outer ActionsProvider / SelectionContextProvider scope. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // The inspector is read rather than worked in, so it sets its text a density up.
  const inspector = hash.startsWith('#/dev/registry');
  const surface = hash.startsWith('#/dev/toolkits') ? (
    <ToolkitBuilder />
  ) : inspector ? (
    <RegistryInspector />
  ) : hash.startsWith('#/dev/prefs') ? (
    <PrefSchemaPage />
  ) : (
    <App />
  );
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
    <DepRegistryProvider>
      <ActionsProvider>
        <SelectionContextProvider>
          <Root />
        </SelectionContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  </StrictMode>,
);
