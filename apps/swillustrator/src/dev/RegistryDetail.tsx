import { Fragment } from 'react';
import { DataGrid, type DataGridColumn } from '@orochi235/weasel-ui';
import s from './RegistryInspector.module.css';
import type {
  TreeEntry, ToolEntry, ActionEntry, BundleEntry, IconEntry, OpFactoryEntry,
  PublicExportEntry, ShapeKindEntry, PhaseSummary, PhaseEntry, GestureEntry,
  OpKindEntry, HotkeyTriggerEntry, SlotEntry, RouteTargetEntry, ModifierSetEntry, GroupEntry,
} from './registryData';
import { collectBundles, collectIcons, parseRoute, TOOL_HOOK_NAMES } from './registryData';
void parseRoute;
import * as Weasel from '@orochi235/weasel';
import { ToolIcon } from '../kindIcons';
import type { ToolKind } from '../poseUpdate';
import { findSourceMatch } from './sourceLookup';
import { KeyCap } from './KeyCap';

/** Navigate to any entry in the inspector. The resolver in `RegistryInspector`
 *  walks every category node to find a `kind+id` match — so a `<Tool>` can
 *  link to a `<PublicExport>`, a `<Bundle>` can link back to `<Tool>` rows,
 *  etc. */
export type NavTarget = { kind: TreeEntry['kind']; id: string };

interface Props {
  entry: TreeEntry;
  /** Live tool snapshot — used by `BundleDetail` so member rows can show
   *  each tool's hook name, switch-shortcut, and presentation group. */
  tools: readonly ToolEntry[];
  /** Live action snapshot — used by `GroupDetail` to enumerate the members
   *  of an action-group bucket. */
  actions: readonly ActionEntry[];
  onNavigate(target: NavTarget): void;
}

/** Renders an entry id as a button that navigates to that entry on click.
 *  When `label` differs from `id`, the button label uses `label` — leaves
 *  the visual the same as inline text but with cursor / underline styling. */
function EntryLink({
  kind, id, label, onNavigate,
}: {
  kind: TreeEntry['kind'];
  id: string;
  label?: string;
  onNavigate: (t: NavTarget) => void;
}) {
  return (
    <button
      type="button"
      className={s.memberLink}
      onClick={() => onNavigate({ kind, id })}
    >
      {label ?? id}
    </button>
  );
}

export function RegistryDetail({ entry, tools, actions, onNavigate }: Props) {
  switch (entry.kind) {
    case 'tool':          return <ToolDetail entry={entry} onNavigate={onNavigate} />;
    case 'action':        return <ActionDetail entry={entry} onNavigate={onNavigate} />;
    case 'bundle':        return <BundleDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'shapeKind':     return <ShapeKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'icon':          return <IconDetail entry={entry} />;
    case 'opFactory':     return <OpFactoryDetail entry={entry} />;
    case 'publicExport':  return <PublicExportDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'phase':         return <PhaseDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'gesture':       return <GestureDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'opKind':        return <OpKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'hotkeyTrigger': return <HotkeyTriggerDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'slot':          return <SlotDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'routeTarget':   return <RouteTargetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'modifierSet':   return <ModifierSetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'group':         return <GroupDetail entry={entry} tools={tools} actions={actions} onNavigate={onNavigate} />;
  }
}

function OpKindDetail({ entry, onNavigate }: { entry: OpKindEntry; onNavigate: Props['onNavigate'] }) {
  const factoryId = `create${entry.id.charAt(0).toUpperCase()}${entry.id.slice(1)}Op`;
  const match = findSourceMatch(factoryId);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Stable name stamped onto every <code>Op</code> produced by its factory —
        used by <code>History.serialize</code> / <code>restore</code> to rebuild
        ops across reloads.
      </p>
      <dl className={s.detailList}>
        <dt>factory</dt>
        <dd><EntryLink kind="opFactory" id={factoryId} onNavigate={onNavigate} /></dd>
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
    </div>
  );
}

function HotkeyTriggerDetail({
  entry, tools, onNavigate,
}: { entry: HotkeyTriggerEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const using = tools.filter((t) => t.hotkey === entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>Press-and-hold trigger key for the hotkey tool slot.</p>
      <h3>Tools bound to this trigger</h3>
      {using.length === 0
        ? <p className={s.empty}>No tools currently bind this trigger.</p>
        : <MemberLinks tools={using} onNavigate={onNavigate} />}
    </div>
  );
}

function SlotDetail({
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
      <h3>Tools mounted in this slot</h3>
      <MemberLinks tools={here} onNavigate={onNavigate} />
    </div>
  );
}

function RouteTargetDetail({
  entry, tools, onNavigate,
}: { entry: RouteTargetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const matching = t.routes.filter((r) => parseRoute(r).target === entry.id);
    return matching.length === 0 ? [] : [{ tool: t, routes: matching }];
  });
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Route-table key — target kind for click/dblTap/drag, key name for
        keyDown/keyUp, or <code>*</code> for wheel / function-form drag.
      </p>
      <h3>Tools routing to this target</h3>
      {rows.length === 0
        ? <p className={s.empty}>No tools route to this target.</p>
        : (
          <ul className={s.memberList}>
            {rows.map(({ tool, routes }) => (
              <li key={tool.id}>
                <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: tool.id })}>{tool.id}</button>
                {routes.map((r) => <code key={r} className={s.tag}>{r}</code>)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function ModifierSetDetail({
  entry, tools, onNavigate,
}: { entry: ModifierSetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const matching = t.routes.filter((r) => parseRoute(r).modifiers === entry.id);
    return matching.length === 0 ? [] : [{ tool: t, routes: matching }];
  });
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Canonical modifier-key combination keying a route sub-table.
        {' '}<code>default</code> means no modifier sub-table.
      </p>
      <h3>Tools with routes under this modifier set</h3>
      {rows.length === 0
        ? <p className={s.empty}>No tools declare routes under this modifier set.</p>
        : (
          <ul className={s.memberList}>
            {rows.map(({ tool, routes }) => (
              <li key={tool.id}>
                <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: tool.id })}>{tool.id}</button>
                {routes.map((r) => <code key={r} className={s.tag}>{r}</code>)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function GroupDetail({
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
      <dl className={s.detailList}>
        <dt>source</dt><dd><code className={s.tag}>{entry.source}</code></dd>
      </dl>
      {entry.source === 'tool' && (
        <>
          <h3>Tools in this presentation group</h3>
          <MemberLinks tools={memberTools} onNavigate={onNavigate} />
        </>
      )}
      {entry.source === 'action' && (
        <>
          <h3>Actions in this group</h3>
          <ul className={s.memberList}>
            {memberActions.map((a) => (
              <li key={a.id}><code className={s.tag}>{a.id}</code></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemberLinks({
  tools, onNavigate,
}: { tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  return (
    <ul className={s.memberList}>
      {tools.map((t) => (
        <li key={t.id}>
          <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: t.id })}>{t.id}</button>
        </li>
      ))}
    </ul>
  );
}

function PhaseDetail({
  entry, tools, onNavigate,
}: { entry: PhaseEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const declaring = tools.filter((t) =>
    entry.id === 'initial' ? true : t.phases.engaged !== undefined,
  );
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        {entry.id === 'initial'
          ? 'Resting phase — every tool declares an initial phase.'
          : 'Engaged phase — entered after a gesture transition (e.g. drag start).'}
      </p>
      <h3>Tools declaring this phase</h3>
      <ul className={s.memberList}>
        {declaring.map((t) => {
          const channels = activeChannels(
            (entry.id === 'initial' ? t.phases.initial : t.phases.engaged) ?? EMPTY_PHASE,
          );
          return (
            <li key={t.id}>
              <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: t.id })}>{t.id}</button>
              {channels.map((c) => <code key={c} className={s.tag}>{c}</code>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GestureDetail({
  entry, tools, onNavigate,
}: { entry: GestureEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const phases: ('initial' | 'engaged')[] = [];
    if (t.phases.initial[entry.id]) phases.push('initial');
    if (t.phases.engaged?.[entry.id]) phases.push('engaged');
    return phases.length === 0 ? [] : [{ tool: t, phases }];
  });
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>Input channel. Tools below subscribe to it in the listed phase(s).</p>
      <h3>Tools</h3>
      {rows.length === 0
        ? <p className={s.empty}>No tools declare this channel.</p>
        : (
          <ul className={s.memberList}>
            {rows.map(({ tool, phases }) => (
              <li key={tool.id}>
                <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: tool.id })}>{tool.id}</button>
                {phases.map((p) => <code key={p} className={s.tag}>{p}</code>)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

const EMPTY_PHASE: PhaseSummary = {
  click: false, pointerDown: false, dblTap: false, drag: false,
  wheel: false, keyDown: false, keyUp: false,
  cursor: false, overlay: false, claimsAll: false,
};

function IconDetail({ entry }: { entry: IconEntry }) {
  const C = entry.Component;
  const match = findSourceMatch(entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <div className={s.iconPreviewRow}>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellSmall}`}><C /></div>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellLarge}`}><C /></div>
      </div>
      <dl className={s.detailList}>
        <dt>source</dt><dd><code className={s.tag}>{entry.source}</code></dd>
        {match?.path && (<><dt>file</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

const PHASE_CHANNEL_KEYS: readonly (keyof PhaseSummary)[] = [
  'click', 'pointerDown', 'dblTap', 'drag', 'wheel',
  'keyDown', 'keyUp', 'cursor', 'overlay', 'claimsAll',
];

function activeChannels(p: PhaseSummary): readonly string[] {
  return PHASE_CHANNEL_KEYS.filter((k) => p[k]);
}

function ToolDetail({ entry, onNavigate }: { entry: ToolEntry; onNavigate: Props['onNavigate'] }) {
  const bundles = collectBundles().filter((b) => b.tools.includes(entry.id));
  const match = findSourceMatch(entry.hookName ?? entry.id);
  const caps = (Object.entries(entry.capabilities) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);
  return (
    <div>
      <div className={s.toolHeader}>
        {entry.presentation?.icon && (
          <span className={s.toolIcon} aria-hidden>{entry.presentation.icon}</span>
        )}
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <dl className={s.detailList}>
        {entry.hookName && (
          <>
            <dt>hook</dt>
            <dd><EntryLink kind="publicExport" id={entry.hookName} onNavigate={onNavigate} /></dd>
          </>
        )}
        <dt>slot</dt>
        <dd><EntryLink kind="slot" id={entry.slot} onNavigate={onNavigate} /></dd>
        {entry.switchShortcutParts && (
          <><dt>shortcut</dt><dd><KeyCap parts={entry.switchShortcutParts} /></dd></>
        )}
        {entry.hotkey && (
          <>
            <dt>hotkey</dt>
            <dd>
              <KeyCap parts={[entry.hotkey.toUpperCase()]} />
              <EntryLink kind="hotkeyTrigger" id={entry.hotkey} label={entry.hotkey} onNavigate={onNavigate} />
            </dd>
          </>
        )}
        {entry.cursor && (<><dt>cursor</dt><dd><code>{entry.cursor}</code></dd></>)}
        {entry.presentation && (
          <>
            <dt>presentation</dt>
            <dd>
              {entry.presentation.label && <span className={s.tag}>{entry.presentation.label}</span>}
              {entry.presentation.group && (
                <EntryLink
                  kind="group"
                  id={`tool:${entry.presentation.group}`}
                  label={`group: ${entry.presentation.group}`}
                  onNavigate={onNavigate}
                />
              )}
              {entry.presentation.shortcut && <span className={s.tag}>shortcut: {entry.presentation.shortcut}</span>}
            </dd>
          </>
        )}
        <dt>phases</dt>
        <dd>
          <PhaseRow label="initial" phase={entry.phases.initial} />
          {entry.phases.engaged && <PhaseRow label="engaged" phase={entry.phases.engaged} />}
        </dd>
        {caps.length > 0 && (
          <>
            <dt>capabilities</dt>
            <dd>{caps.map((c) => <code key={c} className={s.tag}>{c}</code>)}</dd>
          </>
        )}
        {entry.routes.length > 0 && (
          <>
            <dt>routes</dt>
            <dd>{entry.routes.map((r) => <code key={r} className={s.tag}>{r}</code>)}</dd>
          </>
        )}
        {bundles.length > 0 && (
          <>
            <dt>in bundles</dt>
            <dd>
              {bundles.map((b) => (
                <EntryLink key={b.id} kind="bundle" id={b.id} label={b.label} onNavigate={onNavigate} />
              ))}
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

function PhaseRow({ label, phase }: { label: string; phase: PhaseSummary }) {
  const channels = activeChannels(phase);
  return (
    <div className={s.phaseRow}>
      <span className={s.phaseLabel}>{label}</span>
      {channels.length === 0
        ? <span className={s.empty}>—</span>
        : channels.map((c) => <code key={c} className={s.tag}>{c}</code>)}
    </div>
  );
}

function ActionDetail({ entry, onNavigate }: { entry: ActionEntry; onNavigate: Props['onNavigate'] }) {
  const match = findSourceMatch(entry.id);
  return (
    <div>
      <div className={s.toolHeader}>
        {entry.icon && <span className={s.toolIcon} aria-hidden>{entry.icon}</span>}
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <dl className={s.detailList}>
        <dt>label</dt><dd>{entry.label}</dd>
        {entry.group && (
          <>
            <dt>group</dt>
            <dd><EntryLink kind="group" id={`action:${entry.group}`} label={entry.group} onNavigate={onNavigate} /></dd>
          </>
        )}
        {entry.shortcutParts && (
          <><dt>binding</dt><dd><KeyCap parts={entry.shortcutParts} /></dd></>
        )}
        {entry.shortcut && (
          <><dt>shortcut</dt><dd><code>{entry.shortcut}</code></dd></>
        )}
        {entry.enabled && (
          <>
            <dt>enabled</dt>
            <dd>
              {entry.enabled.enabled
                ? <code className={s.tag}>true</code>
                : <>
                    <code className={s.tag}>false</code>
                    <span className={s.empty}> ({entry.enabled.reason})</span>
                  </>}
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

type BundleMemberRow = { id: string; tool: ToolEntry | undefined };

function bundleMemberColumns(
  onNavigate: Props['onNavigate'],
): readonly DataGridColumn<BundleMemberRow>[] {
  return [
    {
      id: 'label',
      header: 'Tool',
      accessor: (r) => r.tool?.label ?? r.id,
      render: (r) => (
        <button
          type="button"
          className={s.memberLink}
          onClick={() => onNavigate({ kind: 'tool', id: r.id })}
        >
          {r.tool?.label ?? r.id}
        </button>
      ),
    },
    {
      id: 'id',
      header: 'id',
      accessor: (r) => r.id,
      render: (r) => <code>{r.id}</code>,
    },
    {
      id: 'hook',
      header: 'hook',
      accessor: (r) => r.tool?.hookName ?? '',
      render: (r) => r.tool?.hookName
        ? <code>{r.tool.hookName}</code>
        : <span className={s.empty}>—</span>,
    },
    {
      id: 'group',
      header: 'group',
      accessor: (r) => r.tool?.presentation?.group ?? '',
      render: (r) => r.tool?.presentation?.group ?? <span className={s.empty}>—</span>,
    },
    {
      id: 'shortcut',
      header: 'shortcut',
      sortable: false,
      render: (r) => <KeyCap parts={r.tool?.switchShortcutParts} />,
    },
  ];
}

function BundleDetail({
  entry, tools, onNavigate,
}: {
  entry: BundleEntry;
  tools: readonly ToolEntry[];
  onNavigate: Props['onNavigate'];
}) {
  const byId = new Map(tools.map((t) => [t.id, t]));
  const others = collectBundles().filter((b) => b.id !== entry.id);
  // Group breakdown — counts of presentation.group across the bundle's tools.
  const groupCounts = new Map<string, number>();
  for (const id of entry.tools) {
    const g = byId.get(id)?.presentation?.group ?? '—';
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <dl className={s.detailList}>
        <dt>id</dt><dd><code className={s.tag}>{entry.id}</code></dd>
        <dt>tool count</dt><dd>{entry.tools.length}</dd>
        <dt>by group</dt>
        <dd>
          {[...groupCounts.entries()].map(([g, n]) => (
            <code key={g} className={s.tag}>{g}: {n}</code>
          ))}
        </dd>
      </dl>
      <h3 className={s.subHeading}>Tools</h3>
      <DataGrid
        rows={entry.tools.map((id) => ({ id, tool: byId.get(id) }))}
        columns={bundleMemberColumns(onNavigate)}
        empty="No tools in this bundle."
      />
      <h3 className={s.subHeading}>Diff vs other bundles</h3>
      <dl className={s.detailList}>
        {others.map((o) => {
          const mine = new Set(entry.tools);
          const theirs = new Set(o.tools);
          const added = entry.tools.filter((t) => !theirs.has(t));
          const removed = o.tools.filter((t) => !mine.has(t));
          return (
            <Fragment key={o.id}>
              <dt>vs {o.label}</dt>
              <dd>
                {added.length === 0 && removed.length === 0
                  ? <span className={s.empty}>(identical)</span>
                  : <>
                      {added.map((t) => (
                        <button
                          key={`+${t}`}
                          type="button"
                          className={`${s.memberLink} ${s.tagAdded}`}
                          onClick={() => onNavigate({ kind: 'tool', id: t })}
                        >+{t}</button>
                      ))}
                      {removed.map((t) => (
                        <button
                          key={`-${t}`}
                          type="button"
                          className={`${s.memberLink} ${s.tagRemoved}`}
                          onClick={() => onNavigate({ kind: 'tool', id: t })}
                        >−{t}</button>
                      ))}
                    </>}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function ShapeKindDetail({
  entry, onNavigate,
}: {
  entry: ShapeKindEntry;
  onNavigate: Props['onNavigate'];
}) {
  const match = findSourceMatch(entry.hookName ?? entry.id);
  const opTargets = collectOpFactoriesTargeting(entry.id);
  return (
    <div>
      <div className={s.toolHeader}>
        <span className={s.toolIcon} aria-hidden>
          <ToolIcon tool={entry.id as ToolKind} />
        </span>
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <dl className={s.detailList}>
        <dt>kind</dt><dd><code className={s.tag}>shape</code></dd>
        {entry.tool && (
          <>
            <dt>authored by</dt>
            <dd>
              <button type="button" className={s.memberLink}
                onClick={() => onNavigate({ kind: 'tool', id: entry.tool! })}>
                {entry.hookName ?? entry.tool}
              </button>
            </dd>
          </>
        )}
        {opTargets.length > 0 && (
          <>
            <dt>op factories</dt>
            <dd>
              {opTargets.map((f) => (
                <EntryLink key={f} kind="opFactory" id={f} onNavigate={onNavigate} />
              ))}
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

/** Op factories that operate on any shape's pose regardless of kind. We don't
 *  have per-kind targeting in the registry today — every factory accepts any
 *  shape — so the list is uniform. Kept as a helper so a future per-kind
 *  filter (e.g. text-only `createSetTextOp`) plugs in here. */
function collectOpFactoriesTargeting(_kindId: string): readonly string[] {
  return ['createInsertOp', 'createDeleteOp', 'createTransformOp', 'createReparentOp'];
}

function OpFactoryDetail({ entry }: { entry: OpFactoryEntry }) {
  const fn = (Weasel as Record<string, unknown>)[entry.id];
  const match = findSourceMatch(entry.id);
  const arity = typeof fn === 'function' ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>kind</dt><dd><code className={s.tag}>op factory</code></dd>
        <dt>runtime</dt><dd><code className={s.tag}>{typeof fn}</code></dd>
        {arity !== undefined && (
          <><dt>parameters</dt><dd>{arity}</dd></>
        )}
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

function PublicExportDetail({
  entry, tools, onNavigate,
}: {
  entry: PublicExportEntry;
  tools: readonly ToolEntry[];
  onNavigate: Props['onNavigate'];
}) {
  const value = (Weasel as Record<string, unknown>)[entry.id];
  const classification = classifyExport(entry.id, value);
  const match = findSourceMatch(entry.id);
  // Back-link: if a bundled icon shares this name (e.g. `RectIcon`), surface
  // it so consumers can find the visual asset behind a public re-export.
  const iconHit = collectIcons().find((i) => i.id === entry.id);
  // Tool-hook back-link: `useRectTool` → tool id `rect`. Resolved via the
  // live tools snapshot — match by `hookName` so renamed hooks still link.
  const toolHit = tools.find((t) => t.hookName === entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>classification</dt>
        <dd>{classification.map((c) => <code key={c} className={s.tag}>{c}</code>)}</dd>
        <dt>runtime</dt><dd><code className={s.tag}>{typeof value}</code></dd>
        {toolHit && (
          <>
            <dt>tool</dt>
            <dd><EntryLink kind="tool" id={toolHit.id} label={toolHit.label} onNavigate={onNavigate} /></dd>
          </>
        )}
        {iconHit && (
          <>
            <dt>icon</dt>
            <dd>
              <span className={s.toolIcon} aria-hidden><iconHit.Component /></span>
              <EntryLink kind="icon" id={iconHit.id} onNavigate={onNavigate} />
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><code>{match.path}</code></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

/** Classify a public export by runtime shape + naming convention. Tags are
 *  additive: a `useFoo` function gets both `hook` and `function`; an
 *  exported `Foo` function gets `component` only when the name starts with
 *  an uppercase letter (React-component convention). Types-only exports
 *  don't appear at runtime, so they aren't represented here. */
function classifyExport(id: string, value: unknown): readonly string[] {
  const tags: string[] = [];
  const t = typeof value;
  if (t === 'function') {
    tags.push('function');
    if (/^use[A-Z]/.test(id)) tags.push('hook');
    else if (/^[A-Z]/.test(id)) tags.push('component');
  } else if (t === 'object' && value !== null) {
    tags.push('object');
  } else if (t === 'symbol') {
    tags.push('symbol');
  } else {
    tags.push(t);
  }
  if (TOOL_HOOK_NAMES[id.replace(/^use/, '').replace(/Tool$/, '').toLowerCase()] === id) {
    tags.push('tool hook');
  }
  return tags;
}
