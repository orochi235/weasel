import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasKitDemo } from './CanvasKitDemo';
import { BackendProvider } from './BackendContext';
import { ActionsProvider } from '../src/interactions/actions/registry';
import { SelectionContextProvider } from '../src/features/selection/SelectionContext';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Top-level <ActionsProvider> consolidates standalone hooks
// (useSelectAll / useEscape / etc.) onto a single keydown listener.
// Each demo's hook still works — when a registry is in scope, the hook
// registers an Action with the registry instead of attaching its own
// document keydown listener (back-compat path lives in each hook).
createRoot(container).render(
  <StrictMode>
    <ActionsProvider>
      <SelectionContextProvider>
        <BackendProvider>
          <CanvasKitDemo />
        </BackendProvider>
      </SelectionContextProvider>
    </ActionsProvider>
  </StrictMode>,
);
