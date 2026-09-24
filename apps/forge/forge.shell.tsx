import { defineShellConfig } from '@weasel-js/forge';
import { interstellarTheme } from '@weasel-js/labkit';
import { FORGE_LAB, LABS } from '../shared/labs';
import { FONT_GLOBALS, fontTheme, loadWebFonts } from './fonts';

if (typeof document !== 'undefined') loadWebFonts(document);

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
    density: {
      label: 'Density',
      default: 'comfortable',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'roomy', label: 'Roomy' },
      ],
    },
    ...FONT_GLOBALS,
  },
  labTheme: (globals) => fontTheme(interstellarTheme, globals),
});
