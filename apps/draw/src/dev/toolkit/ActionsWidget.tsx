import { type Action, actionBindings, type GestureSpec, keySpecShortcut } from '@weasel-js/core';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { actionIcon } from '@weasel-js/ui/components/Icon';
import { KeySequence, keySpecsFromMods, keySpecsFromShortcut, type LogicalModSpec } from '@weasel-js/ui/components/Keycaps';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement, ReactNode } from 'react';
import s from '../ToolkitBuilder.module.css';

export function ActionsWidget({ actions }: { actions: readonly Action[] }): ReactElement {
  return (
    <PropertyPanel stance="debug" className={s.widget} title={`Actions · ${actions.length}`}>
      <div className={s.widgetBodyScrollY}>
        {actions.length === 0 ? (
          <p className={s.empty}>No actions registered. Mount an ActionsProvider upstream.</p>
        ) : (
          <DataGrid rows={actions} columns={ACTION_COLUMNS} defaultSort={{ columnId: 'id', direction: 'asc' }} />
        )}
      </div>
    </PropertyPanel>
  );
}

const ACTION_COLUMNS: readonly DataGridColumn<Action>[] = [
  { id: 'icon', header: 'Icon', sortable: false, className: s.iconCell, render: (a) => actionIcon(a.icon) },
  { id: 'id', header: 'ID', render: (a) => <code>{a.id}</code> },
  { id: 'group', header: 'Group', render: (a) => a.group ?? <span className={s.empty}>—</span> },
  { id: 'binding', header: 'Binding', sortable: false, render: renderBinding },
  {
    id: 'requires',
    header: 'Requires',
    sortable: false,
    render: (a) => {
      const requires = (a as Action & { requires?: readonly string[] }).requires;
      return requires && requires.length > 0
        ? <code>{requires.join(', ')}</code>
        : <span className={s.empty}>—</span>;
    },
  },
  { id: 'enabled', header: 'Enabled', sortable: false, className: s.nowrap, render: snapshotEnabled },
];

function renderBinding(action: Action): ReactNode {
  if (!action.defaultBinding) return <span className={s.empty}>—</span>;
  return (
    <span className={s.bindingList}>
      {actionBindings(action).map(({ spec }, i) => (
        <span key={i} className={s.bindingItem}>
          {i > 0 && <span className={s.bindingSep}>or</span>}
          {renderSpec(spec)}
        </span>
      ))}
    </span>
  );
}

const MOD_ORDER = ['mod', 'ctrl', 'meta', 'shift', 'alt'] as const;

function renderSpec(spec: GestureSpec): ReactNode {
  const shortcut = keySpecShortcut(spec);
  if (shortcut) return <KeySequence keys={keySpecsFromShortcut(shortcut)} variant="inverse" />;
  const mods: LogicalModSpec[] = [];
  if ('mods' in spec && spec.mods) {
    for (const name of MOD_ORDER) {
      const held = spec.mods[name];
      if (held === true) mods.push({ name });
      else if (held === 'optional') mods.push({ name, optional: true });
    }
  }
  let label: string = spec.kind;
  if (spec.kind === 'click' || spec.kind === 'drag') {
    const t = spec.target;
    if (typeof t === 'string') label = `${spec.kind}(${t})`;
  } else if (spec.kind === 'multiTouch') {
    label = `multiTouch(${spec.fingers})`;
  }
  return (
    <>
      <Code size="sm">{label}</Code>
      {mods.length > 0 && (
        <>
          <span className={s.bindingSep}>+</span>
          <KeySequence keys={keySpecsFromMods(mods)} variant="inverse" />
        </>
      )}
    </>
  );
}

function snapshotEnabled(a: Action): ReactNode {
  if (!a.enabled) return <span className={s.empty}>—</span>;
  try {
    const r = a.enabled();
    return r === true
      ? <span className={s.enabledOk}>yes</span>
      : <span className={s.enabledNo}>{String(r)}</span>;
  } catch {
    return <span className={s.enabledNo}>predicate-threw</span>;
  }
}
