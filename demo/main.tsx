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
await registerFont(
  'sans-serif',
  { weight: 400, style: 'normal' },
  '/inter/inter.json',
  '/inter/inter.png',
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
