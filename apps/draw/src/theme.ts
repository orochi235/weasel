import { defineTheme } from '@weasel-js/theme';

/**
 * WeaselDraw's theme. The two accent pins are read only by the action
 * bar's own stylesheet; everything else uses kit tokens directly.
 */
export const drawTheme = defineTheme({
  name: 'weasel-draw',
  pins: {
    // Accent for active toggle states (grid, snap, etc.). Reads in the same
    // family as Switch, RangeSlider, and Checkbox active states.
    'app-accent': '{accent-strong}',
    'app-accent-bg': { type: 'color', value: '{accent-strong}', alpha: 0.22 },
  },
});
