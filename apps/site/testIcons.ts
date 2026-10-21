import { icons as pathToolsIcons } from '@weasel-js/path-tools/icons';
import { icons as rigIcons } from '@weasel-js/rig/icons';
import { iconsWrapper, renderWithIcons as renderWithKitIcons } from '@weasel-js/ui/testing/withIcons';

/** The tables the site's demos draw from beyond the kit's, which `Shell.tsx` gets from `virtual:weasel-icons`. */
const SITE_ICONS = [pathToolsIcons, rigIcons];

/** A `render` wrapper with every table the site draws from registered. */
export const withIcons = iconsWrapper(SITE_ICONS);

/** `render` inside {@link withIcons}. */
export const renderWithIcons: typeof renderWithKitIcons = (ui, options = {}) =>
  renderWithKitIcons(ui, { icons: SITE_ICONS, ...options });
