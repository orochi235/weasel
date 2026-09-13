import { defineShellConfig } from '@weasel-js/forge';
import { FONT_GLOBALS } from './fonts';

export default defineShellConfig({
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
