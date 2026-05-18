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
  asNodeId,
  SceneCanvas,
  useActionsRegistry,
  useScene,
  type Action,
  type GestureSpec,
  type ToolBundle,
  type ToolsApi,
} from '@orochi235/weasel';
import {
  buildActionRegistry,
  findConflicts,
  type Conflict,
  type RegistryEntry,
  type ToolDef,
} from '@orochi235/weasel/routing';
import { formatShortcutParts } from '@orochi235/weasel-ui';
import { KeyCap } from './KeyCap';
import { DispatchTracePanel } from './DispatchTracePanel';
import { TOOL_HOOK_NAMES } from './registryData';
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
      ...(Object.values(tools.registry) as Slot[]),
      ...(tools.ambient as Slot[]),
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

  const toolSlots = useMemo(() => {
    void toolsSig;
    const tools = toolsRef.current;
    if (!tools) return { registry: [] as string[], ambient: [] as string[] };
    return {
      registry: Object.keys(tools.registry).sort(),
      ambient: tools.ambient.map((t) => t.id).sort(),
    };
  }, [toolsSig]);

  const routes = useMemo(() => buildActionRegistry(toolDefs), [toolDefs]);
  const conflicts = useMemo(() => findConflicts(toolDefs), [toolDefs]);

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
        <ToolsWidget defs={toolDefs} slots={toolSlots} />
        <ActionsWidget actions={actions} />
        <RoutesWidget routes={routes} />
      </section>

      {/* Right column: conflicts + live dispatch trace. */}
      <aside className={s.reflect}>
        <ConflictsWidget conflicts={conflicts} />
        <DispatchTracePanel />
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
}: {
  defs: readonly ToolDef<unknown>[];
  slots: { registry: readonly string[]; ambient: readonly string[] };
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
                  <td>{TOOL_HOOK_NAMES[d.id] ?? <span className={s.empty}>—</span>}</td>
                  <td>{ambientSet.has(d.id) ? 'ambient' : 'registry'}</td>
                  <td><KeyCap parts={formatShortcutParts(d.keybinding)} /></td>
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
                    <td>{renderBinding(a.defaultBinding)}</td>
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
// buildActionRegistry. One row per (tool, phase, gesture, target, mods).
// ─────────────────────────────────────────────────────────────────────────

function RoutesWidget({ routes }: { routes: readonly RegistryEntry[] }): ReactElement {
  const sorted = [...routes].sort((a, b) =>
    a.toolId.localeCompare(b.toolId)
    || a.phase.localeCompare(b.phase)
    || a.gesture.localeCompare(b.gesture)
    || a.target.localeCompare(b.target));
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
                <th>Phase</th>
                <th>Gesture</th>
                <th>Target</th>
                <th>Mods</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={`${r.toolId}-${r.phase}-${r.gesture}-${r.target}-${r.modifiers}-${i}`}>
                  <td><code>{r.toolId}</code></td>
                  <td>{r.phase}</td>
                  <td>{r.gesture}</td>
                  <td><code>{r.target}</code></td>
                  <td>{r.modifiers === 'default'
                    ? <span className={s.empty}>—</span>
                    : <code>{r.modifiers}</code>}</td>
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
            {conflicts.map((c, i) => (
              <li key={i}>
                <code>{c.phase}.{c.gesture}.{c.target}</code>
                {c.modifiers !== 'default' && <> · <code>{c.modifiers}</code></>}
                {' '}claimed by{' '}
                {c.toolIds.map((id, j) => (
                  <span key={id}>
                    {j > 0 && ', '}
                    <code>{id}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers — binding render, icon render, enabled snapshot.
// ─────────────────────────────────────────────────────────────────────────

function renderBinding(b: Action['defaultBinding']): ReactNode {
  if (!b) return <span className={s.empty}>—</span>;
  const specs = bindingToSpecs(b);
  return (
    <span className={s.bindingList}>
      {specs.map((spec, i) => (
        <span key={i} className={s.bindingItem}>
          {i > 0 && <span className={s.bindingSep}>or</span>}
          {renderSpec(spec)}
        </span>
      ))}
    </span>
  );
}

// BoundGesture isn't re-exported from the kit barrel — inline the structural
// shape (bare spec | { spec, opts }) for the array form of defaultBinding.
type BoundGestureLike = GestureSpec | { spec: GestureSpec; opts?: unknown };

function bindingToSpecs(b: NonNullable<Action['defaultBinding']>): readonly GestureSpec[] {
  if (!Array.isArray(b)) return [b];
  return (b as readonly BoundGestureLike[]).map((entry) =>
    'kind' in entry ? entry : entry.spec);
}

function renderSpec(spec: GestureSpec): ReactNode {
  if (spec.kind === 'key' || spec.kind === 'key-held') {
    const key = Array.isArray(spec.key) ? spec.key[0]! : spec.key;
    const parts = formatShortcutParts({
      key,
      mod: !!spec.mods?.mod,
      alt: !!spec.mods?.alt,
      shift: spec.mods?.shift === true ? true : undefined,
    });
    return <KeyCap parts={parts} />;
  }
  const mods = 'mods' in spec && spec.mods
    ? Object.entries(spec.mods).filter(([, v]) => v).map(([k]) => k).join('+')
    : '';
  let label: string = spec.kind;
  if (spec.kind === 'click' || spec.kind === 'drag') {
    const t = spec.target;
    if (typeof t === 'string') label = `${spec.kind}(${t})`;
  } else if (spec.kind === 'multiTouch') {
    label = `multiTouch(${spec.fingers})`;
  }
  return (
    <code className={s.bindingTag}>
      {label}{mods && <span className={s.bindingMod}> · {mods}</span>}
    </code>
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
