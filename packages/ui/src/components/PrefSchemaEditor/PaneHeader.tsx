import type { CSSProperties, ReactNode, Ref } from 'react';
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

/** A titled list of the editor's: its header stays where it is, and its rows scroll under it. */
export function ListPane({ title, tools, className, paneRef, style, children, ...rest }: {
  title: string;
  /** The header's controls. */
  tools?: ReactNode;
  className: string;
  paneRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  children: ReactNode;
  'data-drop'?: boolean;
}) {
  return (
    <div className={`${s.listPane} ${className}`} ref={paneRef} style={style} {...rest}>
      <PaneHeader title={title}>{tools}</PaneHeader>
      <div className={s.listBody}>{children}</div>
    </div>
  );
}
