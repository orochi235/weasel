import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ResizeHandle } from '../ResizeHandle';
import { ActionList } from './ActionList';
import type { EditorAction } from './editorActions';
import { useEditorSize } from './editorPrefs';
import { ListPane } from './PaneHeader';
import type { SchemaRoot } from './schemaEdit';
import { SettingsTree } from './SettingsTree';
import s from './PrefSchemaEditor.module.css';

/**
 * The row under the attributes and the preview, at a height the reader drags and the editor's prefs keep:
 * whatever is drawn into `slot`, then what it is given.
 */
export function Shelf({ slot, children }: { slot(el: HTMLDivElement | null): void; children: ReactNode }) {
  const height = useEditorSize('shelfHeight');
  return (
    <>
      <ResizeHandle className={s.shelfHandle} orientation="horizontal" invert {...height} min={80} max={600} ariaLabel="Resize shelf" />
      <div className={s.shelf} style={{ '--shelf-h': `${height.value}px` } as CSSProperties}>
        <div className={s.shelfSlot} ref={slot} />
        {children}
      </div>
    </>
  );
}

type ListDrag = Pick<Parameters<typeof ActionList>[0], 'sought' | 'ghost' | 'onDrag' | 'onDrop'>;

/** The lists rows are dragged from into the structure tree, drawn into the shelf's `slot` once it is up. */
export function ShelfLists({ slot, over, layout, actions, ...drag }: ListDrag & {
  slot: HTMLElement | null;
  /** The dialog a layout points into, whose settings are listed. */
  over?: SchemaRoot;
  layout: SchemaRoot;
  actions?: readonly EditorAction[];
}) {
  if (!slot) return null;
  return createPortal(
    <>
      {over !== undefined && <ListPane title="Settings" className={s.shelfPane}><SettingsTree over={over} layout={layout} {...drag} /></ListPane>}
      {actions !== undefined && actions.length > 0 && <ListPane title="Actions" className={s.shelfPane}><ActionList actions={actions} {...drag} /></ListPane>}
    </>,
    slot,
  );
}
