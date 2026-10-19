import { canonicalModifiers, describeRoute, describeRouteParts, formatPhaseAtom, ROUTE_FIELD_DEFINITIONS, type RouteFieldName } from '@weasel-js/core/routing';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { GestureRoute } from '@weasel-js/ui/components/GestureRoute';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { Fragment, type ReactNode } from 'react';
import s from '../RegistryInspector.module.css';
import { parseRoute } from '../registryData';
import type { ActionEntry, GroupEntry, ModifierSetEntry, RouteEntry, RouteTargetEntry, SlotEntry, ToolEntry } from '../registryEntries';
import { mergedToolColumn, toolNameColumn } from './GestureDetail';
import { RouteBadge } from './RouteBadge';
import { EntryLink, type Props } from './shared';

export function SlotDetail({
  entry, tools, onNavigate,
}: { entry: SlotEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const here = tools.filter((t) => t.slot === entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        {entry.id === 'registry'
          ? 'Active / hotkey routing slot.'
          : 'Always-on slot (resize / rotate / wheel-zoom).'}
      </p>
      <h3 className={s.subHeading}>Tools mounted in this slot</h3>
      <DataGrid
        rows={here.map((t) => ({ id: t.id, tool: t }))}
        columns={[toolNameColumn(onNavigate)]}
        empty="No tools mounted in this slot."
      />
    </div>
  );
}

export function RouteDetail({
  entry, tools, onNavigate,
}: { entry: RouteEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const parsed = parseRoute(entry.id);
  const rows = tools
    .filter((t) => t.routes.includes(entry.id))
    .map((t) => ({ id: t.id, tool: t }));
  return (
    <div className={s.routeDetailRoot}>
      <h2 className={s.detailHeading}><GestureRoute route={entry.id} /></h2>
      <p className={s.routeDescription} title={describeRoute(parsed)}>
        {describeRouteParts(parsed).map((part, i) =>
          typeof part === 'string'
            ? <Fragment key={i}>{part}</Fragment>
            : <abbr key={i} className={s.routeTerm} title={part.definition}>{part.label}</abbr>,
        )}
      </p>
      {(() => {
        type FieldRow = { id: RouteFieldName; value: ReactNode };
        const fieldRows: FieldRow[] = [
          { id: 'phases', value: parsed.phases.map(formatPhaseAtom).join(', ') },
          { id: 'gesture', value: <Code>{parsed.gesture}</Code> },
        ];
        if (parsed.arg !== undefined) {
          fieldRows.push({ id: 'arg', value: <Code>{parsed.arg}</Code> });
        }
        if (parsed.target !== undefined) {
          fieldRows.push({
            id: 'target',
            value: <EntryLink kind="routeTarget" id={parsed.target} onNavigate={onNavigate} />,
          });
        }
        if (Object.keys(parsed.modifiers).length > 0) {
          fieldRows.push({
            id: 'modifiers',
            value: Object.entries(parsed.modifiers).map(([name, req]) => (
              <Code key={name}>{req === 'required' ? '+' : '?'}{name}</Code>
            )),
          });
        }
        return (
          <DataGrid
            rows={fieldRows}
            columns={[
              { id: 'field', header: 'field', sortable: false, render: (r) => r.id },
              { id: 'value', header: 'value', sortable: false, render: (r) => r.value },
              {
                id: 'explanation',
                header: 'what it means',
                sortable: false,
                className: s.routeFieldExplanation,
                render: (r) => (r.id in ROUTE_FIELD_DEFINITIONS
                  ? <InlineMarkdown text={ROUTE_FIELD_DEFINITIONS[r.id as RouteFieldName]} />
                  : null),
              },
            ]}
          />
        );
      })()}
      <h3 className={s.subHeading}>Tools declaring this route</h3>
      <DataGrid
        rows={rows}
        columns={[toolNameColumn(onNavigate)]}
        empty="No tools declare this route."
      />
    </div>
  );
}

export function RouteTargetDetail({
  entry, tools, onNavigate,
}: { entry: RouteTargetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools
    .slice()
    .sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id, undefined, { sensitivity: 'base' }))
    .flatMap((t) =>
      t.routes
        .filter((r) => parseRoute(r).target === entry.id)
        .map((route, i) => ({ id: `${t.id}:${route}`, tool: t, route, isFirstForTool: i === 0 })),
    );
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Route-table key — target kind for click/dblTap/drag, key name for
        keyDown/keyUp, or <code>*</code> for wheel / function-form drag.
      </p>
      <h3 className={s.subHeading}>Tools routing to this target</h3>
      <DataGrid
        rows={rows}
        columns={[
          mergedToolColumn(onNavigate),
          {
            id: 'route',
            header: 'route',
            sortable: false,
            render: (r) => <RouteBadge route={r.route} />,
          },
        ]}
        empty="No tools route to this target."
      />
    </div>
  );
}

export function ModifierSetDetail({
  entry, tools, onNavigate,
}: { entry: ModifierSetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools
    .slice()
    .sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id, undefined, { sensitivity: 'base' }))
    .flatMap((t) =>
      t.routes
        .filter((r) => (canonicalModifiers(parseRoute(r).modifiers) || 'default') === entry.id)
        .map((route, i) => ({ id: `${t.id}:${route}`, tool: t, route, isFirstForTool: i === 0 })),
    );
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Canonical modifier-key combination keying a route sub-table.
        {' '}<code>default</code> means no modifier sub-table.
      </p>
      <h3 className={s.subHeading}>Tools with routes under this modifier set</h3>
      <DataGrid
        rows={rows}
        columns={[
          mergedToolColumn(onNavigate),
          {
            id: 'route',
            header: 'route',
            sortable: false,
            render: (r) => <GestureRoute route={r.route} />,
          },
        ]}
        empty="No tools declare routes under this modifier set."
      />
    </div>
  );
}

export function GroupDetail({
  entry, tools, actions, onNavigate,
}: { entry: GroupEntry; tools: readonly ToolEntry[]; actions: readonly ActionEntry[]; onNavigate: Props['onNavigate'] }) {
  const memberTools = entry.source === 'tool'
    ? tools.filter((t) => t.presentation?.group === entry.label)
    : [];
  const memberActions = entry.source === 'action'
    ? actions.filter((a) => a.group === entry.label)
    : [];
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <DetailList>
        <DetailRow label="source"><Code>{entry.source}</Code></DetailRow>
      </DetailList>
      {entry.source === 'tool' && (
        <>
          <h3 className={s.subHeading}>Tools in this presentation group</h3>
          <DataGrid
            rows={memberTools.map((t) => ({ id: t.id, tool: t }))}
            columns={[toolNameColumn(onNavigate)]}
            empty="No tools in this presentation group."
          />
        </>
      )}
      {entry.source === 'action' && (
        <>
          <h3 className={s.subHeading}>Actions in this group</h3>
          <DataGrid
            rows={memberActions.map((a) => ({ id: a.id, action: a }))}
            columns={[
              {
                id: 'action',
                header: 'Action',
                accessor: (r) => r.action.label ?? r.id,
                render: (r) => <code>{r.id}</code>,
              },
              {
                id: 'label',
                header: 'label',
                accessor: (r) => r.action.label ?? '',
                render: (r) => r.action.label ?? <span className={s.empty}>—</span>,
              },
            ]}
            empty="No actions in this group."
          />
        </>
      )}
    </div>
  );
}
