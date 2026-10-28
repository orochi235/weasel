import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ResizeHandle } from '../ResizeHandle';
import { Icon } from '../../icons';
import { Button } from '../Button';
import { ActionList } from './ActionList';
import { useEditorSize } from './editorPrefs';
import { GROUP_ICON } from './Palette';
import { ListPane } from './PaneHeader';
import { PartsList, type PartsCatalog } from './PartsList';
import type { ActionCatalog } from './useActionCatalog';
import type { SchemaRoot } from './schemaEdit';
import { SettingsTree } from './SettingsTree';
import s from './PrefSchemaEditor.module.css';
import { icon } from '../../icons.gen';

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
function ShelfList({ title, size, tools, children }: { title: string; size: 'shelfSettingsWidth' | 'shelfActionsWidth'; tools?: ReactNode; children: ReactNode }) {
  const width = useEditorSize(size);
  return (
    <>
      <ListPane title={title} tools={tools} className={s.shelfPane} style={{ '--shelf-pane-w': `${width.value}px` } as CSSProperties}>{children}</ListPane>
      <ResizeHandle {...width} min={120} max={800} ariaLabel={`Resize ${title.toLowerCase()}`} />
    </>
  );
}

/** The lists rows are dragged from into the structure tree, drawn into the shelf's `slot` once it is up. */
export function ShelfLists({ slot, over, layout, actions, parts, ...drag }: ListDrag & {
  slot: HTMLElement | null;
  /** The dialog a layout points into, whose settings are listed. */
  over?: SchemaRoot;
  layout: SchemaRoot;
  actions?: ActionCatalog;
  /** Leaves the tree takes copies of, listed before the actions. */
  parts?: PartsCatalog;
}) {
  if (!slot) return null;
  // What sorts the catalog, where there is one to sort.
  const tools = actions?.editable && (
    <>
      <Button iconOnly variant="ghost" size="sm" ariaLabel="Add action group" tooltip="Add group" onClick={actions.addGroup}><Icon name={GROUP_ICON.section} mark={icon('markAdd')} size={16} /></Button>
      <Button iconOnly variant="ghost" size="sm" ariaLabel="Remove from actions" tooltip="Remove: a group gives up what it holds, and an action that is gone leaves the list"
        disabled={actions.selected.length === 0} onClick={actions.remove}><Icon name={icon('core:delete')} size={16} /></Button>
    </>
  );
  return createPortal(
    <>
      {over !== undefined && <ShelfList title="Settings" size="shelfSettingsWidth"><SettingsTree over={over} layout={layout} {...drag} /></ShelfList>}
      {/* A tree with parts points into no dialog, so the two lists share a width. */}
      {parts !== undefined && <ShelfList title="Parts" size="shelfSettingsWidth"><PartsList parts={parts} {...drag} /></ShelfList>}
      {actions !== undefined && Object.keys(actions.root.children).length > 0 && (
        <ShelfList title="Actions" size="shelfActionsWidth" tools={tools || undefined}><ActionList catalog={actions} {...drag} /></ShelfList>
      )}
    </>,
    slot,
  );
}
