import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { IconRegistryProvider } from '@weasel-js/icons/react';
import type { IconTable } from '@weasel-js/icons';
import { kitIcons } from '../kitIcons';

type Wrapper = (props: { children: ReactNode }) => ReactElement;

/** A `render` wrapper with every kit icon table registered, plus `extra` (another package's or an app's own). */
export function iconsWrapper(extra: readonly IconTable[] = []): Wrapper {
  const icons = extra.length > 0 ? [...kitIcons, ...extra] : kitIcons;
  return function WithIcons({ children }) {
    return <IconRegistryProvider icons={icons}>{children}</IconRegistryProvider>;
  };
}

/** `render` with every kit icon table registered, around any `wrapper` the options give. */
export function renderWithIcons(
  ui: ReactElement,
  { icons, ...options }: Omit<RenderOptions, 'queries'> & { icons?: readonly IconTable[] } = {},
) {
  const Outer = iconsWrapper(icons);
  const Inner = options.wrapper;
  const wrapper = Inner
    ? ({ children }: { children: ReactNode }) => <Outer><Inner>{children}</Inner></Outer>
    : Outer;
  return render(ui, { ...options, wrapper });
}
