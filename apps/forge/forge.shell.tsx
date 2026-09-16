import { defineShellConfig } from '@weasel-js/forge';
import { FORGE_LAB, LABS } from '../shared/labs';
import { FONT_GLOBALS } from './fonts';

export default defineShellConfig({
  pages: LABS,
  path: FORGE_LAB.href,
  globals: {
    mode: {
      label: 'Mode',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Auto (OS)' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
    },
    ...FONT_GLOBALS,
  },
});
