import { specificity } from '@weasel-js/core';
import { canonicalModifiers, type RegistryEntry } from '@weasel-js/core/routing';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import s from '../ToolkitBuilder.module.css';
import { codeOrDash, SPECIFICITY_HEADER, withUniqueIds } from './gridCells';
import type { ToolSlots } from './useToolReflection';

// `slot` is a static fact (which slot the tool was mounted in); the runtime
// `scope` the matcher sorts by — hotkey > active > ambient — depends on which
// tool is active and what's on the hotkey stack at dispatch time, so it lives
// in the Resolution widget below, sourced from resolveAll.
export function RoutesWidget({
  routes,
  slots,
}: {
  routes: readonly RegistryEntry[];
  slots: ToolSlots;
}): ReactElement {
  const ambientSet = new Set(slots.ambient);
  const sorted = [...routes].sort((a, b) =>
    a.ownerId.localeCompare(b.ownerId)
    || a.phase.localeCompare(b.phase)
    || a.gesture.localeCompare(b.gesture)
    || (a.arg ?? '').localeCompare(b.arg ?? '')
    || (a.target ?? '').localeCompare(b.target ?? ''));
  const rows = withUniqueIds(sorted.map((r): Omit<RouteRow, 'id'> => {
    const mods = canonicalModifiers(r.modifiers);
    return {
      key: [r.ownerId, r.phase, r.gesture, r.arg ?? '', r.target ?? '', mods, r.actionId].join('|'),
      ownerId: r.ownerId,
      slot: ambientSet.has(r.ownerId) ? 'ambient' : 'registry',
      phase: r.phase,
      gesture: r.gesture,
      arg: r.arg,
      target: r.target,
      mods,
      specificity: specificity(r.spec).join(' · '),
    };
  }));
  return (
    <PropertyPanel stance="debug" className={s.widget} title={`Routes · ${routes.length}`}>
      <div className={s.widgetBodyScrollXY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No routes (no tools mounted yet).</p>
        ) : (
          <DataGrid rows={rows} columns={ROUTE_COLUMNS} />
        )}
      </div>
    </PropertyPanel>
  );
}

interface RouteRow {
  id: string;
  key: string;
  ownerId: string;
  slot: 'ambient' | 'registry';
  phase: string;
  gesture: string;
  arg: string | undefined;
  target: string | undefined;
  mods: string;
  specificity: string;
}

const ROUTE_COLUMNS: readonly DataGridColumn<RouteRow>[] = [
  { id: 'ownerId', header: 'Owner', render: (r) => <code>{r.ownerId}</code> },
  { id: 'slot', header: 'Slot' },
  { id: 'phase', header: 'Phase' },
  { id: 'gesture', header: 'Gesture' },
  { id: 'arg', header: 'Arg', render: (r) => codeOrDash(r.arg) },
  { id: 'target', header: 'Target', render: (r) => codeOrDash(r.target) },
  { id: 'mods', header: 'Mods', render: (r) => codeOrDash(r.mods) },
  { id: 'specificity', header: SPECIFICITY_HEADER, className: s.nowrap, render: (r) => <code>{r.specificity}</code> },
];
