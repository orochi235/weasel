import { IconRegistryProvider } from '@weasel-js/icons/react';
import { kitIcons } from '@weasel-js/ui-canvas/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'windease/styles.css';
import '../../src/styles.less';
import './styles.less';
import { DragLab } from './DragLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>
      <DragLab />
    </IconRegistryProvider>
  </StrictMode>,
);
