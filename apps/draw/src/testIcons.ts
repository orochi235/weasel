import { icons as pathToolsIcons } from '@weasel-js/path-tools/icons';
import { iconsWrapper, renderWithIcons as renderWithKitIcons } from '@weasel-js/ui/testing/withIcons';
import { icons as drawIcons } from './icons.table';

/** The tables WeaselDraw draws from beyond the kit's, which `main.tsx` gets from `virtual:weasel-icons`. */
export const DRAW_ICONS = [drawIcons, pathToolsIcons];

/** A `render` wrapper with every table WeaselDraw draws from registered. */
export const withIcons = iconsWrapper(DRAW_ICONS);

/** `render` inside {@link withIcons}. */
export const renderWithIcons: typeof renderWithKitIcons = (ui, options = {}) =>
  renderWithKitIcons(ui, { icons: DRAW_ICONS, ...options });
