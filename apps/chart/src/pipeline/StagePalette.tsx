import type { EffectStageType } from '@weasel-js/diagram/effect';
import { ItemList, type ItemListRow } from '@weasel-js/ui/components/ItemList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { ReactElement } from 'react';
import { CHART_STAGE_TYPES } from './stageTypes';

export interface StagePaletteProps {
  /** Adds a stage of the activated type. */
  onAdd: (type: EffectStageType) => void;
}

const ROWS: ItemListRow[] = CHART_STAGE_TYPES.map((t) => ({ id: t.type, label: t.title }));

/** The stage palette: activating a row adds a stage of that type to the pipeline. */
export function StagePalette({ onAdd }: StagePaletteProps): ReactElement {
  return (
    <SidebarPanel title="Stages">
      <ItemList
        rows={ROWS}
        onActivate={(id) => {
          const type = CHART_STAGE_TYPES.find((t) => t.type === id);
          if (type) onAdd(type);
        }}
        containerProps={{ 'aria-label': 'Stages' }}
      />
    </SidebarPanel>
  );
}
