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

/** One of the shelf's lists at the width the reader drags it to, and the handle that drags it. */
function ShelfList({ title, size, children }: { title: string; size: 'shelfSettingsWidth' | 'shelfActionsWidth'; children: ReactNode }) {
  const width = useEditorSize(size);
  return (
    <>
      <ListPane title={title} className={s.shelfPane} style={{ '--shelf-pane-w': `${width.value}px` } as CSSProperties}>{children}</ListPane>
      <ResizeHandle {...width} min={120} max={800} ariaLabel={`Resize ${title.toLowerCase()}`} />
    </>
  );
}

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
      {over !== undefined && <ShelfList title="Settings" size="shelfSettingsWidth"><SettingsTree over={over} layout={layout} {...drag} /></ShelfList>}
      {actions !== undefined && actions.length > 0 && <ShelfList title="Actions" size="shelfActionsWidth"><ActionList actions={actions} {...drag} /></ShelfList>}
    </>,
    slot,
  );
}
