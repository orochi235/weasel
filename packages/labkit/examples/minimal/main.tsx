import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.less';
import '../../src/theme/light.less';
import '../../src/theme/dark.less';
import { MinimalLab } from './MinimalLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(
  <StrictMode>
    <MinimalLab />
  </StrictMode>,
);
