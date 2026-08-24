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
} from '@weasel-js/core';
import {
  buildRouteRegistry,
  canonicalModifiers,
  findConflicts,
  type Conflict,
  type RegistryEntry,
} from '@weasel-js/core/routing';
import { formatShortcutParts, KeySequence } from '@weasel-js/ui';
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
import {
  formatAge,
  formatEnabled,
  readLog,
  type DispatchLogEntry,
  type TraceLogEntry,
} from './dispatchTraceLog';
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

interface ShapeData { fill: string }
interface ShapePose { x: number; y: number; width: number; height: number }

const INITIAL_NODES = [
  { kind: 'leaf' as const, id: asNodeId('r1'), layer: 'default' as const, data: { fill: '#7fb069' }, pose: { x: 80,  y: 60,  width: 120, height: 80 } },
  { kind: 'leaf' as const, id: asNodeId('r2'), layer: 'default' as const, data: { fill: '#d97757' }, pose: { x: 260, y: 100, width: 100, height: 100 } },
  { kind: 'leaf' as const, id: asNodeId('r3'), layer: 'default' as const, data: { fill: '#5a8bd0' }, pose: { x: 140, y: 220, width: 160, height: 60 } },
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
  const rows = [...defs].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Tools · {defs.length}</h2>
      <div className={s.widgetBodyScrollY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No tools yet (canvas still mounting).</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Hook</th>
                <th>Slot</th>
                <th>Switch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td><code>{d.id}</code></td>
                  <td>{d.hookName ?? <span className={s.empty}>—</span>}</td>
                  <td>{ambientSet.has(d.id) ? 'ambient' : 'registry'}</td>
                  <td><KeySequence keys={formatShortcutParts(lookupShortcutByToolId(d.id, actions))?.map((label) => ({ label }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Widget: registered actions (kit-standard + anything else in scope).
// ─────────────────────────────────────────────────────────────────────────

function ActionsWidget({ actions }: { actions: readonly Action[] }): ReactElement {
  const rows = [...actions].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Actions · {actions.length}</h2>
      <div className={s.widgetBodyScrollY}>
        {rows.length === 0 ? (
          <p className={s.empty}>No actions registered. Mount an ActionsProvider upstream.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Icon</th>
                <th>ID</th>
                <th>Group</th>
                <th>Binding</th>
                <th>Requires</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const requires = (a as Action & { requires?: readonly string[] }).requires;
                const enabled = snapshotEnabled(a);
                return (
                  <tr key={a.id}>
                    <td className={s.iconCell}>{renderIcon(a.icon)}</td>
                    <td><code>{a.id}</code></td>
                    <td>{a.group ?? <span className={s.empty}>—</span>}</td>
                    <td>{renderBinding(a)}</td>
                    <td>{requires && requires.length > 0
                      ? <code>{requires.join(', ')}</code>
                      : <span className={s.empty}>—</span>}</td>
                    <td>{enabled}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

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
  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Routes · {routes.length}</h2>
      <div className={s.widgetBodyScrollXY}>
        {sorted.length === 0 ? (
          <p className={s.empty}>No routes (no tools mounted yet).</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Slot</th>
                <th>Phase</th>
                <th>Gesture</th>
                <th>Arg</th>
                <th>Target</th>
                <th>Mods</th>
                <th title="target, required mods, phase declared, typed drop/paste">
                  Specificity
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const modKey = canonicalModifiers(r.modifiers);
                return (
                <tr key={`${r.toolId}-${r.phase}-${r.gesture}-${r.arg ?? ''}-${r.target ?? ''}-${modKey}-${i}`}>
                  <td><code>{r.toolId}</code></td>
                  <td>{ambientSet.has(r.toolId) ? 'ambient' : 'registry'}</td>
                  <td>{r.phase}</td>
                  <td>{r.gesture}</td>
                  <td>{r.arg == null
                    ? <span className={s.empty}>—</span>
                    : <code>{r.arg}</code>}</td>
                  <td>{r.target == null
                    ? <span className={s.empty}>—</span>
                    : <code>{r.target}</code>}</td>
                  <td>{modKey === ''
                    ? <span className={s.empty}>—</span>
                    : <code>{modKey}</code>}</td>
                  <td><code>{specificity(r.spec).join(' · ')}</code></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
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
    list: () => actions,
    trigger: () => false,
    subscribe: () => () => {},
    begin: () => null,
    setDispatcher: () => {},
    setDepRegistry: () => {},
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
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Scope</th>
                <th>Tool</th>
                <th>Action</th>
                <th title="target, required mods, phase declared, typed drop/paste">
                  Specificity
                </th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr key={`${c.actionId}-${i}`} className={verdictClass(c.verdict.kind)}>
                  <td>{i + 1}</td>
                  <td>{c.scope}</td>
                  <td>
                    <code>{c.ownerToolId ?? '—'}</code>
                    {isPredicateTarget(c.binding.spec) && (
                      <span
                        className={s.predicateBadge}
                        title="Evaluated against a synthesized hit — a predicate reading more than `kind` may differ at runtime."
                      >?</span>
                    )}
                  </td>
                  <td><code>{c.actionId}</code></td>
                  <td><code>{c.specificity.join(' · ')}</code></td>
                  <td>
                    {verdictText(c.verdict)}
                    {c.verdict.kind === 'disabled' && (
                      <span
                        className={s.predicateBadge}
                        title="`enabled()` ran against a synthesized context with no deps wired, so this reason reflects an empty selection / scene rather than the live one."
                      >?</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

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
          <ul className={s.conflicts}>
            {conflicts.map((c, i) => {
              const modKey = canonicalModifiers(c.modifiers);
              return (
              <li key={i}>
                <code>{c.phase}.{c.gesture}{c.arg != null ? `(${c.arg})` : ''}{c.target != null ? `.${c.target}` : ''}</code>
                {modKey !== '' && <> · <code>{modKey}</code></>}
                {' '}claimed by{' '}
                {c.toolIds.map((id, j) => (
                  <span key={id}>
                    {j > 0 && ', '}
                    <code>{id}</code>
                  </span>
                ))}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Widget: live dispatch trace. Reads the kit's dev-only rolling log
// (`window.__weaselDispatchLog__`, populated by the gesture dispatcher the
// mounted SceneCanvas runs). Each row is one input-handling decision; click
// to expand the candidate actions and see why each was (or wasn't) chosen.
// Unhandled events (idle mousemoves, wheels over chrome) are noisy and hidden
// by default — toggle to reveal them when diagnosing "X didn't fire".
// ─────────────────────────────────────────────────────────────────────────

const TRACE_POLL_MS = 250;
const TRACE_DISPLAY_LIMIT = 100;

function DispatchTraceWidget(): ReactElement {
  const [entries, setEntries] = useState<TraceLogEntry[]>(() => readLog().slice());
  const [now, setNow] = useState<number>(() => Date.now());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showUnhandled, setShowUnhandled] = useState<boolean>(false);
  const lastLenRef = useRef<number>(entries.length);
  const lastTsRef = useRef<number>(entries.length ? entries[entries.length - 1]!.ts : 0);

  // Poll the log; skip the setState when nothing changed so the idle tick is
  // cheap. `now` still advances each tick so the Age column counts up.
  useEffect(() => {
    const id = window.setInterval(() => {
      const log = readLog();
      const len = log.length;
      const lastTs = len ? log[len - 1]!.ts : 0;
      if (len !== lastLenRef.current || lastTs !== lastTsRef.current) {
        lastLenRef.current = len;
        lastTsRef.current = lastTs;
        setEntries(log.slice());
      }
      setNow(Date.now());
    }, TRACE_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const visible = entries
    .filter((e) => (e.kind === 'mode' ? true : e.outcome === 'unhandled' ? showUnhandled : true))
    .slice(-TRACE_DISPLAY_LIMIT)
    .reverse();

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
        {visible.length === 0 ? (
          <p className={s.empty}>
            {entries.length > 0
              ? 'All recorded events hidden — toggle “unhandled” to show them.'
              : 'No dispatch events yet. Interact with the canvas to populate the trace.'}
          </p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Age</th>
                <th>Event</th>
                <th>Outcome</th>
                <th>Cands</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, i) => (
                <TraceRow
                  key={`${entry.ts}-${i}`}
                  entry={entry}
                  ageMs={Math.max(0, now - entry.ts)}
                  isExpanded={expanded === entry.ts}
                  onToggle={() => setExpanded((x) => (x === entry.ts ? null : entry.ts))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TraceRow({
  entry,
  ageMs,
  isExpanded,
  onToggle,
}: {
  entry: TraceLogEntry;
  ageMs: number;
  isExpanded: boolean;
  onToggle: () => void;
}): ReactElement {
  if (entry.kind === 'mode') {
    return (
      <tr className={s.traceRowMode}>
        <td>{formatAge(ageMs)}</td>
        <td>
          <code>{entry.mode}</code>
          {entry.detail ? <span className={s.traceModeDetail}> ({entry.detail})</span> : null}
        </td>
        <td colSpan={2}>
          <code>{entry.from ?? '∅'}</code> → <code>{entry.to ?? '∅'}</code>
        </td>
      </tr>
    );
  }
  const unhandled = entry.outcome === 'unhandled';
  const rowClass = [s.traceRow, unhandled ? s.traceRowUnhandled : '', isExpanded ? s.traceRowExpanded : '']
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <tr className={rowClass} onClick={onToggle}>
        <td>{formatAge(ageMs)}</td>
        <td>
          {entry.eventKind}
          {entry.key !== undefined ? <> <code>{entry.key === ' ' ? 'Space' : entry.key}</code></> : null}
        </td>
        <td>{unhandled ? 'unhandled' : entry.fired ? <code>{entry.fired}</code> : 'handled'}</td>
        <td>{entry.candidates.length}</td>
      </tr>
      {isExpanded && (
        <tr className={s.traceDetailRow}>
          <td colSpan={4}>
            {entry.candidates.length === 0 ? (
              <em>No candidates considered.</em>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Scope</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.candidates.map((c, i) => (
                    <tr
                      key={`${c.actionId}-${i}`}
                      className={c.actionId === (entry as DispatchLogEntry).fired ? s.traceCandFired : undefined}
                    >
                      <td><code>{c.actionId}</code></td>
                      <td>{c.scope}</td>
                      <td>{formatEnabled(c.enabledResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
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

function renderSpec(spec: GestureSpec): ReactNode {
  const shortcut = keySpecShortcut(spec);
  if (shortcut) {
    const parts = formatShortcutParts(shortcut);
    return <KeySequence keys={parts?.map((label) => ({ label }))} />;
  }
  // `'optional'` matches held or unheld, so it is not something to press.
  const modGlyphs: string[] = [];
  if ('mods' in spec && spec.mods) {
    if (spec.mods.mod === true) modGlyphs.push('⌘');
    if (spec.mods.shift === true) modGlyphs.push('⇧');
    if (spec.mods.alt === true) modGlyphs.push('⌥');
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
      {modGlyphs.length > 0 && (
        <>
          <span className={s.bindingSep}>+</span>
          <KeySequence keys={modGlyphs.map((g) => ({ label: g }))} />
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
