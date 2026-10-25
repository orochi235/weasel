import { useCommand } from '@weasel-js/core';
import { DIAGRAM_TYPES, FLOWCHART_TYPE } from '@weasel-js/diagram';
import { Button } from '@weasel-js/ui/components/Button';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { Icon } from '@weasel-js/ui/components/Icon';
import { ItemList, type ItemListRow } from '@weasel-js/ui/components/ItemList';
import { useState, type ReactElement } from 'react';
import { CHART_ACTIONS } from './chartCommands';
import type { ChartScene } from './chartDocument';
import { emptyChart, replaceChart } from './chartPersistence';

/** File › New…: a dialog listing the diagram types, which replaces the chart with an empty one of the type chosen. */
export function NewChart({ scene }: { scene: ChartScene }): ReactElement | null {
  const [open, setOpen] = useState(false);
  useCommand(CHART_ACTIONS.new, 'New…', () => setOpen(true));
  if (!open) return null;
  const create = (type: string) => {
    replaceChart(scene, emptyChart(type), 'New chart');
    setOpen(false);
  };
  return <NewChartDialog onCreate={create} onClose={() => setOpen(false)} />;
}

function NewChartDialog({ onCreate, onClose }: { onCreate(type: string): void; onClose(): void }): ReactElement {
  const [chosen, setChosen] = useState(FLOWCHART_TYPE.id);
  const rows: ItemListRow[] = Object.values(DIAGRAM_TYPES).map((type) => ({
    id: type.id,
    label: type.label,
    selected: type.id === chosen,
    ...(type.icon ? { leading: <Icon name={type.icon} size={16} /> } : {}),
  }));
  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button stance="confirm" onClick={() => onCreate(chosen)}>Create</Button>
    </>
  );
  return (
    <Dialog isOpen onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} title="New Chart" isDismissable footer={footer}>
      <ItemList rows={rows} selection="single" onActivate={setChosen} containerProps={{ 'aria-label': 'Chart type' }} />
    </Dialog>
  );
}
