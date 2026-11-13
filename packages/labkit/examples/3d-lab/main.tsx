import { IconRegistryProvider } from '@weasel-js/core/engine';
import { icons as kernel3dIcons } from '@weasel-js/kernel3d/icons';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'windease/styles.css';
import '../../src/styles.less';
import './styles.less';
import { ThreeDLab } from './ThreeDLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
const ICONS = [...kitIcons, kernel3dIcons];

createRoot(root).render(
  <StrictMode>
    <IconRegistryProvider icons={ICONS}>
      <ThreeDLab />
    </IconRegistryProvider>
  </StrictMode>,
);
