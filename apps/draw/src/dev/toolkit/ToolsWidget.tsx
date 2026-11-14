import { toolShortcutsOf, type Action, type ActionShortcut, type ToolDef } from '@weasel-js/core';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { KeySequence } from '@weasel-js/ui/components/Keycaps';
import { keySpecsFromShortcut } from '@weasel-js/gestures';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import s from '../ToolkitBuilder.module.css';
import type { ToolSlots } from './useToolReflection';

export function ToolsWidget({
  defs,
  slots,
  actions,
}: {
  defs: readonly ToolDef[];
  slots: ToolSlots;
  actions: readonly Action[];
}): ReactElement {
  const ambientSet = new Set(slots.ambient);
  const keys = toolShortcutsOf(actions, defs.map((d) => d.id));
  const rows: ToolRow[] = defs.map((d) => ({
    id: d.id,
    hookName: d.hookName,
    slot: ambientSet.has(d.id) ? 'ambient' : 'registry',
    shortcut: keys[d.id]?.[0],
  }));
  return (
    <PropertyPanel stance="debug" className={s.widget} title={`Tools · ${defs.length}`}>
      <div className={s.widgetBodyScrollY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No tools yet (canvas still mounting).</p>
        ) : (
          <DataGrid rows={rows} columns={TOOL_COLUMNS} defaultSort={{ columnId: 'id', direction: 'asc' }} />
        )}
      </div>
    </PropertyPanel>
  );
}

interface ToolRow {
  id: string;
  hookName: string | undefined;
  slot: 'ambient' | 'registry';
  shortcut: ActionShortcut | undefined;
}

const TOOL_COLUMNS: readonly DataGridColumn<ToolRow>[] = [
  { id: 'id', header: 'ID', render: (r) => <code>{r.id}</code> },
  { id: 'hookName', header: 'Hook', render: (r) => r.hookName ?? <span className={s.empty}>—</span> },
  { id: 'slot', header: 'Slot' },
  {
    id: 'shortcut',
    header: 'Switch',
    sortable: false,
    render: (r) => <KeySequence keys={keySpecsFromShortcut(r.shortcut)} variant="inverse" />,
  },
];
