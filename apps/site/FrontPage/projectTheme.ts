import { defineTheme } from '@weasel-js/theme';

/** The repo's own colors, from `.hued`: the maroon its terminal tab wears, and the lime beside it. */
export const projectTheme = defineTheme({
  name: 'weasel-project',
  pins: {
    surface: '#470013',
    'surface-raised': '#5c0a22',
    'surface-sunken': '#32000d',
    'accent-base': '#89fe05',
    // The bright step is a value of its own in the base theme, not derived from accent-base.
    'accent-strong': '#89fe05',
    'fg-on-accent': '#1a2b00',
  },
});
