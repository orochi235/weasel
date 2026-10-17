import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'windease/styles.css';
import '../../src/styles.less';
import './styles.css';
import { AnnotateLab } from './AnnotateLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>
      <AnnotateLab />
    </IconRegistryProvider>
  </StrictMode>,
);
