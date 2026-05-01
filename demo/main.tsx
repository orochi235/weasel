import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasKitDemo } from './CanvasKitDemo';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <CanvasKitDemo />
  </StrictMode>,
);
