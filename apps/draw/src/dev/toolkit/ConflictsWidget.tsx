import { canonicalModifiers, type Conflict } from '@weasel-js/core/routing';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import s from '../ToolkitBuilder.module.css';
import { codeOrDash, withUniqueIds } from './gridCells';

// Conflicts: the same (phase, gesture, target, mods) on multiple tools.

export function ConflictsWidget({ conflicts }: { conflicts: readonly Conflict[] }): ReactElement {
  return (
    <PropertyPanel stance="debug" className={s.widget} title={`Conflicts · ${conflicts.length}`}>
      {conflicts.length === 0 ? (
        <p className={s.empty}>No exact-tuple route conflicts in this bundle.</p>
      ) : (
        <DataGrid
          rows={withUniqueIds(conflicts.map((c) => {
            const route = `${c.phase}.${c.gesture}${c.arg != null ? `(${c.arg})` : ''}${c.target != null ? `.${c.target}` : ''}`;
            const mods = canonicalModifiers(c.modifiers);
            return { key: `${route}|${mods}`, route, mods, ownerIds: c.ownerIds.join(', ') };
          }))}
          columns={CONFLICT_COLUMNS}
        />
      )}
    </PropertyPanel>
  );
}

interface ConflictRow { id: string; route: string; mods: string; ownerIds: string }

const CONFLICT_COLUMNS: readonly DataGridColumn<ConflictRow>[] = [
  { id: 'route', header: 'Route', render: (r) => <code>{r.route}</code> },
  { id: 'mods', header: 'Mods', render: (r) => codeOrDash(r.mods) },
  { id: 'ownerIds', header: 'Claimed by', render: (r) => <code>{r.ownerIds}</code> },
];
