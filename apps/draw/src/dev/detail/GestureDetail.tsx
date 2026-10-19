import { Badge, type BadgeProps } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import traitSchemas from 'virtual:weasel-trait-schemas';
import s from '../RegistryInspector.module.css';
import { SchemaTable } from '../SchemaTable';
import { GESTURE_BADGE_PROPS } from '../badgeTokens';
import type { ActionEntry, GestureEntry, PhaseOutputEntry, ToolEntry } from '../registryEntries';
import { describeGestureSpec } from './ActionDetail';
import { EntryLink, type Props } from './shared';

/** `GestureSpec.kind` → the `GestureChannels` key a tool's surface records
 *  it under. Only the hyphenated kind differs. This used to be two maps
 *  translating between phase-channel names and spec kinds in both
 *  directions, because a route could be authored in either grammar. */
export const CHANNEL_FOR_KIND: Readonly<Record<string, string>> = {
  'key-held': 'keyHeld',
};

export interface ActionBindingRow {
  actionId: string;
  specKind: string;
  bindingText: string;
}

export function flattenActionBindings(actions: readonly ActionEntry[]): ActionBindingRow[] {
  const rows: ActionBindingRow[] = [];
  for (const a of actions) {
    const raw = a.defaultBinding;
    if (!raw) continue;
    // `defaultBinding` is `GestureSpec | BoundGesture | BoundGesture[]`.
    const entries: unknown[] = Array.isArray(raw) ? raw : [raw];
    for (const entry of entries) {
      const obj = entry as { spec?: { kind?: string }; kind?: string };
      const spec = (obj.spec ?? obj) as { kind?: string };
      if (!spec || typeof spec.kind !== 'string') continue;
      rows.push({
        actionId: a.id,
        specKind: spec.kind,
        bindingText: describeGestureSpec(spec),
      });
    }
  }
  return rows;
}

/** Payload schema for a gesture's dispatched event, extracted from the kit
 *  source by the trait-schemas Vite plugin. */
export function GesturePayloadPanel({ gestureId }: { gestureId: string }) {
  const schema = traitSchemas.gestures[gestureId];
  if (!schema) return null;
  return (
    <>
      <h3 className={s.subHeading}>Payload</h3>
      <SchemaTable rows={schema.payload} empty="No payload fields (event-only)." />
      {schema.source && (
        <p className={s.schemaSource}>
          Payload type at <code>{schema.source.file}:{schema.source.line}</code>
        </p>
      )}
    </>
  );
}

export function GestureDetail({
  entry, tools, actions, onNavigate,
}: {
  entry: GestureEntry;
  tools: readonly ToolEntry[];
  actions: readonly ActionEntry[];
  onNavigate: Props['onNavigate'];
}) {
  const channel = CHANNEL_FOR_KIND[entry.id] ?? entry.id;
  const toolRows = tools.flatMap((t) =>
    (t.surface.gestures as unknown as Record<string, unknown>)[channel]
      ? [{ id: t.id, tool: t }]
      : [],
  );
  const aliasSet = new Set([entry.id]);
  const actionRows = flattenActionBindings(actions)
    .filter((r) => aliasSet.has(r.specKind))
    .map((r) => ({ id: `${r.actionId}::${r.specKind}::${r.bindingText}`, ...r }));
  const actionEntriesById = new Map(actions.map((a) => [a.id, a] as const));
  return (
    <div>
      <h2 className={s.detailHeading}><Badge {...(GESTURE_BADGE_PROPS as BadgeProps)}>{entry.label}</Badge></h2>
      <p className={s.empty}>
        Input channel. Tools below subscribe to it via the legacy phase
        grammar; actions below bind to it via the modern dispatcher.
      </p>
      <GesturePayloadPanel gestureId={entry.id} />
      <h3 className={s.subHeading}>Actions binding this gesture</h3>
      <DataGrid
        rows={actionRows}
        columns={[
          {
            id: 'action', header: 'action', sortable: true,
            accessor: (r) => r.actionId,
            render: (r) => {
              const a = actionEntriesById.get(r.actionId);
              return a
                ? <EntryLink kind="action" id={a.id} label={a.label ?? a.id} onNavigate={onNavigate} />
                : <code>{r.actionId}</code>;
            },
          },
          {
            id: 'spec', header: 'spec.kind', sortable: true,
            accessor: (r) => r.specKind,
            render: (r) => <Code>{r.specKind}</Code>,
          },
          {
            id: 'detail', header: 'detail', sortable: false,
            render: (r) => <code>{r.bindingText || '—'}</code>,
          },
        ]}
        empty="No actions bind to this gesture."
      />
      <h3 className={s.subHeading}>Tools subscribing (phase grammar)</h3>
      <DataGrid
        rows={toolRows}
        columns={[
          toolNameColumn(onNavigate),
        ]}
        empty="No tools subscribe via phase grammar."
      />
    </div>
  );
}

export function PhaseOutputDetail({
  entry, tools, onNavigate,
}: { entry: PhaseOutputEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) =>
    t.surface.outputs[entry.id] ? [{ id: t.id, tool: t }] : [],
  );
  // PhaseDef docs: only `initial.overlay` is read by the runtime; the
  // engaged-phase form is currently a declarative no-op. Same caveat doesn't
  // apply to `cursor` / `claimsAll`, which both phases honor.
  const blurb = entry.id === 'overlay'
    ? 'Render layer emitted while the tool is active. Only `initial.overlay` is read by the runtime today.'
    : entry.id === 'cursor'
      ? 'CSS cursor the tool declares (string or thunk).'
      : 'Modal-claim predicate. When true, the dispatcher routes every `pointerdown` to this tool and bypasses affordance hit-tests.';
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        Phase output — the tool <em>declares or emits</em> this, rather than reacting to an input event. <InlineMarkdown text={blurb} />
      </p>
      <h3 className={s.subHeading}>Tools declaring this output</h3>
      <DataGrid
        rows={rows}
        columns={[
          toolNameColumn(onNavigate),
        ]}
        empty="No tools declare this output."
      />
    </div>
  );
}

/** Shared "Tool" column for inspector DataGrids — renders the tool id as a
 *  clickable EntryLink that navigates to the matching tool entry. Row shape
 *  must carry `id` (DataGrid contract) and a `tool` ref for label lookup. */
export function toolNameColumn(
  onNavigate: Props['onNavigate'],
): DataGridColumn<{ id: string; tool: ToolEntry }> {
  return {
    id: 'tool',
    header: 'Tool',
    accessor: (r) => r.tool.label ?? r.id,
    render: (r) => (
      <Button variant="link" onClick={() => onNavigate({ kind: 'tool', id: r.id })}>
        {r.tool.label ?? r.id}
      </Button>
    ),
  };
}

/** Tool column for tables that emit multiple rows per tool (e.g. one row per
 *  (tool, route) pair). Renders the tool name only on the first row of each
 *  group. Caller must sort/group rows by tool and tag each row with
 *  `isFirstForTool`. The column is non-sortable — re-sorting would break the
 *  merge-cell visual. */
export function mergedToolColumn(
  onNavigate: Props['onNavigate'],
): DataGridColumn<{ id: string; tool: ToolEntry; isFirstForTool: boolean }> {
  return {
    id: 'tool',
    header: 'Tool',
    sortable: false,
    accessor: (r) => r.tool.label ?? r.tool.id,
    render: (r) => r.isFirstForTool ? (
      <Button variant="link" onClick={() => onNavigate({ kind: 'tool', id: r.tool.id })}>
        {r.tool.label ?? r.tool.id}
      </Button>
    ) : null,
  };
}
