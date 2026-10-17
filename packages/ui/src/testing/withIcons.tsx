import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '../kitIcons';

/** A `render` wrapper with core's and ui's icon tables registered, for a test that draws a glyph. */
export function withIcons({ children }: { children: ReactNode }) {
  return <IconRegistryProvider icons={kitIcons}>{children}</IconRegistryProvider>;
}

/** `render` inside {@link withIcons}, around any `wrapper` the options give. */
export function renderWithIcons(ui: ReactElement, options: Omit<RenderOptions, 'queries'> = {}) {
  const Inner = options.wrapper;
  const wrapper = Inner
    ? ({ children }: { children: ReactNode }) => withIcons({ children: <Inner>{children}</Inner> })
    : withIcons;
  return render(ui, { ...options, wrapper });
}
