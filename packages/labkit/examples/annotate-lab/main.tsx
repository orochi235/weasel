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
    <AnnotateLab />
  </StrictMode>,
);
