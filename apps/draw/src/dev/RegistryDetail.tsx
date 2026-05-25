import { Fragment, type ReactNode } from 'react';
import { Badge, DataGrid, KeyCap, KeySequence, Powerline, keySpecFromKey, keySpecsFromMods, type BadgeProps, type DataGridColumn, type KeySpec, type LogicalModSpec, type PowerlineProps } from '@orochi235/weasel-ui';
import type { ParsedModifiers, ModName } from '@orochi235/weasel/routing';

function toKeys(parts: readonly string[] | undefined) {
  return parts?.map((label) => ({ label }));
}

/** Minimal inline-markdown renderer — splits on backtick-delimited code
 *  spans and wraps each in <code>. No other markdown features. Sufficient
 *  for the route-field explanation glossary, which uses inline code only. */
function InlineMarkdown({ text }: { text: string }) {
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segments.map((seg, i) => (
        seg.startsWith('`') && seg.endsWith('`')
          ? <code key={i} className={s.tag}>{seg.slice(1, -1)}</code>
          : <Fragment key={i}>{seg}</Fragment>
      ))}
    </>
  );
}

const MOD_DISPLAY_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

/** Decompose a `ParsedModifiers` map into KeySpecs for KeySequence. Empty
 *  map (no required modifiers) returns undefined; otherwise emits one chip
 *  per modifier in canonical display order, marking optional ones inverted
 *  so the consumer can visually distinguish `?shift` from `+shift`.
 *  Delegates to `keySpecsFromMods` so labels are platform-aware
 *  (e.g. `mod` → ⌘ on macOS, Ctrl on Windows). */
/** One row in the per-binding params table rendered by `ActionDetail`. */
interface ActionParamRow {
  gesture: string;
  /** JSON-encoded params record, `'(dynamic)'` for thunk-form params, or
   *  `null` when the binding declares no params at all. */
  params: string | '(dynamic)' | null;
}

/** Summarize an Action's `defaultBinding` into (a) the union of parameter
 *  key names that can be passed to its invoker, and (b) one row per
 *  registered binding for the per-binding table. Non-array shapes (a bare
 *  `GestureSpec`, or no binding at all) yield empty results. */
function summarizeActionParams(
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

/** One-line, plain-text summary of a `GestureSpec` — `key R`, `key-held
 *  Space`, `wheel`. Just enough discrimination for the bindings table cell;
 *  full route rendering lives elsewhere (Powerline). */
function describeGestureSpec(
  spec: { kind?: string; key?: unknown } | undefined,
): string {
  if (!spec || !spec.kind) return '(unknown)';
  if (spec.kind === 'key' || spec.kind === 'key-held') {
    const k = Array.isArray(spec.key) ? (spec.key as readonly unknown[])[0] : spec.key;
    const label = typeof k === 'string' ? (k === ' ' ? 'Space' : k) : '?';
    return `${spec.kind} ${label}`;
  }
  return spec.kind;
}

/** Render a `HotkeyTrigger` value (`'space' | 'alt' | 'ctrl' | 'meta' |
 *  'shift' | ...`) as a single platform-aware `KeySpec`. The four modifier
 *  triggers flow through `keySpecsFromMods` (so `mod`-flavored entries
 *  render correctly on every OS); `space` flows through `keySpecFromKey`;
 *  anything else falls back to an upper-cased label. */
function hotkeyTriggerToKeySpec(trigger: string): KeySpec {
  if (trigger === 'shift' || trigger === 'alt' || trigger === 'ctrl'
      || trigger === 'meta' || trigger === 'mod') {
    return keySpecsFromMods([{ name: trigger }])[0]!;
  }
  if (trigger === 'space' || trigger === ' ') return keySpecFromKey(' ');
  return { label: trigger.toUpperCase() };
}

function modifierKeys(modifiers: ParsedModifiers): readonly KeySpec[] | undefined {
  const specs: LogicalModSpec[] = [];
  for (const name of MOD_DISPLAY_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) specs.push({ name, optional: req === 'optional' });
  }
  if (specs.length === 0) return undefined;
  return keySpecsFromMods(specs);
}
import s from './RegistryInspector.module.css';
import type {
  TreeEntry, ToolEntry, ActionEntry, BundleEntry, IconEntry, OpFactoryEntry,
  ShapeKindEntry, RoutingKindEntry, PhaseSummary, PhaseEntry, GestureEntry, PhaseOutputEntry,
  OpKindEntry, SlotEntry, RouteEntry, RouteTargetEntry, ModifierSetEntry, GroupEntry,
  MetaEntry, CallbackRef, TreeCategoryNode,
} from './registryData';
import { BOOLEAN_BADGE_PROPS, BUNDLE_BADGE_PROPS, CHANNEL_BADGE_PROPS, GESTURE_BADGE_PROPS, KIND_BADGE_PROPS, PHASE_BADGE_PROPS, TOKEN_SETS, type TokenSet } from './badgeTokens';
import { canonicalModifiers, describeRoute, describeRouteParts, formatPhaseAtom, getGestureDescriptor, ROUTE_FIELD_DEFINITIONS, type GestureName, type RouteFieldName } from '@orochi235/weasel/routing';
import { collectBundles, GESTURE_CHANNEL_KEYS, PHASE_OUTPUT_KEYS, parseRoute } from './registryData';
void GESTURE_CHANNEL_KEYS;
void PHASE_OUTPUT_KEYS;

/** Decomposes a v3 route string (`[phaseList] gesture(arg) => target +mod`)
 *  into its constituent tokens — bracketed phase list, gesture badge with
 *  fused arg, target tag, modifier sequence. Arg is rendered inside the
 *  gesture badge as `gesture(arg)`; descriptor defaults (e.g. `wheel(*)`)
 *  are kept visible but muted. Target is rendered whenever the descriptor
 *  has a target slot, with the wildcard `*` muted so specific targets
 *  visually dominate. */
export function RouteBadge({ route }: { route: string }) {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const modKeys = modifierKeys(parsed.modifiers);
  const hasArg = !!desc.arg && parsed.arg !== undefined;
  const argIsKey = hasArg && desc.arg?.name === 'key';
  const argIsDefault = hasArg && desc.arg?.default !== undefined && parsed.arg === desc.arg.default;
  const hasTarget = desc.hasTarget && parsed.target !== undefined;
  const targetIsWildcard = hasTarget && parsed.target === '*';
  return (
    <span className={s.routeBadge}>
      <span className={s.phaseGroup}>
        {parsed.phases.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={s.phaseSep}>,</span>}
            {p.channel !== '&' && (
              <Badge {...(CHANNEL_BADGE_PROPS as BadgeProps)}>{p.channel}</Badge>
            )}
            <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{p.phase}</Badge>
          </Fragment>
        ))}
      </span>
      <Badge {...(GESTURE_BADGE_PROPS as BadgeProps)}>
        {parsed.gesture}
        {hasArg && (argIsKey ? (
          <> <KeyCap label={keySpecFromKey(parsed.arg!).label} variant="minimal" className={s.routeKeyCap} /></>
        ) : (
          <span className={argIsDefault ? s.routeMuted : undefined}>({parsed.arg})</span>
        ))}
      </Badge>
      {modKeys && (
        <span className={s.modGroup}>
          <span className={s.modSigil}>+</span>
          <KeySequence keys={modKeys} />
        </span>
      )}
      {hasTarget && (
        <code className={[s.tag, targetIsWildcard ? s.routeMuted : undefined].filter(Boolean).join(' ')}>
          {parsed.target}
        </code>
      )}
    </span>
  );
}

/** Decomposes a v3 route string into a Powerline config. Mirrors RouteBadge's
 *  token order (phase atoms → gesture(arg) → target → modifier keys) but
 *  emits them as tessellated powerline segments. Arg fuses into the gesture
 *  segment as `gesture(arg)`; descriptor defaults and wildcard targets are
 *  kept visible (muted) so the strip reads as the full wiring at a glance. */
export function routeToPowerline(route: string): Omit<PowerlineProps, 'className' | 'aria-label'> {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const hasArg = !!desc.arg && parsed.arg !== undefined;
  const argIsKey = hasArg && desc.arg?.name === 'key';
  const argIsDefault = hasArg && desc.arg?.default !== undefined && parsed.arg === desc.arg.default;
  const hasTarget = desc.hasTarget && parsed.target !== undefined;
  const targetIsWildcard = hasTarget && parsed.target === '*';
  const modKeys = modifierKeys(parsed.modifiers);

  const segments: PowerlineProps['segments'] = [];
  for (const p of parsed.phases) {
    if (p.channel !== '&') segments.push({ text: p.channel, tone: 'neutral', variant: 'subtle' });
    segments.push({ text: p.phase, tone: 'accent', variant: 'subtle' });
  }
  segments.push({
    text: hasArg ? (
      argIsKey ? (
        <>
          {parsed.gesture}{' '}
          <KeyCap label={keySpecFromKey(parsed.arg!).label} variant="minimal" className={s.routeKeyCap} />
        </>
      ) : (
        <>
          {parsed.gesture}
          <span className={argIsDefault ? s.routeMuted : undefined}>({parsed.arg})</span>
        </>
      )
    ) : parsed.gesture,
    tone: 'info',
    variant: 'outline',
  });
  if (modKeys) {
    // Coalesce all modifiers into a single fused segment so the whole
    // "held keys" group reads as one chord rather than a chain of pills.
    // Sigils are inlined per-key: `+` for required, `?` for optional, so a
    // mixed set like `+mod ?shift` renders as `+⌘?⇧`.
    const text = modKeys.map((k) => `${k.optional ? '?' : '+'}${k.label}`).join('');
    segments.push({ text, tone: 'muted', variant: 'solid' });
  }
  if (hasTarget) {
    segments.push({
      text: parsed.target,
      tone: 'muted',
      variant: targetIsWildcard ? 'subtle' : 'outline',
    });
  }
  // Every cap is a chevron so the strip reads as a directional pipeline.
  for (let i = 0; i < segments.length - 1; i++) segments[i].endCap = 'chevron';
  return { segments };
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
 *  link back to its `<Bundle>` rows, a `<Bundle>` can link to `<Tool>` rows,
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
  /** Tree category the entry sits in. Used to render breadcrumbs above
   *  the detail heading. Optional — omit to suppress the breadcrumb. */
  category?: TreeCategoryNode | null;
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

export function RegistryDetail({ entry, tools, actions, category, onNavigate }: Props) {
  return (
    <>
      {category && (
        <nav className={s.breadcrumb} aria-label="Breadcrumb">
          {category.group && (
            <>
              <span>{category.group.label}</span>
              <span className={s.breadcrumbSep} aria-hidden>/</span>
            </>
          )}
          <span>{category.label}</span>
        </nav>
      )}
      {renderEntryBody(entry, tools, actions, onNavigate)}
    </>
  );
}

function renderEntryBody(
  entry: TreeEntry,
  tools: readonly ToolEntry[],
  actions: readonly ActionEntry[],
  onNavigate: Props['onNavigate'],
) {
  switch (entry.kind) {
    case 'tool':          return <ToolDetail entry={entry} onNavigate={onNavigate} />;
    case 'action':        return <ActionDetail entry={entry} onNavigate={onNavigate} />;
    case 'bundle':        return <BundleDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'shapeKind':     return <ShapeKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'routingKind':   return <RoutingKindDetail entry={entry} onNavigate={onNavigate} />;
    case 'icon':          return <IconDetail entry={entry} />;
    case 'opFactory':     return <OpFactoryDetail entry={entry} />;
    case 'phase':         return <PhaseDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'gesture':       return <GestureDetail entry={entry} tools={tools} actions={actions} onNavigate={onNavigate} />;
    case 'phaseOutput':   return <PhaseOutputDetail entry={entry} tools={tools} onNavigate={onNavigate} />;
    case 'opKind':        return <OpKindDetail entry={entry} onNavigate={onNavigate} />;
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
    <div className={s.routeDetailRoot}>
      <h2 className={s.detailHeading}><Powerline {...routeToPowerline(entry.id)} /></h2>
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
          { id: 'gesture', value: <code className={s.tag}>{parsed.gesture}</code> },
        ];
        if (parsed.arg !== undefined) {
          fieldRows.push({ id: 'arg', value: <code className={s.tag}>{parsed.arg}</code> });
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
              <code key={name} className={s.tag}>{req === 'required' ? '+' : '?'}{name}</code>
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

function RouteTargetDetail({
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

function ModifierSetDetail({
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
            render: (r) => <Powerline {...routeToPowerline(r.route)} />,
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

/** Two-way mapping between legacy `GestureChannels` keys and modern
 *  `GestureSpec.kind` values. The legacy phase grammar uses `pointerDown`,
 *  `dblTap`, `keyDown`+`keyUp`; the dispatcher's `GestureSpec` union uses
 *  `pointerdown`, `doubleClick`, and splits keys into `key` (initial press)
 *  and `key-held` (held while something else fires). A gesture catalog
 *  entry can be either vocabulary; this map normalizes both directions. */
const SPEC_KIND_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // Legacy → modern (catalog id is a phase channel; look up actions by these spec kinds).
  click: ['click'],
  pointerDown: ['pointerdown'],
  dblTap: ['doubleClick'],
  drag: ['drag'],
  wheel: ['wheel'],
  keyDown: ['key', 'key-held'],
  keyUp: [],
  // Modern → modern identity (catalog id is a GestureSpec.kind).
  doubleClick: ['doubleClick'],
  key: ['key'],
  'key-held': ['key-held'],
  multiTouch: ['multiTouch'],
  multiTouchTap: ['multiTouchTap'],
  pointerdown: ['pointerdown'],
};

/** Reverse: given a catalog entry id (legacy OR modern), return the legacy
 *  `GestureChannels` key(s) that map to it, for the phase-grammar tool lookup. */
const LEGACY_CHANNEL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  click: ['click'],
  pointerDown: ['pointerDown'],
  dblTap: ['dblTap'],
  drag: ['drag'],
  wheel: ['wheel'],
  keyDown: ['keyDown'],
  keyUp: ['keyUp'],
  // Modern catalog entries map back to legacy channels where there's an
  // equivalent. Modern-only entries (multiTouch*, key-held) have none —
  // phase grammar doesn't model them.
  doubleClick: ['dblTap'],
  key: ['keyDown', 'keyUp'],
  pointerdown: ['pointerDown'],
};

interface ActionBindingRow {
  actionId: string;
  specKind: string;
  bindingText: string;
}

function flattenActionBindings(actions: readonly ActionEntry[]): ActionBindingRow[] {
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
        bindingText: describeBinding(spec as Record<string, unknown>),
      });
    }
  }
  return rows;
}

function describeBinding(spec: Record<string, unknown>): string {
  const parts: string[] = [];
  const key = spec['key'];
  if (typeof key === 'string') parts.push(`key=${key === ' ' ? 'Space' : key}`);
  else if (Array.isArray(key)) parts.push(`key=[${key.join(',')}]`);
  const mods = spec['mods'];
  if (mods && typeof mods === 'object') {
    const active = Object.entries(mods as Record<string, unknown>)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (active.length > 0) parts.push(`+${active.join('+')}`);
  }
  const target = spec['target'];
  if (typeof target === 'string') parts.push(`→ ${target}`);
  const phase = spec['phase'];
  if (Array.isArray(phase)) {
    const p = phase.map((a) => {
      const at = a as { channel?: string; phase?: string };
      return at.channel && at.phase ? `${at.channel}:${at.phase}` : '?';
    }).join(' / ');
    parts.push(`[${p}]`);
  }
  return parts.join(' ');
}

function GestureDetail({
  entry, tools, actions, onNavigate,
}: {
  entry: GestureEntry;
  tools: readonly ToolEntry[];
  actions: readonly ActionEntry[];
  onNavigate: Props['onNavigate'];
}) {
  const legacyChannels = LEGACY_CHANNEL_ALIASES[entry.id] ?? [];
  const toolRows = tools.flatMap((t) => {
    const phases: ('initial' | 'engaged')[] = [];
    const matchesInitial = legacyChannels.some((c) => (t.phases.initial.gestures as unknown as Record<string, unknown>)[c]);
    const matchesEngaged = legacyChannels.some((c) => (t.phases.engaged?.gestures as unknown as Record<string, unknown> | undefined)?.[c]);
    if (matchesInitial) phases.push('initial');
    if (matchesEngaged) phases.push('engaged');
    return phases.length === 0 ? [] : [{ id: t.id, tool: t, phases }];
  });
  const aliasSet = new Set(SPEC_KIND_ALIASES[entry.id] ?? []);
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
            render: (r) => <code className={s.tag}>{r.specKind}</code>,
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
        empty="No tools subscribe via phase grammar."
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

/** Tool column for tables that emit multiple rows per tool (e.g. one row per
 *  (tool, route) pair). Renders the tool name only on the first row of each
 *  group. Caller must sort/group rows by tool and tag each row with
 *  `isFirstForTool`. The column is non-sortable — re-sorting would break the
 *  merge-cell visual. */
function mergedToolColumn(
  onNavigate: Props['onNavigate'],
): DataGridColumn<{ id: string; tool: ToolEntry; isFirstForTool: boolean }> {
  return {
    id: 'tool',
    header: 'Tool',
    sortable: false,
    accessor: (r) => r.tool.label ?? r.tool.id,
    render: (r) => r.isFirstForTool ? (
      <button
        type="button"
        className={s.memberLink}
        onClick={() => onNavigate({ kind: 'tool', id: r.tool.id })}
      >
        {r.tool.label ?? r.tool.id}
      </button>
    ) : null,
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
            <dd><code className={s.tag}>{entry.hookName}</code></dd>
          </>
        )}
        <dt>slot</dt>
        <dd><EntryLink kind="slot" id={entry.slot} onNavigate={onNavigate} /></dd>
        {entry.switchShortcutParts && (
          <><dt>shortcut</dt><dd><KeySequence keys={toKeys(entry.switchShortcutParts)} /></dd></>
        )}
        {entry.hotkey && (
          <>
            <dt>hold to engage</dt>
            <dd>
              <KeySequence keys={[hotkeyTriggerToKeySpec(entry.hotkey)]} />
              <Powerline {...routeToPowerline(`[*:initial] keyHeld(${entry.hotkey})`)} />
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
      {entry.routes.length > 0 && (
        <>
          <h3 className={s.subHeading}>Routes</h3>
          <DataGrid
            rows={entry.routes.map((r) => {
              const parsed = parseRoute(r);
              return {
                id: r,
                phase: parsed.phases.map(formatPhaseAtom).join(', '),
                gesture: parsed.gesture,
                arg: parsed.arg ?? '',
                target: parsed.target ?? '',
                modifiers: parsed.modifiers,
                callback: findRouteCallback(r, parsed, entry.callbacks ?? []),
              };
            })}
            columns={[
              { id: 'phase', header: 'phase', accessor: (r) => r.phase },
              { id: 'gesture', header: 'gesture', accessor: (r) => r.gesture },
              { id: 'arg', header: 'arg', accessor: (r) => r.arg },
              {
                id: 'target',
                header: 'target',
                accessor: (r) => r.target,
                render: (r) => r.target
                  ? <EntryLink kind="routeTarget" id={r.target} onNavigate={onNavigate} />
                  : null,
              },
              {
                id: 'modifiers',
                header: 'modifiers',
                sortable: false,
                render: (r) => (
                  <span>
                    {Object.entries(r.modifiers).map(([name, req]) => (
                      <code key={name} className={s.tag}>{(req === 'required' ? '+' : '?') + name}</code>
                    ))}
                  </span>
                ),
              },
              {
                id: 'action',
                header: 'action',
                sortable: false,
                render: (r) => r.callback ? <CallbackSourceLink callback={r.callback} /> : null,
              },
            ]}
            empty="—"
          />
        </>
      )}
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

/** Inline source-link cell for the Tool routes DataGrid's `action` column.
 *  Renders a `vscode://file/...` anchor at the callback's source location,
 *  with `path:line` text trimmed to a repo-relative form when possible. */
function CallbackSourceLink({ callback }: { callback: CallbackRef }) {
  const root = WEASEL_REPO_ROOT;
  const rel = root && callback.source.file.startsWith(root + '/')
    ? callback.source.file.slice(root.length + 1)
    : callback.source.file;
  const href = `vscode://file/${callback.source.file}:${callback.source.line}:${callback.source.col + 1}`;
  return (
    <a className={s.callbackLink} href={href}>
      {rel}:{callback.source.line}
    </a>
  );
}

/** Given a parsed route and a tool's `callbacks` list (populated by the
 *  Vite source-location plugin), return the callback whose label matches
 *  the route's coordinates. Mirrors the label-format `collectPhaseCallbacks`
 *  uses in `registryProbe.tsx` so a route round-trips to its handler.
 *  Returns `null` when no match (e.g. the dev plugin didn't tag this fn). */
function findRouteCallback(
  routeString: string,
  parsed: { phases: readonly { phase: string }[]; gesture: GestureName; target: string | undefined; arg: string | undefined; modifiers: ParsedModifiers },
  callbacks: readonly CallbackRef[],
): CallbackRef | null {
  // Binding-sourced rows: the probe attaches a synthetic CallbackRef whose
  // `label` is the formatted route string itself, pointing at the owning
  // action's handler source. Match that first so binding routes get a
  // citation; the legacy phase-keyed probes below are for phase-table
  // routes whose handlers the Vite plugin tagged directly.
  const exact = callbacks.find((c) => c.label === routeString);
  if (exact) return exact;
  const phase = parsed.phases[0]?.phase;
  if (!phase) return null;
  const g = parsed.gesture;
  const candidates: string[] = [];
  if (g === 'wheel') {
    candidates.push(`${phase}.wheel`);
  } else if (g === 'keyDown' || g === 'keyUp') {
    if (parsed.arg) candidates.push(`${phase}.${g}.${parsed.arg}`);
  } else if (g === 'click' || g === 'pointerDown' || g === 'dblTap' || g === 'drag') {
    const target = parsed.target ?? '*';
    const modKey = canonicalModifiers(parsed.modifiers);
    if (modKey) candidates.push(`${phase}.${g}.${target}:${modKey}`);
    candidates.push(`${phase}.${g}.${target}`);
    // Bare drag function lives at `${phase}.drag` with no target/mod suffix.
    if (g === 'drag') candidates.push(`${phase}.drag`);
  }
  for (const label of candidates) {
    const hit = callbacks.find((c) => c.label === label);
    if (hit) return hit;
  }
  return null;
}

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
  const { paramNames, rows: paramRows } = summarizeActionParams(entry.defaultBinding);
  const hasParams = paramNames.length > 0 || paramRows.some((r) => r.params !== null);
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
        {hasParams && (
          <>
            <dt>params</dt>
            <dd>
              {paramNames.length > 0
                ? paramNames.map((name, i) => (
                    <Fragment key={name}>
                      {i > 0 && ', '}
                      <code className={s.tag}>{name}</code>
                    </Fragment>
                  ))
                : <span className={s.empty}>none</span>}
            </dd>
          </>
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
        <dt>trait</dt><dd><KindBadge label={entry.trait} /></dd>
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

function RoutingKindDetail({
  entry, onNavigate,
}: {
  entry: RoutingKindEntry;
  onNavigate: Props['onNavigate'];
}) {
  return (
    <div>
      <div className={s.toolHeader}>
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <dl className={s.detailList}>
        <dt>trait</dt><dd><KindBadge label={entry.trait} /></dd>
        <dt>kind</dt><dd><KindBadge label="routing-kind" /></dd>
        <dt>source</dt><dd><KindBadge label={entry.source} /></dd>
        {entry.shapeKindId && (
          <>
            <dt>shape kind</dt>
            <dd>
              <EntryLink kind="shapeKind" id={entry.shapeKindId} onNavigate={onNavigate} />
            </dd>
          </>
        )}
      </dl>
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

