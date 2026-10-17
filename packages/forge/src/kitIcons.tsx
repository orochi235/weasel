import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { kitIcons } from '@weasel-js/ui/kit-icons';

/** A React root whose every render draws its icons from the kit's tables, plus `extra` (an app's own): the
 *  workshop's, and each story frame's. */
export function createKitRoot(container: Element, extra: readonly IconTable[] = []): Pick<Root, 'render' | 'unmount'> {
  const root = createRoot(container);
  const icons = extra.length > 0 ? [...kitIcons, ...extra] : kitIcons;
  return {
    render: (node: ReactNode) => root.render(<IconRegistryProvider icons={icons}>{node}</IconRegistryProvider>),
    unmount: () => root.unmount(),
  };
}
