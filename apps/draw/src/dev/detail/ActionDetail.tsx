import type { GestureSpec } from '@weasel-js/core';
import { routesForSpec } from '@weasel-js/core/routing';
import { Badge, type BadgeProps } from '@weasel-js/ui/components/Badge';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { KeySequence, keySpecsFromShortcut } from '@weasel-js/ui/components/Keycaps';
import { Fragment } from 'react';
import s from '../RegistryInspector.module.css';
import { BOOLEAN_BADGE_PROPS } from '../badgeTokens';
import type { ActionEntry, ToolEntry } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { RouteBadge } from './RouteBadge';
import { Jsdoc, EntryLink, type Props } from './shared';
import { CallbackList, SourceLink } from './sourceLinks';

/** Decompose a `ParsedModifiers` map into KeySpecs for KeySequence. Empty
 *  map (no required modifiers) returns undefined; otherwise emits one chip
 *  per modifier in canonical display order, marking optional ones inverted
 *  so the consumer can visually distinguish `?shift` from `+shift`.
 *  Delegates to `keySpecsFromMods` so labels are platform-aware
 *  (e.g. `mod` → ⌘ on macOS, Ctrl on Windows). */
/** One row in the per-binding params table rendered by `ActionDetail`. */
export interface ActionParamRow {
  gesture: string;
  /** JSON-encoded params record, `'(dynamic)'` for thunk-form params, or
   *  `null` when the binding declares no params at all. */
  params: string | '(dynamic)' | null;
}

/** Summarize an Action's `defaultBinding` into (a) the union of parameter
 *  key names that can be passed to its invoker, and (b) one row per
 *  registered binding for the per-binding table. Non-array shapes (a bare
 *  `GestureSpec`, or no binding at all) yield empty results. */
export function summarizeActionParams(
  defaultBinding: unknown,
): { paramNames: readonly string[]; rows: readonly ActionParamRow[] } {
  if (!Array.isArray(defaultBinding)) return { paramNames: [], rows: [] };

  const names = new Set<string>();
  const rows: ActionParamRow[] = [];

  for (const raw of defaultBinding) {
    const entry = raw as {
      kind?: string;
      key?: unknown;
      spec?: { kind?: string; key?: unknown };
      opts?: { params?: Record<string, unknown> | (() => Record<string, unknown>) };
    };
    const spec = entry.spec ?? (entry.kind ? { kind: entry.kind, key: entry.key } : undefined);
    const gesture = describeGestureSpec(spec);
    const params = entry.opts?.params;
    if (typeof params === 'function') {
      rows.push({ gesture, params: '(dynamic)' });
      continue;
    }
    if (params && typeof params === 'object') {
      for (const k of Object.keys(params)) names.add(k);
      rows.push({ gesture, params: JSON.stringify(params) });
      continue;
    }
    rows.push({ gesture, params: null });
  }

  return { paramNames: Array.from(names), rows };
}

/** Plain-text route notation for a `GestureSpec` — `[*:*] drop`,
 *  `[initial] drag(left) => * +shift` — one route per arg alternative,
 *  comma-joined. Falls back to the bare kind for kinds the route grammar
 *  has no name for. */
export function describeGestureSpec(spec: { kind?: string } | undefined): string {
  if (!spec || !spec.kind) return '(unknown)';
  return routesForSpec(spec as GestureSpec).join(', ') || spec.kind;
}

export function ActionDetail({ entry, tools, onNavigate }: {
  entry: ActionEntry;
  tools: readonly ToolEntry[];
  onNavigate: Props['onNavigate'];
}) {
  const match = findSourceMatch(entry.id);
  const { paramNames, rows: paramRows } = summarizeActionParams(entry.defaultBinding);
  const hasParams = paramNames.length > 0 || paramRows.some((r) => r.params !== null);

  // The reverse of the tool detail's `action` column: which tool gestures
  // dispatch here. Without it, following a route into an action is a one-way
  // trip — the action page never names its callers.
  const routedBy = tools.flatMap((t) =>
    t.declaredRoutes
      .filter((d) => d.actionId === entry.id)
      .map((d, i) => ({ id: `${t.id}:${i}:${d.route}`, toolId: t.id, route: d.route })),
  );
  return (
    <div>
      <div className={s.toolHeader}>
        {entry.icon && <span className={s.toolIcon} aria-hidden>{entry.icon}</span>}
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <DetailList>
        <DetailRow label="label">{entry.label}</DetailRow>
        {entry.group && (
          <DetailRow label="group"><EntryLink kind="group" id={`action:${entry.group}`} label={entry.group} onNavigate={onNavigate} /></DetailRow>
        )}
        {entry.bindingShortcut && (
          <DetailRow label="binding"><KeySequence keys={keySpecsFromShortcut(entry.bindingShortcut)} variant="inverse" /></DetailRow>
        )}
        {entry.shortcut && (
          <DetailRow label="shortcut"><code>{entry.shortcut}</code></DetailRow>
        )}
        {hasParams && (
          <DetailRow label="params">
            {paramNames.length > 0
              ? paramNames.map((name, i) => (
                  <Fragment key={name}>
                    {i > 0 && ', '}
                    <Code>{name}</Code>
                  </Fragment>
                ))
              : <span className={s.empty}>none</span>}
          </DetailRow>
        )}
        {entry.enabled && (
          <DetailRow label="enabled">
            {entry.enabled.enabled
              ? <Badge {...(BOOLEAN_BADGE_PROPS.true as BadgeProps)}>true</Badge>
              : <>
                  <Badge {...(BOOLEAN_BADGE_PROPS.false as BadgeProps)}>false</Badge>
                  <span className={s.empty}> ({entry.enabled.reason})</span>
                </>}
          </DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
        {entry.callbacks && entry.callbacks.length > 0 && (
          <DetailRow label="callbacks"><CallbackList callbacks={entry.callbacks} /></DetailRow>
        )}
      </DetailList>
      {paramRows.length > 0 && (
        <>
          <h3 className={s.subHeading}>Bindings</h3>
          <DataGrid
            rows={paramRows.map((r, i) => ({ id: String(i), ...r }))}
            columns={[
              {
                id: 'gesture',
                header: 'gesture',
                accessor: (r) => r.gesture,
                render: (r) => <code>{r.gesture}</code>,
              },
              {
                id: 'params',
                header: 'params',
                accessor: (r) => r.params ?? '',
                render: (r) =>
                  r.params === null
                    ? <span className={s.empty}>—</span>
                    : r.params === '(dynamic)'
                      ? <span className={s.empty}>(dynamic)</span>
                      : <code>{r.params}</code>,
              },
            ]}
            empty="No bindings."
          />
        </>
      )}
      {routedBy.length > 0 && (
        <>
          <h3 className={s.subHeading}>Routed by</h3>
          <DataGrid
            rows={routedBy}
            columns={[
              {
                id: 'toolId',
                header: 'tool',
                accessor: (r) => r.toolId,
                render: (r) => <EntryLink kind="tool" id={r.toolId} onNavigate={onNavigate} />,
              },
              {
                id: 'route',
                header: 'route',
                accessor: (r) => r.route,
                render: (r) => <RouteBadge route={r.route} />,
              },
            ]}
            empty="—"
          />
        </>
      )}
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
    </div>
  );
}
