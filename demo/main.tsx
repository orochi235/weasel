import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerFont } from '../src/renderer';
import { WeaselDemos } from './WeaselDemos';
import { ActionsProvider } from '../src/interactions/actions/registry';
import { SelectionContextProvider } from '../src/features/selection/SelectionContext';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Register the bundled Inter MSDF atlas as the default `sans-serif` family so
// every demo's text DrawCommands render. The GL backend's drawText silently
// drops glyphs when no atlas is registered for the requested family/variant.
// Atlases live under `assets/fonts/` (vite publicDir).
// Atlas paths are base-prefixed: vite config sets `base: '/weasel/'` so
// publicDir-served URLs live under that prefix. Using bare `/inter/...`
// produces a silent 404 → atlas never loads → text DrawCommands drop
// every glyph and the canvas stays blank until edit mode (which uses a
// contenteditable overlay, not the GL pipeline).
await registerFont(
  'sans-serif',
  { weight: 400, style: 'normal' },
  `${import.meta.env.BASE_URL}inter/inter.json`,
  `${import.meta.env.BASE_URL}inter/inter.png`,
).catch((err) => {
  console.warn('weasel demo: failed to register default font', err);
});

// Top-level <ActionsProvider> consolidates standalone hooks
// (useSelectAll / useEscape / etc.) onto a single keydown listener.
// Each demo's hook still works — when a registry is in scope, the hook
// registers an Action with the registry instead of attaching its own
// document keydown listener (back-compat path lives in each hook).
createRoot(container).render(
  <StrictMode>
    <ActionsProvider>
      <SelectionContextProvider>
        <WeaselDemos />
      </SelectionContextProvider>
    </ActionsProvider>
  </StrictMode>,
);
