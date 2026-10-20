import { icons as diagramIcons } from '@weasel-js/diagram/icons';
import { iconsWrapper, renderWithIcons as renderWithKitIcons } from '@weasel-js/ui/testing/withIcons';

/** The tables WeaselChart draws from beyond the kit's, which `main.tsx` gets from `virtual:weasel-icons`. */
export const CHART_ICONS = [diagramIcons];

/** A `render` wrapper with every table WeaselChart draws from registered. */
export const withIcons = iconsWrapper(CHART_ICONS);

/** `render` inside {@link withIcons}. */
export const renderWithIcons: typeof renderWithKitIcons = (ui, options = {}) =>
  renderWithKitIcons(ui, { icons: CHART_ICONS, ...options });
