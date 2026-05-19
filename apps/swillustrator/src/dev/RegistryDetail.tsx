import { Fragment } from 'react';
import { Badge, DataGrid, KeySequence, type BadgeProps, type DataGridColumn, type KeySpec } from '@orochi235/weasel-ui';
import type { ParsedModifiers, ModName } from '@orochi235/weasel/routing';

function toKeys(parts: readonly string[] | undefined) {
  return parts?.map((label) => ({ label }));
}

const MOD_GLYPHS: Record<ModName, string> = { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃', meta: '⌘' };
const MOD_DISPLAY_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

/** Decompose a `ParsedModifiers` map into KeySpecs for KeySequence. Empty
 *  map (no required modifiers) returns undefined; otherwise emits one chip
 *  per modifier in canonical display order, marking optional ones inverted
 *  so the consumer can visually distinguish `?shift` from `+shift`. */
function modifierKeys(modifiers: ParsedModifiers): readonly KeySpec[] | undefined {
  const keys: KeySpec[] = [];
  for (const name of MOD_DISPLAY_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) {
      keys.push({ label: MOD_GLYPHS[name], optional: req === 'optional' });
    }
  }
  return keys.length > 0 ? keys : undefined;
}
import s from './RegistryInspector.module.css';
import type {
  TreeEntry, ToolEntry, ActionEntry, BundleEntry, IconEntry, OpFactoryEntry,
  PublicExportEntry, ShapeKindEntry, PhaseSummary, PhaseEntry, GestureEntry, PhaseOutputEntry,
  OpKindEntry, HotkeyTriggerEntry, SlotEntry, RouteEntry, RouteTargetEntry, ModifierSetEntry, GroupEntry,
  MetaEntry, CallbackRef,
} from './registryData';
import { BOOLEAN_BADGE_PROPS, BUNDLE_BADGE_PROPS, GESTURE_BADGE_PROPS, HOTKEY_TRIGGER_GLYPHS, KIND_BADGE_PROPS, PHASE_BADGE_PROPS, TOKEN_SETS, type TokenSet } from './badgeTokens';
import { canonicalModifiers, getGestureDescriptor, type GestureName } from '@orochi235/weasel/routing';
import { collectBundles, collectIcons, GESTURE_CHANNEL_KEYS, PHASE_OUTPUT_KEYS, parseRoute, TOOL_HOOK_NAMES } from './registryData';
void GESTURE_CHANNEL_KEYS;
void PHASE_OUTPUT_KEYS;

/** Decomposes a v3 route string (`[phaseList] gesture(arg) => target +mod`)
 *  into its constituent tokens — bracketed phase list, gesture badge,
 *  optional arg chip, target tag, modifier sequence. Targets equal to the
 *  wildcard `*` are elided; arg chips are elided when the gesture descriptor
 *  has a default and the parsed arg matches it. */
export function RouteBadge({ route }: { route: string }) {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const modKeys = modifierKeys(parsed.modifiers);
  const showArg = !!desc.arg
    && parsed.arg !== undefined
    && (desc.arg.default === undefined || parsed.arg !== desc.arg.default);
  const showTarget = desc.hasTarget && parsed.target !== undefined && parsed.target !== '*';
  const targetless = !desc.hasTarget;
  return (
    <span className={s.routeBadge}>
      <span className={s.phaseGroup}>
        {parsed.phases.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={s.phaseSep}>,</span>}
            <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{p}</Badge>
          </Fragment>
        ))}
      </span>
      <Badge
        {...(GESTURE_BADGE_PROPS as BadgeProps)}
        className={targetless && !showArg ? s.flatRight : undefined}
      >
        {parsed.gesture}
      </Badge>
      {showArg && (
        <code className={[s.argChip, targetless ? s.flatLeft : undefined].filter(Boolean).join(' ')}>
          {parsed.arg}
        </code>
      )}
      {showTarget && <code className={s.tag}>{parsed.target}</code>}
      {modKeys && <KeySequence keys={modKeys} />}
    </span>
  );
}

function KindBadge({ label }: { label: string }) {
  return <Badge {...(KIND_BADGE_PROPS as BadgeProps)}>{label}</Badge>;
}

function BundleBadge({ id, label }: { id: string; label?: string }) {
  const props = (BUNDLE_BADGE_PROPS as Record<string, Omit<BadgeProps, 'children'>>)[id];
  if (!props) return <code className={s.tag}>{label ?? id}</code>;
  return <Badge {...(props as BadgeProps)}>{label ?? id}</Badge>;
}
void parseRoute;
import * as Weasel from '@orochi235/weasel';
import { ToolIcon } from '../kindIcons';
import type { ToolKind } from '../poseUpdate';
import { findSourceMatch } from './sourceLookup';

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
    case 'phaseOutput':   return <PhaseOutputDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'opKind':        return <OpKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'hotkeyTrigger': return <HotkeyTriggerDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'slot':          return <SlotDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'route':         return <RouteDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'routeTarget':   return <RouteTargetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'modifierSet':   return <ModifierSetDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'group':         return <GroupDetail entry={entry} tools={tools} actions={actions} onNavigate={onNavigate} />;
    case 'meta':          return <MetaDetail entry={entry} />;
  }
}

function MetaDetail({ entry }: { entry: MetaEntry }) {
  if (entry.id === 'tokens') return <TokensDetail />;
  return null;
}

function TokensDetail() {
  return (
    <div>
      <h2 className={s.detailHeading}>Tokens</h2>
      <p className={s.empty}>
        Catalog of badge / keycap styles the inspector maps onto enumerated
        types. Each set lists every value alongside its rendered chip so the
        family reads consistently wherever it appears.
      </p>
      {TOKEN_SETS.map((set) => (
        <section key={set.id}>
          <h3 className={s.subHeading}>{set.label}</h3>
          <p className={s.empty}>{set.description}</p>
          <TokenSetTable set={set} />
        </section>
      ))}
    </div>
  );
}

function TokenSetTable({ set }: { set: TokenSet }) {
  if (set.kind === 'badge') {
    return (
      <DataGrid
        rows={set.entries.map((e) => ({ id: e.value, entry: e }))}
        columns={[
          { id: 'value', header: 'value', accessor: (r) => r.entry.value, render: (r) => <code className={s.tag}>{r.entry.value}</code> },
          { id: 'preview', header: 'preview', accessor: (r) => r.entry.value, render: (r) => <Badge {...(r.entry.props as BadgeProps)}>{r.entry.value}</Badge> },
        ]}
        empty="No entries."
      />
    );
  }
  if (set.kind === 'keycap') {
    return (
      <DataGrid
        rows={set.entries.map((e) => ({ id: e.value, entry: e }))}
        columns={[
          { id: 'value', header: 'value', accessor: (r) => r.entry.value, render: (r) => <code className={s.tag}>{r.entry.value}</code> },
          { id: 'preview', header: 'preview', accessor: (r) => r.entry.value, render: (r) => <KeySequence keys={toKeys(r.entry.props.parts)} /> },
        ]}
        empty="No entries."
      />
    );
  }
  return (
    <DataGrid
      rows={set.entries.map((e) => ({ id: e.value, entry: e }))}
      columns={[
        { id: 'value', header: 'value', accessor: (r) => r.entry.value, render: (r) => <code className={s.tag}>{r.entry.value}</code> },
        { id: 'preview', header: 'preview', accessor: (r) => r.entry.value, render: (r) => <RouteBadge route={r.entry.props.route} /> },
      ]}
      empty="No entries."
    />
  );
}

function OpKindDetail({ entry }: { entry: OpKindEntry; onNavigate: Props['onNavigate'] }) {
  const factoryId = `create${entry.id.charAt(0).toUpperCase()}${entry.id.slice(1)}Op`;
  const fn = (Weasel as Record<string, unknown>)[factoryId];
  const match = findSourceMatch(factoryId);
  const arity = typeof fn === 'function' ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Stable name stamped onto every <code>Op</code> produced by its factory —
        used by <code>History.serialize</code> / <code>restore</code> to rebuild
        ops across reloads.
      </p>
      <dl className={s.detailList}>
        <dt>factory</dt><dd><code>{factoryId}</code></dd>
        <dt>runtime</dt><dd><code className={s.tag}>{typeof fn}</code></dd>
        {arity !== undefined && (
          <><dt>parameters</dt><dd>{arity}</dd></>
        )}
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

function HotkeyTriggerDetail({
  entry, tools, onNavigate,
}: { entry: HotkeyTriggerEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const using = tools.filter((t) => t.hotkey === entry.id);
  const glyphs = HOTKEY_TRIGGER_GLYPHS[entry.id];
  return (
    <div>
      <h2 className={s.detailHeading}>
        {glyphs && <KeySequence keys={toKeys(glyphs)} />} {entry.id}
      </h2>
      <p className={s.empty}>Press-and-hold trigger key for the hotkey tool slot.</p>
      <h3 className={s.subHeading}>Tools bound to this trigger</h3>
      <DataGrid
        rows={using.map((t) => ({ id: t.id, tool: t }))}
        columns={[toolNameColumn(onNavigate)]}
        empty="No tools currently bind this trigger."
      />
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
      <h3 className={s.subHeading}>Tools mounted in this slot</h3>
      <DataGrid
        rows={here.map((t) => ({ id: t.id, tool: t }))}
        columns={[toolNameColumn(onNavigate)]}
        empty="No tools mounted in this slot."
      />
    </div>
  );
}

function RouteDetail({
  entry, tools, onNavigate,
}: { entry: RouteEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const parsed = parseRoute(entry.id);
  const rows = tools
    .filter((t) => t.routes.includes(entry.id))
    .map((t) => ({ id: t.id, tool: t }));
  return (
    <div>
      <h2 className={s.detailHeading}><RouteBadge route={entry.id} /></h2>
      <dl className={s.detailList}>
        <dt>phases</dt><dd>{parsed.phases.join(', ')}</dd>
        <dt>gesture</dt><dd><code className={s.tag}>{parsed.gesture}</code></dd>
        {parsed.arg !== undefined && (<><dt>arg</dt><dd><code className={s.tag}>{parsed.arg}</code></dd></>)}
        {parsed.target !== undefined && (
          <>
            <dt>target</dt>
            <dd><EntryLink kind="routeTarget" id={parsed.target} onNavigate={onNavigate} /></dd>
          </>
        )}
        {Object.keys(parsed.modifiers).length > 0 && (
          <>
            <dt>modifiers</dt>
            <dd>
              {Object.entries(parsed.modifiers).map(([name, req]) => (
                <code key={name} className={s.tag}>{req === 'required' ? '+' : '?'}{name}</code>
              ))}
            </dd>
          </>
        )}
      </dl>
      <h3 className={s.subHeading}>Tools declaring this route</h3>
      <DataGrid
        rows={rows}
        columns={[toolNameColumn(onNavigate)]}
        empty="No tools declare this route."
      />
    </div>
  );
}

function RouteTargetDetail({
  entry, tools, onNavigate,
}: { entry: RouteTargetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const matching = t.routes.filter((r) => parseRoute(r).target === entry.id);
    return matching.length === 0 ? [] : [{ id: t.id, tool: t, routes: matching }];
  });
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
          toolNameColumn(onNavigate),
          {
            id: 'routes',
            header: 'routes',
            sortable: false,
            render: (r) => <span>{r.routes.map((rt) => <RouteBadge key={rt} route={rt} />)}</span>,
          },
        ]}
        empty="No tools route to this target."
      />
    </div>
  );
}

function ModifierSetDetail({
  entry, tools, onNavigate,
}: { entry: ModifierSetEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const matching = t.routes.filter((r) =>
      (canonicalModifiers(parseRoute(r).modifiers) || 'default') === entry.id);
    return matching.length === 0 ? [] : [{ id: t.id, tool: t, routes: matching }];
  });
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
          toolNameColumn(onNavigate),
          {
            id: 'routes',
            header: 'routes',
            sortable: false,
            render: (r) => <span>{r.routes.map((rt) => <RouteBadge key={rt} route={rt} />)}</span>,
          },
        ]}
        empty="No tools declare routes under this modifier set."
      />
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

function PhaseDetail({
  entry, tools, onNavigate,
}: { entry: PhaseEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const declaring = tools.filter((t) =>
    entry.id === 'initial' ? true : t.phases.engaged !== undefined,
  );
  const rows = declaring.map((t) => {
    const phase = (entry.id === 'initial' ? t.phases.initial : t.phases.engaged) ?? EMPTY_PHASE;
    return {
      id: t.id,
      tool: t,
      gestures: activeGestures(phase),
      outputs: activeOutputs(phase),
    };
  });
  return (
    <div>
      <h2 className={s.detailHeading}><Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{entry.label}</Badge></h2>
      <p className={s.empty}>
        {entry.id === 'initial'
          ? 'Resting phase — every tool declares an initial phase.'
          : 'Engaged phase — entered after a gesture transition (e.g. drag start).'}
      </p>
      <h3 className={s.subHeading}>Tools declaring this phase</h3>
      <DataGrid
        rows={rows}
        columns={[
          toolNameColumn(onNavigate),
          {
            id: 'gestures',
            header: 'gestures',
            sortable: false,
            render: (r) => r.gestures.length === 0
              ? <span className={s.empty}>—</span>
              : <span>{r.gestures.map((g) => (
                  <Badge key={g} {...(GESTURE_BADGE_PROPS as BadgeProps)}>{g}</Badge>
                ))}</span>,
          },
          {
            id: 'outputs',
            header: 'outputs',
            sortable: false,
            render: (r) => r.outputs.length === 0
              ? <span className={s.empty}>—</span>
              : <span>{r.outputs.map((o) => (
                  <code key={o} className={s.tag}>{o}</code>
                ))}</span>,
          },
        ]}
        empty="No tools declare this phase."
      />
    </div>
  );
}

function GestureDetail({
  entry, tools, onNavigate,
}: { entry: GestureEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const phases: ('initial' | 'engaged')[] = [];
    if (t.phases.initial.gestures[entry.id]) phases.push('initial');
    if (t.phases.engaged?.gestures[entry.id]) phases.push('engaged');
    return phases.length === 0 ? [] : [{ id: t.id, tool: t, phases }];
  });
  return (
    <div>
      <h2 className={s.detailHeading}><Badge {...(GESTURE_BADGE_PROPS as BadgeProps)}>{entry.label}</Badge></h2>
      <p className={s.empty}>Input channel. Tools below subscribe to it in the listed phase(s).</p>
      <h3 className={s.subHeading}>Tools</h3>
      <DataGrid
        rows={rows}
        columns={[
          toolNameColumn(onNavigate),
          {
            id: 'phases',
            header: 'phases',
            sortable: false,
            render: (r) => (
              <span>
                {r.phases.map((p) => (
                  <Badge key={p} {...(PHASE_BADGE_PROPS as BadgeProps)}>{p}</Badge>
                ))}
              </span>
            ),
          },
        ]}
        empty="No tools declare this channel."
      />
    </div>
  );
}

function PhaseOutputDetail({
  entry, tools, onNavigate,
}: { entry: PhaseOutputEntry; tools: readonly ToolEntry[]; onNavigate: Props['onNavigate'] }) {
  const rows = tools.flatMap((t) => {
    const phases: ('initial' | 'engaged')[] = [];
    if (t.phases.initial.outputs[entry.id]) phases.push('initial');
    if (t.phases.engaged?.outputs[entry.id]) phases.push('engaged');
    return phases.length === 0 ? [] : [{ id: t.id, tool: t, phases }];
  });
  // PhaseDef docs: only `initial.overlay` is read by the runtime; the
  // engaged-phase form is currently a declarative no-op. Same caveat doesn't
  // apply to `cursor` / `claimsAll`, which both phases honor.
  const engagedNoop = entry.id === 'overlay';
  const blurb = entry.id === 'overlay'
    ? 'Render layer emitted while the tool is active. Only initial.overlay is read by the runtime today.'
    : entry.id === 'cursor'
      ? 'CSS cursor the tool declares (string or scratch-aware thunk).'
      : 'Modal-claim predicate. When true, the dispatcher routes every pointerdown to this tool and bypasses affordance hit-tests.';
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        Phase output — the tool <em>declares or emits</em> this, rather than reacting to an input event. {blurb}
      </p>
      <h3 className={s.subHeading}>Tools declaring this output</h3>
      <DataGrid
        rows={rows}
        columns={[
          toolNameColumn(onNavigate),
          {
            id: 'phases',
            header: 'phases',
            sortable: false,
            render: (r) => (
              <span>
                {r.phases.map((p) => (
                  <Badge
                    key={p}
                    {...(PHASE_BADGE_PROPS as BadgeProps)}
                    className={engagedNoop && p === 'engaged' ? s.empty : undefined}
                    aria-label={engagedNoop && p === 'engaged' ? 'Declared but not read by the runtime' : undefined}
                  >
                    {p}
                  </Badge>
                ))}
              </span>
            ),
          },
        ]}
        empty="No tools declare this output."
      />
    </div>
  );
}

/** Shared "Tool" column for inspector DataGrids — renders the tool id as a
 *  clickable EntryLink that navigates to the matching tool entry. Row shape
 *  must carry `id` (DataGrid contract) and a `tool` ref for label lookup. */
function toolNameColumn(
  onNavigate: Props['onNavigate'],
): DataGridColumn<{ id: string; tool: ToolEntry }> {
  return {
    id: 'tool',
    header: 'Tool',
    accessor: (r) => r.tool.label ?? r.id,
    render: (r) => (
      <button
        type="button"
        className={s.memberLink}
        onClick={() => onNavigate({ kind: 'tool', id: r.id })}
      >
        {r.tool.label ?? r.id}
      </button>
    ),
  };
}

const EMPTY_PHASE: PhaseSummary = {
  gestures: {
    click: false, pointerDown: false, dblTap: false, drag: false,
    wheel: false, keyDown: false, keyUp: false,
  },
  outputs: { cursor: false, overlay: false, claimsAll: false },
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
        {match?.path && (<><dt>file</dt><dd><SourceLink match={match} /></dd></>)}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

function activeGestures(p: PhaseSummary): readonly (keyof typeof p.gestures)[] {
  return GESTURE_CHANNEL_KEYS.filter((k) => p.gestures[k]);
}

function activeOutputs(p: PhaseSummary): readonly (keyof typeof p.outputs)[] {
  return PHASE_OUTPUT_KEYS.filter((k) => p.outputs[k]);
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
          <><dt>shortcut</dt><dd><KeySequence keys={toKeys(entry.switchShortcutParts)} /></dd></>
        )}
        {entry.hotkey && (
          <>
            <dt>hotkey</dt>
            <dd>
              <KeySequence keys={toKeys(HOTKEY_TRIGGER_GLYPHS[entry.hotkey] ?? [entry.hotkey.toUpperCase()])} />
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
            <dd>{entry.routes.map((r) => <RouteBadge key={r} route={r} />)}</dd>
          </>
        )}
        {bundles.length > 0 && (
          <>
            <dt>in bundles</dt>
            <dd>
              {bundles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={s.memberLink}
                  onClick={() => onNavigate({ kind: 'bundle', id: b.id })}
                >
                  <BundleBadge id={b.id} label={b.label} />
                </button>
              ))}
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
        {entry.callbacks && entry.callbacks.length > 0 && (
          <>
            <dt>callbacks</dt>
            <dd><CallbackList callbacks={entry.callbacks} /></dd>
          </>
        )}
      </dl>
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
    </div>
  );
}

/** Renders a list of source-linked callbacks as `vscode://file/...` anchors.
 *  Quiet (renders nothing) when the list is empty — the dev-only Vite
 *  plugin populates these; prod builds and untouched files leave them
 *  blank. */
function CallbackList({ callbacks }: { callbacks: readonly CallbackRef[] }) {
  if (callbacks.length === 0) return null;
  const root = WEASEL_REPO_ROOT;
  return (
    <ul className={s.callbackList}>
      {callbacks.map((cb) => {
        const rel = root && cb.source.file.startsWith(root + '/')
          ? cb.source.file.slice(root.length + 1)
          : cb.source.file;
        const href = `vscode://file/${cb.source.file}:${cb.source.line}:${cb.source.col + 1}`;
        return (
          <li key={`${cb.label}@${cb.source.file}:${cb.source.line}`}>
            <code className={s.tag}>{cb.label}</code>
            <a className={s.callbackLink} href={href}>
              {rel}:{cb.source.line}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

declare const __WEASEL_REPO_ROOT__: string | undefined;
const WEASEL_REPO_ROOT: string | undefined =
  typeof __WEASEL_REPO_ROOT__ === 'string' ? __WEASEL_REPO_ROOT__ : undefined;

/** Render a `findSourceMatch` result as a `vscode://file/...` link with
 *  `path:line` text. Falls back to plain text when the repo root isn't
 *  defined (e.g. test environments without Vite `define`). */
function SourceLink({ match }: { match: { path: string; line: number } }) {
  const root = WEASEL_REPO_ROOT;
  if (!root) return <code>{match.path}:{match.line}</code>;
  const abs = `${root}${match.path}`;
  return (
    <a className={s.callbackLink} href={`vscode://file/${abs}:${match.line}:1`}>
      {match.path}:{match.line}
    </a>
  );
}

function PhaseRow({ label, phase }: { label: string; phase: PhaseSummary }) {
  const gestures = activeGestures(phase);
  const outputs = activeOutputs(phase);
  return (
    <div className={s.phaseRow}>
      <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{label}</Badge>
      {gestures.length === 0 && outputs.length === 0
        ? <span className={s.empty}>—</span>
        : (
          <>
            {gestures.map((g) => (
              <Badge key={`g-${g}`} {...(GESTURE_BADGE_PROPS as BadgeProps)}>{g}</Badge>
            ))}
            {outputs.map((o) => (
              <code key={`o-${o}`} className={s.tag}>{o}</code>
            ))}
          </>
        )}
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
          <><dt>binding</dt><dd><KeySequence keys={toKeys(entry.shortcutParts)} /></dd></>
        )}
        {entry.shortcut && (
          <><dt>shortcut</dt><dd><code>{entry.shortcut}</code></dd></>
        )}
        {entry.enabled && (
          <>
            <dt>enabled</dt>
            <dd>
              {entry.enabled.enabled
                ? <Badge {...(BOOLEAN_BADGE_PROPS.true as BadgeProps)}>true</Badge>
                : <>
                    <Badge {...(BOOLEAN_BADGE_PROPS.false as BadgeProps)}>false</Badge>
                    <span className={s.empty}> ({entry.enabled.reason})</span>
                  </>}
            </dd>
          </>
        )}
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
        {entry.callbacks && entry.callbacks.length > 0 && (
          <>
            <dt>callbacks</dt>
            <dd><CallbackList callbacks={entry.callbacks} /></dd>
          </>
        )}
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
      render: (r) => <KeySequence keys={toKeys(r.tool?.switchShortcutParts)} />,
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
      <h2 className={s.detailHeading}><BundleBadge id={entry.id} label={entry.label} /></h2>
      <dl className={s.detailList}>
        <dt>id</dt><dd><code className={s.tag}>{entry.id}</code></dd>
        <dt>tool count</dt><dd>{entry.tools.length}</dd>
        <dt>by group</dt>
        <dd>
          {[...groupCounts.entries()].map(([g, n]) => (
            <code key={g} className={s.tag}>{g} <Badge shape="pill" size="sm" tone="neutral" variant="subtle">{n}</Badge></code>
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
              <dt>vs <BundleBadge id={o.id} label={o.label} /></dt>
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
        <dt>kind</dt><dd><KindBadge label="shape" /></dd>
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
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
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
        <dt>kind</dt><dd><KindBadge label="op factory" /></dd>
        <dt>runtime</dt><dd><code className={s.tag}>{typeof fn}</code></dd>
        {arity !== undefined && (
          <><dt>parameters</dt><dd>{arity}</dd></>
        )}
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
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
        {match?.path && (<><dt>source</dt><dd><SourceLink match={match} /></dd></>)}
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
