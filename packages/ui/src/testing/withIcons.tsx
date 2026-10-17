import type { ReactNode } from 'react';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '../icons.table';

const KIT_ICONS = [coreIcons, uiIcons];

/** A `render` wrapper with core's and ui's icon tables registered, for a test that reads a glyph. */
export function withIcons({ children }: { children: ReactNode }) {
  return <IconRegistryProvider icons={KIT_ICONS}>{children}</IconRegistryProvider>;
}
