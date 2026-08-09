import { defineTheme } from '@weasel-js/theme';

/**
 * WeaselDraw's chrome palette.
 *
 * These were four `--wd-*` custom properties layered on top of the kit's
 * tokens. As a theme they travel through the same resolver as everything
 * else, so they reach canvas-drawn chrome too — not just DOM.
 */
export const drawTheme = defineTheme({
  name: 'weasel-draw',
  modes: {},
  tokens: {
    // Accent for active toggle states (grid, snap, etc.). Reads in the same
    // family as Switch, RangeSlider, and Checkbox active states.
    'app-accent': '{color.accent-strong}',
    'app-accent-bg': { type: 'color', value: '{color.accent-strong}', alpha: 0.22 },
    // Shared chrome surface — top bar, status bar, sidebars.
    'chrome-bg': '{color.surface}',
    'chrome-border': '{color.border}',
  },
});
