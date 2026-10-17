import type { LabMode } from '../state/types';

export const MODES: readonly { mode: LabMode; label: string }[] = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];
