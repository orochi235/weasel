import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { kitIcons } from '../kitIcons';

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
