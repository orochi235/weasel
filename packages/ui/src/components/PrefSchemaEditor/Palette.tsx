import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { useKitSetting } from '@weasel-js/react';
import type { IconRef } from '@weasel-js/icons';
import { Icon } from '../../icons';
import { icon } from '../../icons.gen';
import { DragGhost } from '../DragGhost';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { blankLeaf } from './kindSchemas';
import { GHOST_WIDTH, NodeGhost, ghostIsPage } from './NodeGhost';
import type { SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** Something the palette makes: a kind of group, a label, or a separator. */
export interface PaletteItem {
  id: string;
  label: string;
  icon: IconRef;
  /** What the new node's key starts as; a number is added when a sibling holds it. */
  key: string;
  make(): SchemaNode;
}

/** The glyph for each way a group is drawn, on the palette's tools and beside a group in the tree. */
export const GROUP_ICON: Record<NonNullable<PrefGroup['as']>, IconRef> = {
  page: icon('formPage'),
  tab: icon('formTab'),
  panel: icon('formPanel'),
  section: icon('formSection'),
  fragment: icon('code'),
  bar: icon('formBar'),
  menu: icon('menu'),
};

const group = (name: string, as: PrefGroup['as']): PrefGroup => ({ name, description: '', as, children: {} });

const section = (name: string, as: PrefSection['as']): PrefSection => ({ name, description: '', as, members: {} });
const LABEL: PaletteItem = { id: 'label', label: 'Label', icon: icon('formLabel'), key: 'label', make: () => blankLeaf('label') };
const SEPARATOR: PaletteItem = { id: 'separator', label: 'Separator', icon: icon('formSeparator'), key: 'separator', make: () => blankLeaf('separator') };

/** What a section root takes: the same, less the page, each a section. */
export const SECTION_PALETTE: readonly PaletteItem[] = [
  { id: 'tab', label: 'Tab', icon: GROUP_ICON.tab, key: 'tab', make: () => section('New tab', 'tab') },
  { id: 'panel', label: 'Panel', icon: GROUP_ICON.panel, key: 'panel', make: () => section('New panel', 'panel') },
  { id: 'section', label: 'Section', icon: GROUP_ICON.section, key: 'section', make: () => section('New section', 'section') },
  { id: 'fragment', label: 'Group', icon: GROUP_ICON.fragment, key: 'group', make: () => section('New group', 'fragment') },
  { id: 'bar', label: 'Bar', icon: GROUP_ICON.bar, key: 'bar', make: () => section('New bar', 'bar') },
  LABEL,
  SEPARATOR,
];

export const PALETTE: readonly PaletteItem[] = [
  { id: 'page', label: 'Page', icon: GROUP_ICON.page, key: 'page', make: () => group('New page', 'page') },
  { id: 'tab', label: 'Tab', icon: GROUP_ICON.tab, key: 'tab', make: () => group('New tab', 'tab') },
  { id: 'panel', label: 'Panel', icon: GROUP_ICON.panel, key: 'panel', make: () => group('New panel', 'panel') },
  { id: 'section', label: 'Section', icon: GROUP_ICON.section, key: 'section', make: () => group('New section', 'section') },
  { id: 'fragment', label: 'Group', icon: GROUP_ICON.fragment, key: 'group', make: () => group('New group', 'fragment') },
  { id: 'bar', label: 'Bar', icon: GROUP_ICON.bar, key: 'bar', make: () => group('New bar', 'bar') },
  LABEL,
  SEPARATOR,
];

export interface PaletteDrag {
  item: PaletteItem;
  node: SchemaNode;
  /** The tree paths of what the drag carries, for nodes the schema holds already: the drop moves them and adds
   *  nothing. `node` is the first of them. */
  from?: readonly string[];
  x: number;
  y: number;
}

/**
 * Tool buttons to drag into the tree or the live preview, each making one new node where it is dropped. The drag is
 * the palette's own, and what it is over is the owner's to work out.
 */
export function Palette({ sections = false, ghost = true, disabled = false, pages = true, onDrag, onDrop, children }: {
  /** The schema's root is a section, so what it makes are sections. */
  sections?: boolean;
  /** Draw the dragged node beside the pointer. Off while something else draws it where it would land. */
  ghost?: boolean;
  /** Nothing can be added: no tool is picked up. */
  disabled?: boolean;
  /** Whether a page can be added. A layout holds none, and its page tool is disabled. */
  pages?: boolean;
  /** The drag moved, or ended (`null`) without a drop. */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
  /** Tools that act on a press, set after a rule at the palette's end. */
  children?: ReactNode;
}) {
  const [drag, setDrag] = useState<PaletteDrag | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const session = useRef<ThresholdDragHandle | null>(null);
  const dragPx = useKitSetting('gestures.dragPx');
  useEffect(() => () => { session.current?.cancel(); }, []);
  const move = (next: PaletteDrag | null) => {
    setDrag(next);
    onDrag(next);
  };
  const off = (item: PaletteItem): boolean => disabled || (!pages && item.id === 'page');
  const press = (item: PaletteItem, e: PointerEvent) => {
    if (off(item) || e.button !== 0 || session.current || !root.current) return;
    const node = item.make();
    const at = (ev: { clientX: number; clientY: number }): PaletteDrag => ({ item, node, x: ev.clientX, y: ev.clientY });
    session.current = startThresholdDrag(e, {
      // The palette, not the button: the tree redraws around a drag and the session must outlast that.
      origin: root.current,
      threshold: dragPx,
      onActivate: (ev) => move(at(ev)),
      onMove: (ev) => move(at(ev)),
      onCommit: (ev) => {
        session.current = null;
        setDrag(null);
        onDrop(at(ev));
        onDrag(null);
      },
      onClick: () => { session.current = null; },
      onCancel: () => {
        session.current = null;
        move(null);
      },
    });
  };
  return (
    <div className={s.palette} ref={root}>
      <ToolGroup orientation="horizontal" ariaLabel="Drag to add">
        {(sections ? SECTION_PALETTE : PALETTE).map((item) => (
          // The drag rides on a wrapper: a ToolButton takes a press and nothing else.
          <span key={item.id} className={s.paletteTool} onPointerDown={(e) => press(item, e)}>
            <ToolButton icon={<Icon name={item.icon} />} label={item.label} title={`Drag to add a ${item.label.toLowerCase()}`} disabled={off(item)} onClick={() => {}} />
          </span>
        ))}
      </ToolGroup>
      {children != null && (
        <>
          <span className={s.paletteRule} role="separator" aria-orientation="vertical" />
          <ToolGroup orientation="horizontal" ariaLabel="Add or remove">{children}</ToolGroup>
        </>
      )}
      {drag && ghost && root.current && (
        // Offset from the pointer so what is under it stays visible.
        <DragGhost at={{ left: drag.x + 10, top: drag.y + 10, width: GHOST_WIDTH[ghostIsPage(drag.node, true) ? 'page' : 'node'] }} from={root.current}>
          <NodeGhost node={drag.node} topLevel />
        </DragGhost>
      )}
    </div>
  );
}
