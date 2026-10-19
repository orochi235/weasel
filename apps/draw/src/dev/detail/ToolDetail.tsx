import { formatPhaseAtom } from '@weasel-js/core/routing';
import { Badge, type BadgeProps } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { GestureRoute } from '@weasel-js/ui/components/GestureRoute';
import { KeySequence, keySpecsFromShortcut } from '@weasel-js/ui/components/Keycaps';
import s from '../RegistryInspector.module.css';
import { GESTURE_BADGE_PROPS } from '../badgeTokens';
import { collectBundles, parseRoute } from '../registryData';
import { type ToolEntry, type ToolSurface, GESTURE_CHANNEL_KEYS, PHASE_OUTPUT_KEYS } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { hotkeyTriggerToKeySpec } from './RouteBadge';
import { BundleBadge, Jsdoc, Absent, EntryLink, type Props, Wildcardable } from './shared';
import { CallbackList, SourceLink, SourceRefLink, sourceKey } from './sourceLinks';

export function activeGestures(surface: ToolSurface): readonly (keyof ToolSurface['gestures'])[] {
  return GESTURE_CHANNEL_KEYS.filter((k) => surface.gestures[k]);
}

export function activeOutputs(surface: ToolSurface): readonly (keyof ToolSurface['outputs'])[] {
  return PHASE_OUTPUT_KEYS.filter((k) => surface.outputs[k]);
}

export function ToolDetail({ entry, onNavigate }: { entry: ToolEntry; onNavigate: Props['onNavigate'] }) {
  const bundles = collectBundles().filter((b) => b.tools.includes(entry.id));
  const match = findSourceMatch(entry.hookName ?? entry.id);
  const caps = (Object.entries(entry.capabilities) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  // Two bindings can format to the same route string (predicate targets all
  // render `predicate`), so the row key can't be the route alone.
  const routeRows = entry.declaredRoutes.map((d, i) => {
    const parsed = parseRoute(d.route);
    return {
      id: `${i}:${d.route}`,
      phase: parsed.phases.map(formatPhaseAtom).join(', '),
      gesture: parsed.gesture,
      arg: parsed.arg ?? '',
      target: parsed.target ?? '',
      modifiers: parsed.modifiers,
      actionId: d.actionId,
      source: d.source,
    };
  });

  // Callbacks already cited by a Routes row would otherwise appear twice —
  // once in this list and once in the table's `source` column. Keep only the
  // ones the table can't show: lifecycle members (onActivate / onDeactivate /
  // cursor) and any handler whose route didn't resolve.
  const citedInRoutes = new Set(
    routeRows.map((r) => r.source && sourceKey(r.source)).filter((k): k is string => k !== undefined),
  );
  const unlistedCallbacks = (entry.callbacks ?? []).filter((c) => !citedInRoutes.has(sourceKey(c.source)));

  return (
    <div>
      <div className={s.toolHeader}>
        {entry.presentation?.icon && (
          <span className={s.toolIcon} aria-hidden>{entry.presentation.icon}</span>
        )}
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <DetailList>
        {entry.hookName && (
          <DetailRow label="hook"><Code>{entry.hookName}</Code></DetailRow>
        )}
        <DetailRow label="slot"><EntryLink kind="slot" id={entry.slot} onNavigate={onNavigate} /></DetailRow>
        {entry.switchShortcut && (
          <DetailRow label="shortcut"><KeySequence keys={keySpecsFromShortcut(entry.switchShortcut)} variant="inverse" /></DetailRow>
        )}
        {entry.hotkey && (
          <DetailRow label="hold to engage">
            <KeySequence keys={[hotkeyTriggerToKeySpec(entry.hotkey)]} variant="inverse" />
            <GestureRoute route={`[*:initial] keyHeld(${entry.hotkey})`} />
          </DetailRow>
        )}
        {entry.cursor && <DetailRow label="cursor"><code>{entry.cursor}</code></DetailRow>}
        {entry.presentation && (
          <DetailRow label="presentation">
            {entry.presentation.label && <Code>{entry.presentation.label}</Code>}
            {entry.presentation.group && (
              <EntryLink
                kind="group"
                id={`tool:${entry.presentation.group}`}
                label={`group: ${entry.presentation.group}`}
                onNavigate={onNavigate}
              />
            )}
            {entry.presentation.shortcut && <Code>shortcut: {entry.presentation.shortcut}</Code>}
          </DetailRow>
        )}
        <DetailRow label="surface"><SurfaceRow surface={entry.surface} /></DetailRow>
        {caps.length > 0 && (
          <DetailRow label="capabilities">{caps.map((c) => <Code key={c}>{c}</Code>)}</DetailRow>
        )}
        {bundles.length > 0 && (
          <DetailRow label="in bundles">
            {bundles.map((b) => (
              <Button key={b.id} variant="link" onClick={() => onNavigate({ kind: 'bundle', id: b.id })}>
                <BundleBadge id={b.id} label={b.label} />
              </Button>
            ))}
          </DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
        {unlistedCallbacks.length > 0 && (
          <DetailRow label="callbacks"><CallbackList callbacks={unlistedCallbacks} /></DetailRow>
        )}
      </DetailList>
      {/* Rendered even when empty: a tool with no routes (an overlay-only
          ambient tool like `rotate`) should say so, not silently omit the
          section and leave the reader guessing whether it failed to load. */}
      <>
        <h3 className={s.subHeading}>Routes</h3>
          <DataGrid
            rows={routeRows}
            columns={[
              {
                id: 'phase',
                header: 'phase',
                accessor: (r) => r.phase,
                render: (r) => <Wildcardable value={r.phase} />,
              },
              { id: 'gesture', header: 'gesture', accessor: (r) => r.gesture },
              {
                id: 'arg',
                header: 'arg',
                accessor: (r) => r.arg,
                render: (r) => r.arg ? <Code>{r.arg}</Code> : <Absent />,
              },
              {
                id: 'target',
                header: 'target',
                accessor: (r) => r.target,
                // `*` is the grammar's "any target", not a nameable target —
                // linking it sends the reader to a catalog entry that just
                // re-lists everything. Render it as prose instead.
                render: (r) => r.target === '*'
                  ? <Wildcardable value="*" />
                  : r.target
                    ? <EntryLink kind="routeTarget" id={r.target} onNavigate={onNavigate} />
                    : <Absent />,
              },
              {
                id: 'modifiers',
                header: 'modifiers',
                sortable: false,
                render: (r) => (
                  Object.keys(r.modifiers).length === 0
                    ? <Absent />
                    : (
                      <span>
                        {Object.entries(r.modifiers).map(([name, req]) => (
                          <Code key={name}>{(req === 'required' ? '+' : '?') + name}</Code>
                        ))}
                      </span>
                    )
                ),
              },
              {
                id: 'action',
                header: 'action',
                accessor: (r) => r.actionId ?? '',
                render: (r) => r.actionId
                  ? <EntryLink kind="action" id={r.actionId} onNavigate={onNavigate} />
                  : <Absent title="Handled inline by an ActionFn on the tool's phase table — no registered Action to link." />,
              },
              {
                id: 'source',
                header: 'source',
                sortable: false,
                render: (r) => r.source
                  ? <SourceRefLink source={r.source} />
                  : <Absent title="No source location — the dev callback-source plugin didn't tag this handler." />,
              },
            ]}
            empty="This tool declares no routes."
          />
      </>

      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
    </div>
  );
}

export function SurfaceRow({ surface }: { surface: ToolSurface }) {
  const gestures = activeGestures(surface);
  const outputs = activeOutputs(surface);
  return (
    <div className={s.phaseRow}>
      {gestures.length === 0 && outputs.length === 0
        ? <span className={s.empty}>—</span>
        : (
          <>
            {gestures.map((g) => (
              <Badge key={`g-${g}`} {...(GESTURE_BADGE_PROPS as BadgeProps)}>{g}</Badge>
            ))}
            {outputs.map((o) => (
              <Code key={`o-${o}`}>{o}</Code>
            ))}
          </>
        )}
    </div>
  );
}
