import type { ReactNode } from 'react';
import s from './PrefSchemaEditor.module.css';

/** The strip along the top of one of the editor's panes: what the pane is, and the controls that act on all of it. */
export function PaneHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={s.paneHeader}>
      <h3 className={s.paneTitle}>{title}</h3>
      {children !== undefined && <div className={s.paneTools}>{children}</div>}
    </header>
  );
}
