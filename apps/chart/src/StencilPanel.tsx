import { FLOWCHART_STENCILS, stencilKind } from '@weasel-js/diagram';
import { ItemList, type ItemListRow } from '@weasel-js/ui/components/ItemList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { DragEvent, ReactElement } from 'react';
import { stencilDragText } from './stencilDrop';

export interface StencilPanelProps {
  /** The active tool's id. */
  active: string | null;
  setActive: (toolId: string) => void;
}

const onDragStart = (id: string) => (e: DragEvent<HTMLDivElement>): void => {
  e.dataTransfer.setData('text/plain', stencilDragText(id));
  e.dataTransfer.effectAllowed = 'copy';
};

/** The shapes palette: a row picks that stencil's tool, and dragging a row onto the canvas drops one. */
export function StencilPanel({ active, setActive }: StencilPanelProps): ReactElement {
  const rows: ItemListRow[] = FLOWCHART_STENCILS.map((s) => ({
    id: s.id,
    label: s.label,
    selected: active === stencilKind(s.id),
    rowProps: { draggable: true, onDragStart: onDragStart(s.id) },
  }));
  return (
    <SidebarPanel title="Shapes">
      <ItemList
        rows={rows}
        selection="single"
        onActivate={(id) => setActive(stencilKind(id))}
        containerProps={{ 'aria-label': 'Shapes' }}
      />
    </SidebarPanel>
  );
}
