import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { IconRegistryProvider } from '@weasel-js/icons/react';
import type { IconTable } from '@weasel-js/icons';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as editingIcons } from '@weasel-js/editing/icons';
import { icons as shapeIcons } from '@weasel-js/icons/shapes';
import { icons as paintKindIcons } from '@weasel-js/paint-kinds/icons';
import { icons as uiIcons } from '../icons.table';

// What `@weasel-js/ui-canvas/kit-icons` lists, which ui cannot import: core's and editing's tables, for the
// stories and tests that name their glyphs.
const kitIcons: readonly IconTable[] = [coreIcons, editingIcons, shapeIcons, paintKindIcons, uiIcons];

type Wrapper = (props: { children: ReactNode }) => ReactElement;

/** A `render` wrapper with core's and ui's icon tables registered, plus `extra` (another package's or an app's own). */
export function iconsWrapper(extra: readonly IconTable[] = []): Wrapper {
  const icons = extra.length > 0 ? [...kitIcons, ...extra] : kitIcons;
  return function WithIcons({ children }) {
    return <IconRegistryProvider icons={icons}>{children}</IconRegistryProvider>;
  };
}

/** A `render` wrapper with core's and ui's icon tables registered, for a test that draws a glyph. */
export const withIcons: Wrapper = iconsWrapper();

/** `render` inside {@link withIcons} (or {@link iconsWrapper} of `icons`), around any `wrapper` the options give. */
export function renderWithIcons(
  ui: ReactElement,
  { icons, ...options }: Omit<RenderOptions, 'queries'> & { icons?: readonly IconTable[] } = {},
) {
  const Outer = icons ? iconsWrapper(icons) : withIcons;
  const Inner = options.wrapper;
  const wrapper = Inner
    ? ({ children }: { children: ReactNode }) => <Outer><Inner>{children}</Inner></Outer>
    : Outer;
  return render(ui, { ...options, wrapper });
}
