/**
 * Toolkit Builder — assemble a canvas from a bundle preset and inspect the
 * resulting live registry, route table, conflicts, and dispatch trace. Mounted
 * under `#/dev/toolkits` (sibling to `RegistryInspector` at `#/dev/registry`).
 *
 * Post-purge surface: the legacy consumer hooks (useDelete / useEscape /
 * useNudge / useGroup / useFlip / ...) are gone — actions now live in the
 * Actions Registry mounted by SceneCanvas via `useStandardActions`. This
 * page picks a `toolBundle`, mounts a real SceneCanvas, and reflects on
 * what the kit registered.
 */
import {
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  actionBindings,
  asNodeId,
  createDispatcher,
  keySpecShortcut,
  SceneCanvas,
  specificity,
  useActionsRegistry,
  useScene,
  type Action,
  type ActionsRegistry,
  type DepRegistry,
  type ResolvedCandidate,
  type GestureSpec,
  type Tool,
  type ToolBundle,
  type ToolDef,
  type ToolsApi,
  solid,
  type FillStyle,
} from '@weasel-js/core';
import {
  buildRouteRegistry,
  canonicalModifiers,
  findConflicts,
  type Conflict,
  type RegistryEntry,
} from '@weasel-js/core/routing';
import {
  DataGrid,
  KeySequence,
  keySpecsFromMods,
  keySpecsFromShortcut,
  type DataGridColumn,
  type LogicalModSpec,
} from '@weasel-js/ui';
import { lookupShortcutByToolId } from './keybindingsView';
import {
  AFFORDANCE_PREFIX,
  KIND_PREFIX,
  isPredicateTarget,
  RESOLUTION_BODY_TARGETS,
  RESOLUTION_GESTURES,
  synthesizeInput,
  type ResolutionGesture,
  type ResolutionMods,
} from './resolutionInput';
import { useDispatchTraceLog } from './dispatchTraceLog';
import { DispatchTraceTable } from './DispatchTraceTable';
import s from './ToolkitBuilder.module.css';

// ─────────────────────────────────────────────────────────────────────────
// URL state — `?bundle=<id>`. Only the three named presets are addressable;
// custom tool mixes are a follow-up (would need to plumb `defaultTools`
// through SceneCanvas, which it already supports).
// ─────────────────────────────────────────────────────────────────────────

const BUNDLE_IDS: readonly ToolBundle[] = ['minimal', 'standard', 'exhaustive'];
const DEFAULT_BUNDLE: ToolBundle = 'standard';

function parseBundle(hash: string): ToolBundle {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const b = params.get('bundle');
  if (b && (BUNDLE_IDS as readonly string[]).includes(b)) return b as ToolBundle;
  return DEFAULT_BUNDLE;
}

function writeBundle(b: ToolBundle): void {
  const next = `#/dev/toolkits?bundle=${b}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

// ─────────────────────────────────────────────────────────────────────────
// Demo scene — a few rectangles so the chosen tool bundle has something
// to act on (select / resize / rotate need targets, etc.).
// ─────────────────────────────────────────────────────────────────────────

interface ShapeData { fill: FillStyle }
interface ShapePose { x: number; y: number; width: number; height: number }

const INITIAL_NODES = [
  { kind: 'leaf' as const, id: asNodeId('r1'), layer: 'default' as const, data: { fill: solid('#7fb069') }, pose: { x: 80,  y: 60,  width: 120, height: 80 } },
  { kind: 'leaf' as const, id: asNodeId('r2'), layer: 'default' as const, data: { fill: solid('#d97757') }, pose: { x: 260, y: 100, width: 100, height: 100 } },
  { kind: 'leaf' as const, id: asNodeId('r3'), layer: 'default' as const, data: { fill: solid('#5a8bd0') }, pose: { x: 140, y: 220, width: 160, height: 60 } },
];

// ─────────────────────────────────────────────────────────────────────────
// Inner shell — re-mounted with `key={bundle}` whenever the bundle changes
// so SceneCanvas re-builds its tool set cleanly rather than trying to
// reconcile a different `toolBundle` prop in place.
// ─────────────────────────────────────────────────────────────────────────

function ToolkitForBundle({ bundle }: { bundle: ToolBundle }): ReactElement {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });

  // Capture the live ToolsApi when SceneCanvas synthesizes one. `useTools`
  // rebuilds the api literal each render — track only the structural
  // signature (sorted tool ids) so we don't spin in a render loop.
  // (Same trick the RegistryProbe uses.)
  const toolsRef = useRef<ToolsApi | null>(null);
  const [toolsSig, setToolsSig] = useState<string>('');
  const onToolsCreated = (api: ToolsApi) => {
    toolsRef.current = api;
    const sig = [
      ...Object.keys(api.registry),
      ...api.ambient.map((t) => `~${t.id}`),
    ].sort().join(',');
    setToolsSig((prev) => (prev === sig ? prev : sig));
  };

  // Pull live tool defs out of the registry + ambient slots. Both groups
  // get reflected — ambient is where resize / rotate / wheel-zoom live.
  const toolDefs = useMemo<readonly ToolDef<unknown>[]>(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return [];
    type Slot = { id: string; def?: unknown };
    const all: Slot[] = [
      ...(Object.values(tools.registry) as unknown as Slot[]),
      ...(tools.ambient as unknown as Slot[]),
    ];
    const seen = new Set<string>();
    const out: ToolDef<unknown>[] = [];
    for (const t of all) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (t.def) out.push(t.def as ToolDef<unknown>);
    }
    return out;
  }, [toolsSig]);

  // Routes live on the Tool (`bindings`), not the authored def, so the
  // reflection consumers take the Tools themselves.
  const toolList = useMemo(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return [];
    const seen = new Set<string>();
    const out: Tool<unknown>[] = [];
    for (const t of [...Object.values(tools.registry), ...tools.ambient]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t as Tool<unknown>);
    }
    return out;
  }, [toolsSig]);

  const toolSlots = useMemo(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return { registry: [] as string[], ambient: [] as string[] };
    return {
      registry: Object.keys(tools.registry).sort(),
      ambient: tools.ambient.map((t) => t.id).sort(),
    };
  }, [toolsSig]);

  const routes = useMemo(() => buildRouteRegistry(toolList), [toolList]);
  const conflicts = useMemo(() => findConflicts(toolList), [toolList]);

  // Live action registry (kit-standard + anything else in scope).
  const reg = useActionsRegistry();
  const [actions, setActions] = useState<readonly Action[]>(() => (reg ? reg.list() : []));
  useEffect(() => {
    if (!reg) { setActions([]); return; }
    setActions(reg.list());
    return reg.subscribe(() => setActions(reg.list()));
  }, [reg]);

  return (
    <div className={s.layout}>
      {/* Left column: canvas. */}
      <section className={s.canvas}>
        <SceneCanvas
          scene={scene}
          width={520}
          height={360}
          toolBundle={bundle}
          onToolsCreated={onToolsCreated}
          className={s.scene}
        />
        <p className={s.hint}>
          Interact with the canvas to populate the dispatch trace on the right.
          Slots: <code>{toolSlots.registry.length}</code> registry,{' '}
          <code>{toolSlots.ambient.length}</code> ambient.
        </p>
      </section>

      {/* Middle column: tool / action / route tables. */}
      <section className={s.catalog}>
        <ToolsWidget defs={toolDefs} slots={toolSlots} actions={actions} />
        <ActionsWidget actions={actions} />
        <RoutesWidget routes={routes} slots={toolSlots} />
        <ResolutionWidget
          tools={toolList}
          actions={actions}
          activeToolId={toolSlots.registry[0] ?? ''}
        />
      </section>

      {/* Right column: conflicts + live dispatch trace. */}
      <aside className={s.reflect}>
        <ConflictsWidget conflicts={conflicts} />
        <DispatchTraceWidget />
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Widget: registered tools.
// ─────────────────────────────────────────────────────────────────────────

function ToolsWidget({
  defs,
  slots,
  actions,
}: {
  defs: readonly ToolDef<unknown>[];
  slots: { registry: readonly string[]; ambient: readonly string[] };
  actions: readonly Action[];
}): ReactElement {
  const ambientSet = new Set(slots.ambient);
  const rows: ToolRow[] = defs.map((d) => ({
    id: d.id,
    hookName: d.hookName,
    slot: ambientSet.has(d.id) ? 'ambient' : 'registry',
    shortcut: lookupShortcutByToolId(d.id, actions),
  }));
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Tools · {defs.length}</h2>
      <div className={s.widgetBodyScrollY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No tools yet (canvas still mounting).</p>
        ) : (
          <DataGrid rows={rows} columns={TOOL_COLUMNS} defaultSort={{ columnId: 'id', direction: 'asc' }} />
        )}
      </div>
    </div>
  );
}

interface ToolRow {
  id: string;
  hookName: string | undefined;
  slot: 'ambient' | 'registry';
  shortcut: ReturnType<typeof lookupShortcutByToolId>;
}

const TOOL_COLUMNS: readonly DataGridColumn<ToolRow>[] = [
  { id: 'id', header: 'ID', render: (r) => <code>{r.id}</code> },
  { id: 'hookName', header: 'Hook', render: (r) => r.hookName ?? <span className={s.empty}>—</span> },
  { id: 'slot', header: 'Slot' },
  {
    id: 'shortcut',
    header: 'Switch',
    sortable: false,
    render: (r) => <KeySequence keys={keySpecsFromShortcut(r.shortcut)} />,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Widget: registered actions (kit-standard + anything else in scope).
// ─────────────────────────────────────────────────────────────────────────

function ActionsWidget({ actions }: { actions: readonly Action[] }): ReactElement {
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Actions · {actions.length}</h2>
      <div className={s.widgetBodyScrollY}>
        {actions.length === 0 ? (
          <p className={s.empty}>No actions registered. Mount an ActionsProvider upstream.</p>
        ) : (
          <DataGrid rows={actions} columns={ACTION_COLUMNS} defaultSort={{ columnId: 'id', direction: 'asc' }} />
        )}
      </div>
    </div>
  );
}

const ACTION_COLUMNS: readonly DataGridColumn<Action>[] = [
  { id: 'icon', header: 'Icon', sortable: false, className: s.iconCell, render: (a) => renderIcon(a.icon) },
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
  { id: 'enabled', header: 'Enabled', sortable: false, render: snapshotEnabled },
];

// ─────────────────────────────────────────────────────────────────────────
// Widget: route signatures pulled from the live ToolDefs via
// buildRouteRegistry. One row per binding.
// ─────────────────────────────────────────────────────────────────────────

// `slot` is a static fact (which slot the tool was mounted in); the runtime
// `scope` the matcher sorts by — hotkey > active > ambient — depends on which
// tool is active and what's on the hotkey stack at dispatch time, so it lives
// in the Resolution widget below, sourced from resolveAll.
function RoutesWidget({
  routes,
  slots,
}: {
  routes: readonly RegistryEntry[];
  slots: { registry: readonly string[]; ambient: readonly string[] };
}): ReactElement {
  const ambientSet = new Set(slots.ambient);
  const sorted = [...routes].sort((a, b) =>
    a.toolId.localeCompare(b.toolId)
    || a.phase.localeCompare(b.phase)
    || a.gesture.localeCompare(b.gesture)
    || (a.arg ?? '').localeCompare(b.arg ?? '')
    || (a.target ?? '').localeCompare(b.target ?? ''));
  const rows = withUniqueIds(sorted.map((r): Omit<RouteRow, 'id'> => {
    const mods = canonicalModifiers(r.modifiers);
    return {
      key: [r.toolId, r.phase, r.gesture, r.arg ?? '', r.target ?? '', mods, r.actionId].join('|'),
      toolId: r.toolId,
      slot: ambientSet.has(r.toolId) ? 'ambient' : 'registry',
      phase: r.phase,
      gesture: r.gesture,
      arg: r.arg,
      target: r.target,
      mods,
      specificity: specificity(r.spec).join(' · '),
    };
  }));
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Routes · {routes.length}</h2>
      <div className={s.widgetBodyScrollXY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No routes (no tools mounted yet).</p>
        ) : (
          <DataGrid rows={rows} columns={ROUTE_COLUMNS} />
        )}
      </div>
    </div>
  );
}

interface RouteRow {
  id: string;
  key: string;
  toolId: string;
  slot: 'ambient' | 'registry';
  phase: string;
  gesture: string;
  arg: string | undefined;
  target: string | undefined;
  mods: string;
  specificity: string;
}

/** Codes a value, or a muted dash when it is absent. */
function codeOrDash(v: string | undefined): ReactNode {
  return v == null || v === '' ? <span className={s.empty}>—</span> : <code>{v}</code>;
}

const SPECIFICITY_HEADER = (
  <span title="target, required mods, phase declared, typed drop/paste">Specificity</span>
);

const ROUTE_COLUMNS: readonly DataGridColumn<RouteRow>[] = [
  { id: 'toolId', header: 'Tool', render: (r) => <code>{r.toolId}</code> },
  { id: 'slot', header: 'Slot' },
  { id: 'phase', header: 'Phase' },
  { id: 'gesture', header: 'Gesture' },
  { id: 'arg', header: 'Arg', render: (r) => codeOrDash(r.arg) },
  { id: 'target', header: 'Target', render: (r) => codeOrDash(r.target) },
  { id: 'mods', header: 'Mods', render: (r) => codeOrDash(r.mods) },
  { id: 'specificity', header: SPECIFICITY_HEADER, render: (r) => <code>{r.specificity}</code> },
];

/** Gives each row an `id` from its `key`, numbering repeats so two identical
 *  bindings still get distinct, order-independent ids. */
function withUniqueIds<T extends { key: string }>(rows: readonly T[]): (T & { id: string })[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = seen.get(r.key) ?? 0;
    seen.set(r.key, n + 1);
    return { ...r, id: n === 0 ? r.key : `${r.key}#${n}` };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Widget: resolution — pick an input, see every binding that matches it in
// dispatch precedence order, with the winner marked and each loser's reason.
//
// The phase tables used to make precedence structurally legible: you read
// which table an entry sat in and knew what beat it. Bindings made precedence
// computed — scope, then the specificity tuple, then registration order, with
// fall-through past anything whose `enabled()` says no — and nothing showed
// it. `Dispatcher.resolveAll` is that walk without the invoking; this widget
// is its display.
//
// What's trustworthy here, and what isn't:
//
//  - ORDER is exact. Scope, specificity, and registration order are all
//    properties of the bindings themselves, so the ranking this shows is the
//    ranking a real dispatch computes.
//  - MODIFIERS are exact — a modifier is just a boolean the matcher reads.
//  - TARGET is caveated. It stands in for a real hit-test, so a `kindOf`
//    predicate can outrun the synthesized hit. `resolutionInput.ts` says
//    exactly how far it goes; predicate rows carry a `?`.
//  - `disabled` REASONS are caveated. `enabled()` runs against a stub
//    DepRegistry that resolves every dep to undefined, so a predicate like
//    `requiresSelection` reports "selection-required" whatever is really
//    selected. Those rows carry a `?` too. Wiring the live canvas's dep
//    registry through would fix it, and is the obvious next step if this
//    panel gets real use.
//  - `ineligible` never appears: no `getRuleCtx` is supplied, so the
//    eligibility gate is skipped entirely rather than evaluated wrongly.
// ─────────────────────────────────────────────────────────────────────────

const MOD_KEYS = ['shift', 'alt', 'meta', 'ctrl'] as const;

/** `resolveAll` reads only what this ctx hands it, so a throwaway dispatcher
 *  and these two inert stubs are enough — the query never invokes anything
 *  and never resolves a dep. */
const STUB_DEP_REGISTRY: DepRegistry = {
  register: () => () => {},
  get: () => undefined,
};

function stubActionsRegistry(actions: readonly Action[]): ActionsRegistry {
  return {
    register: () => () => {},
    unregister: () => {},
    mute: () => () => {},
    list: () => actions,
    trigger: () => false,
    subscribe: () => () => {},
    begin: () => null,
    setDispatcher: () => () => {},
    setDepRegistry: () => () => {},
  };
}

export function ResolutionWidget({
  tools,
  actions,
  activeToolId,
}: {
  /** Live `Tool`s off the `ToolsApi`, each carrying the declared eligibility
   *  that decides which scope tier its bindings assemble at. */
  tools: readonly Tool<unknown>[];
  actions: readonly Action[];
  activeToolId: string;
}): ReactElement {
  const [gesture, setGesture] = useState<ResolutionGesture>('drag');
  const [target, setTarget] = useState<string>('selected-body');
  const [mods, setMods] = useState<ResolutionMods>({});

  // Chrome and node-kind options come from the targets the mounted tools
  // actually bind against, so the picker can't offer a target nothing listens
  // for. Both lists are empty for a tool set that describes its targets with
  // predicates only — which is still true of every kit bundle.
  const { affordanceKinds, nodeKinds } = useMemo(() => {
    const affordances = new Set<string>();
    const nodes = new Set<string>();
    for (const entry of buildRouteRegistry(tools)) {
      if (entry.target?.startsWith(AFFORDANCE_PREFIX)) {
        affordances.add(entry.target.slice(AFFORDANCE_PREFIX.length));
      } else if (entry.target?.startsWith(KIND_PREFIX)) {
        nodes.add(entry.target.slice(KIND_PREFIX.length));
      }
    }
    return {
      affordanceKinds: [...affordances].sort(),
      nodeKinds: [...nodes].sort(),
    };
  }, [tools]);

  // `wheel` and `key` events carry no target for the matcher to read, so the
  // picker would be a control with no effect.
  const targetApplies = gesture !== 'wheel' && gesture !== 'key';

  const candidates = useMemo(() => {
    const dispatcher = createDispatcher();
    return dispatcher.resolveAll(
      synthesizeInput({ gesture, target, mods }),
      {
        actions: stubActionsRegistry(actions),
        depRegistry: STUB_DEP_REGISTRY,
        activeToolId,
        hotkeyStack: [],
        toolsById: new Map(tools.map((t) => [t.id, t])),
        isMac: false,
      },
      // The question this panel exists to answer is "why didn't MY binding
      // fire?", and on the default walk the answer is `shadowed` for
      // everything below the winner — true but uninformative. Evaluating past
      // the winner costs nothing here (throwaway dispatcher, no invocation),
      // and it distinguishes "outranked" from "outranked AND disabled".
      { evaluateShadowed: true },
    );
  }, [gesture, target, mods, actions, activeToolId, tools]);

  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Resolution · {candidates.length}</h2>
      <div className={s.resolutionControls}>
        <label>
          gesture
          <select
            aria-label="gesture"
            value={gesture}
            onChange={(e) => setGesture(e.target.value as ResolutionGesture)}
          >
            {RESOLUTION_GESTURES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label
          title={targetApplies
            ? undefined
            : `target matching doesn't apply to a ${gesture} event — it carries no target for the matcher to read`}
        >
          target
          <select
            aria-label="target"
            value={target}
            disabled={!targetApplies}
            onChange={(e) => setTarget(e.target.value)}
          >
            {RESOLUTION_BODY_TARGETS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {affordanceKinds.map((k) => (
              <option key={k} value={`${AFFORDANCE_PREFIX}${k}`}>chrome: {k}</option>
            ))}
            {nodeKinds.map((k) => (
              <option key={k} value={`${KIND_PREFIX}${k}`}>node: {k}</option>
            ))}
          </select>
        </label>
        {MOD_KEYS.map((m) => (
          <label key={m}>
            <input
              type="checkbox"
              checked={!!mods[m]}
              onChange={(e) => setMods((prev) => ({ ...prev, [m]: e.target.checked }))}
            />
            {m}
          </label>
        ))}
      </div>
      <div className={s.widgetBodyScrollXY}>
        {candidates.length === 0 ? (
          <p className={s.empty}>No binding matches this input.</p>
        ) : (
          <DataGrid
            rows={withUniqueIds(candidates.map((c, i) => ({
              key: `${c.scope}|${c.ownerToolId ?? ''}|${c.actionId}`,
              rank: i + 1,
              candidate: c,
            })))}
            columns={RESOLUTION_COLUMNS}
            rowClassName={(r) => verdictClass(r.candidate.verdict.kind)}
          />
        )}
      </div>
    </div>
  );
}

interface ResolutionRow { id: string; rank: number; candidate: ResolvedCandidate }

const RESOLUTION_COLUMNS: readonly DataGridColumn<ResolutionRow>[] = [
  { id: 'rank', header: '#', sortable: false },
  { id: 'scope', header: 'Scope', sortable: false, render: (r) => r.candidate.scope },
  {
    id: 'tool',
    header: 'Tool',
    sortable: false,
    render: ({ candidate: c }) => (
      <>
        <code>{c.ownerToolId ?? '—'}</code>
        {isPredicateTarget(c.binding.spec) && (
          <span
            className={s.predicateBadge}
            title="Evaluated against a synthesized hit — a predicate reading more than `kind` may differ at runtime."
          >?</span>
        )}
      </>
    ),
  },
  { id: 'action', header: 'Action', sortable: false, render: (r) => <code>{r.candidate.actionId}</code> },
  {
    id: 'specificity',
    header: SPECIFICITY_HEADER,
    sortable: false,
    render: (r) => <code>{r.candidate.specificity.join(' · ')}</code>,
  },
  {
    id: 'verdict',
    header: 'Verdict',
    sortable: false,
    render: ({ candidate: c }) => (
      <>
        {verdictText(c.verdict)}
        {c.verdict.kind === 'disabled' && (
          <span
            className={s.predicateBadge}
            title="`enabled()` ran against a synthesized context with no deps wired, so this reason reflects an empty selection / scene rather than the live one."
          >?</span>
        )}
      </>
    ),
  },
];

function verdictClass(kind: ResolvedCandidate['verdict']['kind']): string {
  if (kind === 'would-fire') return s.verdictFires;
  if (kind === 'shadowed') return s.verdictShadowed;
  return s.verdictBlocked;
}

function verdictText(verdict: ResolvedCandidate['verdict']): string {
  if (verdict.kind === 'would-fire') return 'fires';
  if (verdict.kind === 'shadowed') return 'shadowed';
  return `${verdict.kind}: ${verdict.reason}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Widget: conflicts — same (phase, gesture, target, mods) on multiple tools.
// ─────────────────────────────────────────────────────────────────────────

function ConflictsWidget({ conflicts }: { conflicts: readonly Conflict[] }): ReactElement {
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Conflicts · {conflicts.length}</h2>
      <div className={s.widgetBody}>
        {conflicts.length === 0 ? (
          <p className={s.empty}>No exact-tuple route conflicts in this bundle.</p>
        ) : (
          <DataGrid
            rows={withUniqueIds(conflicts.map((c) => {
              const route = `${c.phase}.${c.gesture}${c.arg != null ? `(${c.arg})` : ''}${c.target != null ? `.${c.target}` : ''}`;
              const mods = canonicalModifiers(c.modifiers);
              return { key: `${route}|${mods}`, route, mods, toolIds: c.toolIds.join(', ') };
            }))}
            columns={CONFLICT_COLUMNS}
          />
        )}
      </div>
    </div>
  );
}

interface ConflictRow { id: string; route: string; mods: string; toolIds: string }

const CONFLICT_COLUMNS: readonly DataGridColumn<ConflictRow>[] = [
  { id: 'route', header: 'Route', render: (r) => <code>{r.route}</code> },
  { id: 'mods', header: 'Mods', render: (r) => codeOrDash(r.mods) },
  { id: 'toolIds', header: 'Claimed by', render: (r) => <code>{r.toolIds}</code> },
];

// ─────────────────────────────────────────────────────────────────────────
// Widget: live dispatch trace. Reads the kit's dev-only rolling log
// (`window.__weaselDispatchLog__`, populated by the gesture dispatcher the
// mounted SceneCanvas runs). Unhandled events (idle mousemoves, wheels over
// chrome) are noisy and hidden by default — toggle to reveal them when
// diagnosing "X didn't fire".
// ─────────────────────────────────────────────────────────────────────────

function DispatchTraceWidget(): ReactElement {
  const { entries, now } = useDispatchTraceLog();
  const [showUnhandled, setShowUnhandled] = useState<boolean>(false);

  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>
        Dispatch · {entries.length}
        <label className={s.traceToggle}>
          <input
            type="checkbox"
            checked={showUnhandled}
            onChange={(e) => setShowUnhandled(e.target.checked)}
          />
          unhandled
        </label>
      </h2>
      <div className={s.widgetBodyScrollY}>
        <DispatchTraceTable
          entries={entries}
          now={now}
          showUnhandled={showUnhandled}
          empty={entries.length > 0
            ? 'All recorded events hidden — toggle “unhandled” to show them.'
            : 'No dispatch events yet. Interact with the canvas to populate the trace.'}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers — binding render, icon render, enabled snapshot.
// ─────────────────────────────────────────────────────────────────────────

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
  if (shortcut) return <KeySequence keys={keySpecsFromShortcut(shortcut)} />;
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
      <code className={s.bindingTag}>{label}</code>
      {mods.length > 0 && (
        <>
          <span className={s.bindingSep}>+</span>
          <KeySequence keys={keySpecsFromMods(mods)} />
        </>
      )}
    </>
  );
}

function renderIcon(icon: Action['icon']): ReactNode {
  if (icon === undefined || icon === null) return null;
  if (typeof icon === 'function') {
    try { return (icon as () => ReactNode)(); } catch { return null; }
  }
  if (isValidElement(icon)) return icon;
  return icon as ReactNode;
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

// ─────────────────────────────────────────────────────────────────────────
// Outer shell — bundle picker + remount on change.
// ─────────────────────────────────────────────────────────────────────────

export function ToolkitBuilder(): ReactElement {
  const [bundle, setBundle] = useState<ToolBundle>(() => parseBundle(window.location.hash));

  useEffect(() => {
    const prev = document.title;
    document.title = 'Toolkit Builder';
    return () => { document.title = prev; };
  }, []);

  // Sync hash on bundle change + react to back/forward.
  useEffect(() => { writeBundle(bundle); }, [bundle]);
  useEffect(() => {
    const onHash = () => {
      const next = parseBundle(window.location.hash);
      setBundle((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Toolkit Builder</h1>
          <label className={s.bundlePicker}>
            bundle
            <select
              aria-label="bundle"
              value={bundle}
              onChange={(e) => setBundle(e.target.value as ToolBundle)}
            >
              {BUNDLE_IDS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        </div>
        <p className={s.subtitle}>
          Mount a SceneCanvas with the chosen bundle, then inspect the live tool
          set, action registry, route table, and dispatch trace it produces.
        </p>
      </header>
      {/* Key by bundle so SceneCanvas rebuilds cleanly when it changes. */}
      <ToolkitForBundle key={bundle} bundle={bundle} />
    </div>
  );
}

export default ToolkitBuilder;
