import '@weasel-js/labkit/styles.less';
import type { ReactNode } from 'react';
import { LabShell, type LabPage } from '@weasel-js/labkit';

/** WeaselDraw and the dev pages hash-routed beside it, in switcher order. */
export const DEV_PAGES: readonly LabPage[] = [
  { href: import.meta.env.BASE_URL, label: 'WeaselDraw' },
  { href: '#/dev/toolkits', label: 'Toolkit Builder' },
  { href: '#/dev/registry', label: 'Bundle Inspector' },
];

/** Page frame for a dev page: its title doubles as the switcher to the others
 *  and names the document; `header` holds the page's own controls. */
export function DevShell({
  title,
  header,
  children,
}: {
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LabShell title={title} documentTitle={title} pages={DEV_PAGES} header={header}>
      {children}
    </LabShell>
  );
}
