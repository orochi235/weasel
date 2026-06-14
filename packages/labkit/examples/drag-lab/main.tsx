import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.less';
import '../../src/theme/light.less';
import '../../src/theme/interstellar.less';
import './styles.less';
import { DragLab } from './DragLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(
  <StrictMode>
    <DragLab />
  </StrictMode>,
);
