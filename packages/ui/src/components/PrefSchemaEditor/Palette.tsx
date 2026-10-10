import { useRef, useState, type PointerEvent } from 'react';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { Icon, type IconName } from '../../icons';
import { DragGhost } from '../DragGhost';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { GHOST_WIDTH, NodeGhost, ghostIsPage } from './NodeGhost';
import type { SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** Something the palette makes: a kind of group, or a label. */
export interface PaletteItem {
  id: string;
  label: string;
  icon: IconName;
  /** What the new node's key starts as; a number is added when a sibling holds it. */
  key: string;
  make(): SchemaNode;
}

const group = (name: string, as: PrefGroup['as']): PrefGroup => ({ name, description: '', as, children: {} });

const section = (name: string, as: PrefSection['as']): PrefSection => ({ name, description: '', as, members: {} });
const LABEL: PaletteItem = { id: 'label', label: 'Label', icon: 'formLabel', key: 'label', make: () => ({ kind: 'label', name: 'Label', description: '', default: undefined }) as PrefLeaf };

/** What a section root takes: the same, less the page, each a section. */
export const SECTION_PALETTE: readonly PaletteItem[] = [
  { id: 'tab', label: 'Tab', icon: 'formTab', key: 'tab', make: () => section('New tab', 'tab') },
  { id: 'panel', label: 'Panel', icon: 'formPanel', key: 'panel', make: () => section('New panel', 'panel') },
  { id: 'section', label: 'Section', icon: 'formSection', key: 'section', make: () => section('New section', 'section') },
  LABEL,
];

export const PALETTE: readonly PaletteItem[] = [
  { id: 'page', label: 'Page', icon: 'formPage', key: 'page', make: () => group('New page', 'page') },
  { id: 'tab', label: 'Tab', icon: 'formTab', key: 'tab', make: () => group('New tab', 'tab') },
  { id: 'panel', label: 'Panel', icon: 'formPanel', key: 'panel', make: () => group('New panel', 'panel') },
  { id: 'section', label: 'Section', icon: 'formSection', key: 'section', make: () => group('New section', 'section') },
  LABEL,
];

export interface PaletteDrag {
  item: PaletteItem;
  node: SchemaNode;
  x: number;
  y: number;
}

/**
 * Tool buttons to drag into the tree or the live preview, each making one new node where it is dropped. The button holds
 * the pointer for the whole drag, so the drag is the palette's own and what it is over is the owner's to work out.
 */
export function Palette({ sections = false, ghost = true, onDrag, onDrop }: {
  /** The schema's root is a section, so what it makes are sections. */
  sections?: boolean;
  /** Draw the dragged node beside the pointer. Off while something else draws it where it would land. */
  ghost?: boolean;
  /** The drag moved, or ended (`null`) without a drop. */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const [drag, setDrag] = useState<PaletteDrag | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const move = (next: PaletteDrag | null) => {
    setDrag(next);
    onDrag(next);
  };
  const at = (e: PointerEvent, from: PaletteDrag): PaletteDrag => ({ ...from, x: e.clientX, y: e.clientY });
  return (
    <div className={s.palette} ref={root}>
      <ToolGroup orientation="horizontal" ariaLabel="Drag to add">
        {(sections ? SECTION_PALETTE : PALETTE).map((item) => (
          // The drag rides on a wrapper: a ToolButton takes a press and nothing else.
          <span
            key={item.id}
            className={s.paletteTool}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              move({ item, node: item.make(), x: e.clientX, y: e.clientY });
            }}
            onPointerMove={(e) => { if (drag) move(at(e, drag)); }}
            onPointerUp={(e) => {
              if (!drag) return;
              const last = at(e, drag);
              setDrag(null);
              onDrop(last);
              onDrag(null);
            }}
            onPointerCancel={() => { if (drag) move(null); }}
          >
            <ToolButton icon={<Icon name={item.icon} />} label={item.label} title={`Drag to add a ${item.label.toLowerCase()}`} onClick={() => {}} />
          </span>
        ))}
      </ToolGroup>
      {drag && ghost && root.current && (
        // Offset from the pointer so what is under it stays visible.
        <DragGhost at={{ left: drag.x + 10, top: drag.y + 10, width: GHOST_WIDTH[ghostIsPage(drag.node, true) ? 'page' : 'node'] }} from={root.current}>
          <NodeGhost node={drag.node} topLevel />
        </DragGhost>
      )}
    </div>
  );
}
