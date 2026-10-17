import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';

const KIT_ICONS = [coreIcons, uiIcons];

/** A React root whose every render draws its icons from core's and ui's tables: the workshop's, and each story frame's. */
export function createKitRoot(container: Element): Pick<Root, 'render' | 'unmount'> {
  const root = createRoot(container);
  return {
    render: (node: ReactNode) => root.render(<IconRegistryProvider icons={KIT_ICONS}>{node}</IconRegistryProvider>),
    unmount: () => root.unmount(),
  };
}
