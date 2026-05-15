/**
 * Toolkit Builder — assemble a canvas from kit primitives and inspect the
 * resulting action registry, route table, and conflicts. Independent of the
 * main Swillustrator app; mounted under `#/dev/toolkits`.
 *
 * Dogfoods `<SceneCanvas toolBundle / defaultTools />` for tool synthesis;
 * the tool hooks themselves (rect / ellipse / line / polygon / star / pencil
 * / lasso / text / clone) are owned by SceneCanvas. Action hooks (delete /
 * undoRedo / clipboard / group / nest / etc.) are still wired here because
 * each one's adapter contract differs and the kit doesn't bundle them yet.
 *
 * URL state is canonical: `?bundle=<id>` for named presets, or
 * `?tools=...&actions=...` for custom selections.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useActionsRegistry,
  useAlign,
  useClipboard,
  useDelete,
  useDistribute,
  useDuplicate,
  useEscape,
  useFlip,
  useGroup,
  useNest,
  useNudge,
  useReorder,
  useScene,
  useSceneAdapter,
  useSelectAll,
  useSelection,
  useUndoRedo,
  useUngroup,
  useUnnest,
  type BuiltinToolId,
  type ClipboardSnapshot,
  type Group,
  type SceneNode,
  type ToolsApi,
} from '@orochi235/weasel';
import {
  buildActionRegistry,
  findConflicts,
  type Conflict,
  type RegistryEntry,
  type ToolDef,
} from '@orochi235/weasel/routing';
import { formatShortcutParts } from '../ui/ToolPalette/formatShortcut';
import {
  AlignBottomIcon,
  AlignCenterXIcon,
  AlignCenterYIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  BringForwardIcon,
  BringToFrontIcon,
  CopyIcon,
  CutIcon,
  DeleteIcon,
  DistributeXIcon,
  DistributeYIcon,
  DuplicateIcon,
  FlipXIcon,
  FlipYIcon,
  GroupIcon,
  PasteIcon,
  RedoIcon,
  SendBackwardIcon,
  SendToBackIcon,
  UndoIcon,
  UngroupIcon,
} from '../actionIcons';
import s from './ToolkitBuilder.module.css';

const ACTION_ICON: Record<string, React.ComponentType> = {
  delete: DeleteIcon,
  duplicate: DuplicateIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  group: GroupIcon,
  ungroup: UngroupIcon,
  'reorder.forward': BringForwardIcon,
  'reorder.backward': SendBackwardIcon,
  'reorder.front': BringToFrontIcon,
  'reorder.back': SendToBackIcon,
  'align.left': AlignLeftIcon,
  'align.right': AlignRightIcon,
  'align.top': AlignTopIcon,
  'align.bottom': AlignBottomIcon,
  'align.centerX': AlignCenterXIcon,
  'align.centerY': AlignCenterYIcon,
  'distribute.horizontal': DistributeXIcon,
  'distribute.vertical': DistributeYIcon,
  'flip.horizontal': FlipXIcon,
  'flip.vertical': FlipYIcon,
  'clipboard.copy': CopyIcon,
  'clipboard.cut': CutIcon,
  'clipboard.paste': PasteIcon,
};

interface ShapeData { fill: string }
interface ShapePose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<ShapeData, 'default', ShapePose>;

interface CatalogEntry { id: string; label: string; group: 'tool' | 'action' }

interface Bundle { id: string; label: string; tools: readonly string[]; actions: readonly string[] }

const BUNDLES: readonly Bundle[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    tools: ['select', 'hand'],
    actions: ['undoRedo', 'escape'],
  },
  {
    id: 'standard',
    label: 'Standard',
    tools: ['select', 'hand', 'rect', 'ellipse', 'line', 'pencil'],
    actions: ['delete', 'undoRedo', 'duplicate', 'nudge', 'escape', 'selectAll', 'clipboard'],
  },
  {
    id: 'everything',
    label: 'Everything',
    tools: ['select', 'hand', 'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil', 'lasso', 'text', 'clone'],
    actions: ['delete', 'undoRedo', 'duplicate', 'nudge', 'escape', 'selectAll', 'reorder', 'align', 'distribute', 'flip', 'clipboard', 'group', 'nest'],
  },
];

function bundleMatching(tools: Set<string>, actions: Set<string>): string {
  for (const b of BUNDLES) {
    if (b.tools.length === tools.size
      && b.actions.length === actions.size
      && b.tools.every((t) => tools.has(t))
      && b.actions.every((a) => actions.has(a))
    ) return b.id;
  }
  return 'custom';
}

const CATALOG: readonly CatalogEntry[] = [
  { id: 'select', label: 'useSelectTool', group: 'tool' },
  { id: 'hand', label: 'useHandTool', group: 'tool' },
  { id: 'rect', label: 'useRectTool', group: 'tool' },
  { id: 'ellipse', label: 'useEllipseTool', group: 'tool' },
  { id: 'line', label: 'useLineTool', group: 'tool' },
  { id: 'polygon', label: 'usePolygonTool', group: 'tool' },
  { id: 'star', label: 'useStarTool', group: 'tool' },
  { id: 'pencil', label: 'usePencilTool', group: 'tool' },
  { id: 'lasso', label: 'useLassoTool', group: 'tool' },
  { id: 'text', label: 'useTextTool', group: 'tool' },
  { id: 'clone', label: 'useCloneTool', group: 'tool' },
  { id: 'delete', label: 'useDelete', group: 'action' },
  { id: 'undoRedo', label: 'useUndoRedo', group: 'action' },
  { id: 'duplicate', label: 'useDuplicate', group: 'action' },
  { id: 'nudge', label: 'useNudge', group: 'action' },
  { id: 'escape', label: 'useEscape', group: 'action' },
  { id: 'selectAll', label: 'useSelectAll', group: 'action' },
  { id: 'reorder', label: 'useReorder', group: 'action' },
  { id: 'align', label: 'useAlign', group: 'action' },
  { id: 'distribute', label: 'useDistribute', group: 'action' },
  { id: 'flip', label: 'useFlip', group: 'action' },
  { id: 'clipboard', label: 'useClipboard', group: 'action' },
  { id: 'group', label: 'useGroup / useUngroup', group: 'action' },
  { id: 'nest', label: 'useNest / useUnnest', group: 'action' },
];

function parseHash(hash: string): { tools: Set<string>; actions: Set<string> } {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const bundleId = params.get('bundle');
  if (bundleId && bundleId !== 'custom') {
    const b = BUNDLES.find((x) => x.id === bundleId);
    if (b) return { tools: new Set(b.tools), actions: new Set(b.actions) };
  }
  const fallback = BUNDLES.find((b) => b.id === 'standard')!;
  return {
    tools: new Set((params.get('tools') ?? fallback.tools.join(',')).split(',').filter(Boolean)),
    actions: new Set((params.get('actions') ?? fallback.actions.join(',')).split(',').filter(Boolean)),
  };
}

function writeHash(tools: Set<string>, actions: Set<string>) {
  const params = new URLSearchParams();
  const bundleId = bundleMatching(tools, actions);
  if (bundleId !== 'custom') {
    params.set('bundle', bundleId);
  } else {
    if (tools.size) params.set('tools', [...tools].join(','));
    if (actions.size) params.set('actions', [...actions].join(','));
  }
  const next = `#/dev/toolkits${params.toString() ? `?${params.toString()}` : ''}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

let _seq = 0;
const freshId = (prefix: string) => asNodeId(`${prefix}-${++_seq}`);

export function ToolkitBuilder() {
  const [enabled, setEnabled] = useState(() => parseHash(window.location.hash));
  useEffect(() => { writeHash(enabled.tools, enabled.actions); }, [enabled]);

  // Measure the canvas container so SceneCanvas's fixed-size prop can flex.
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 520, height: 480 });
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setCanvasSize({ width: Math.floor(cr.width), height: Math.max(360, Math.floor(cr.width * 0.66)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggle = (group: 'tool' | 'action', id: string) => {
    setEnabled((cur) => {
      const next = group === 'tool' ? new Set(cur.tools) : new Set(cur.actions);
      if (next.has(id)) next.delete(id); else next.add(id);
      return group === 'tool' ? { ...cur, tools: next } : { ...cur, actions: next };
    });
  };

  const activeBundle = bundleMatching(enabled.tools, enabled.actions);
  const applyBundle = (bundleId: string) => {
    if (bundleId === 'custom') return;
    const b = BUNDLES.find((x) => x.id === bundleId);
    if (!b) return;
    setEnabled({ tools: new Set(b.tools), actions: new Set(b.actions) });
  };

  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });

  // Group state — useGroup / useUngroup need a parallel structure that
  // tracks lasso-style groups distinct from scene parenting.
  const [groups, setGroups] = useState<Group[]>([]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const groupAdapter = useMemo(() => ({
    getGroup: (id: string) => groupsRef.current.find((g) => g.id === id),
    getGroupsForMember: (id: string) =>
      groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g: Group) => setGroups((gs) => [...gs, g]),
    removeGroup: (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id)),
    addToGroup: (gid: string, ids: string[]) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: [...g.members, ...ids] } : g))),
    removeFromGroup: (gid: string, ids: string[]) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: g.members.filter((m) => !ids.includes(m)) } : g))),
  }), []);

  // ── Action hooks (always called; gated via enableKeyboard) ──────────────────
  const getSelection = () => [...selection.current];
  const applyOps = adapter.applyOps?.bind(adapter);

  useDelete({
    getSelection,
    getNode: (id) => scene.get(id) ?? { id },
    removeNode: (id) => scene.remove(asNodeId(id)),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('delete') });

  useUndoRedo({
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
  }, { bindKeyboard: enabled.actions.has('undoRedo') });

  useDuplicate<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    cloneNode: (id, offset) => {
      const n = scene.get(id);
      if (!n) return { id: freshId('clone') };
      const p = n.pose;
      return { id: freshId('clone'), pose: { ...p, x: p.x + offset.dx, y: p.y + offset.dy } } as DemoNode;
    },
    applyOps,
  }, { enableKeyboard: enabled.actions.has('duplicate') });

  useNudge<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  }, {
    enableKeyboard: enabled.actions.has('nudge'),
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  });

  useEscape({
    getSelection,
    setSelection: (ids) => selection.set(ids),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('escape') });

  useSelectAll({
    getSelection,
    listAll: () => [...scene.renderOrder()],
    setSelection: (ids) => selection.set(ids),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('selectAll') });

  useReorder({
    getSelection,
    getParent: () => null,
    getChildren: () => [...scene.renderOrder()].map(String),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('reorder') });

  useAlign<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('align') });
  useDistribute<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('distribute') });
  useFlip<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  }, { enableKeyboard: enabled.actions.has('flip') });

  useClipboard<DemoNode>({
    ...adapter,
    commitInsert: () => null,
    snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
      items: ids.map((id) => scene.get(asNodeId(id))).filter((n): n is DemoNode => n != null),
    }),
    commitPaste: (clip, offset) => {
      const items = clip.items as DemoNode[];
      return items.map((src) => ({
        ...src,
        id: freshId('paste'),
        pose: { ...src.pose, x: src.pose.x + offset.dx, y: src.pose.y + offset.dy },
      }));
    },
    getNode: (id: string) => scene.get(asNodeId(id)) ?? undefined,
    removeNode: (id: string) => scene.remove(asNodeId(id)),
  }, {
    getSelection: () => [...selection.current],
    enableKeyboard: enabled.actions.has('clipboard'),
  });

  useGroup({
    ...groupAdapter,
    getSelection,
    applyOps,
  }, { enableKeyboard: enabled.actions.has('group') });
  useUngroup({
    ...groupAdapter,
    getSelection,
    applyOps,
  }, { enableKeyboard: enabled.actions.has('group') });

  const composeAbs = <P,>(_p: P, c: P): P => c;
  const decomposeAbs = <P,>(_p: P, w: P): P => w;
  useNest(adapter, {
    composePose: composeAbs,
    decomposePose: decomposeAbs,
    groupFactory: ({ id, localPose }): DemoNode => ({
      id: asNodeId(id),
      kind: 'container' as const,
      layer: 'default' as const,
      pose: localPose,
      data: { fill: '#3a2e22' },
      parent: null,
      children: [],
    }),
    enableKeyboard: enabled.actions.has('nest'),
  });
  useUnnest(adapter, {
    composePose: composeAbs,
    decomposePose: decomposeAbs,
    isGroup: (_id, obj) => obj?.kind === 'container',
    enableKeyboard: enabled.actions.has('nest'),
  });

  // Capture the ToolsApi SceneCanvas synthesizes from `defaultTools` so the
  // reflection panels can walk it. Updated via `onToolsCreated` whenever
  // the bundle changes.
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const toolDefs: readonly ToolDef<unknown>[] = useMemo(
    () => tools
      ? Object.values(tools.registry)
        .map((t) => t.def as ToolDef<unknown> | undefined)
        .filter((d): d is ToolDef<unknown> => d != null)
      : [],
    [tools],
  );
  const routeRegistry: RegistryEntry[] = useMemo(() => buildActionRegistry(toolDefs), [toolDefs]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(toolDefs), [toolDefs]);

  const slotFor = (toolId: string): 'active' | 'hotkey' | 'ambient' | 'inactive' => {
    if (!tools) return 'inactive';
    if (tools.active === toolId) return 'active';
    if (tools.ambient.some((t) => t.id === toolId)) return 'ambient';
    const t = tools.registry[toolId];
    if (t?.hotkey) return 'hotkey';
    return 'inactive';
  };

  const actionsReg = useActionsRegistry();
  const actions = actionsReg ? actionsReg.list() : [];

  const defaultTools = useMemo(() => [...enabled.tools] as BuiltinToolId[], [enabled.tools]);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Toolkit Builder</h1>
          <label className={s.bundlePicker}>
            <span>Bundle</span>
            <select value={activeBundle} onChange={(e) => applyBundle(e.target.value)}>
              {BUNDLES.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
              <option value="custom" disabled={activeBundle !== 'custom'}>Custom</option>
            </select>
          </label>
        </div>
        <p className={s.subtitle}>
          Assemble a canvas from kit primitives. URL state is canonical —
          copy the address to share a config.
        </p>
      </header>
      <div className={s.layout}>
        <aside className={s.catalog}>
          <h2 className={s.sectionTitle}>Bundle membership</h2>
          <table className={s.matrix}>
            <thead>
              <tr>
                <th></th>
                {BUNDLES.map((b) => <th key={b.id} title={b.label}>{b.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATALOG.filter((c) => c.group === 'tool').map((c) => (
                <tr key={c.id}>
                  <td><code>{c.id}</code></td>
                  {BUNDLES.map((b) => (
                    <td key={b.id} className={s.matrixCell}>
                      {b.tools.includes(c.id) ? '✓' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className={s.sectionTitle}>Tools</h2>
          {CATALOG.filter((c) => c.group === 'tool').map((c) => (
            <label key={c.id} className={s.row}>
              <input
                type="checkbox"
                checked={enabled.tools.has(c.id)}
                onChange={() => toggle('tool', c.id)}
              />
              <code>{c.label}</code>
            </label>
          ))}
          <h2 className={s.sectionTitle}>Actions</h2>
          {CATALOG.filter((c) => c.group === 'action').map((c) => (
            <label key={c.id} className={s.row}>
              <input
                type="checkbox"
                checked={enabled.actions.has(c.id)}
                onChange={() => toggle('action', c.id)}
              />
              <code>{c.label}</code>
            </label>
          ))}
        </aside>
        <main className={s.canvas} ref={canvasContainerRef}>
          <SceneCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            className={s.scene}
            scene={scene}
            selection={selection}
            selectionMode="multi"
            defaultTools={defaultTools}
            onToolsCreated={setTools}
          />
          <p className={s.hint}>
            Click & drag with the configured tools. Action keybindings live
            when wired (see right panel for the full keybind map).
          </p>
        </main>
        <aside className={s.reflect}>
          <section>
            <h3 className={s.sectionTitle}>Action registry ({actions.length})</h3>
            <table className={s.table}>
              <thead><tr><th></th><th>id</th><th>label</th><th>binding</th></tr></thead>
              <tbody>
                {actions.map((a) => {
                  const Icon = ACTION_ICON[a.id];
                  return (
                    <tr key={a.id}>
                      <td className={s.iconCell}>{Icon ? <Icon /> : <span className={s.keysEmpty}>—</span>}</td>
                      <td><code>{a.id}</code></td>
                      <td>{a.label}</td>
                      <td><Keys parts={formatShortcutParts(a.defaultBinding)} /></td>
                    </tr>
                  );
                })}
                {actions.length === 0 && (
                  <tr><td colSpan={4} className={s.empty}>No actions registered.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className={s.sectionTitle}>Tool routes ({routeRegistry.length})</h3>
            <table className={s.table}>
              <thead><tr><th>tool</th><th>slot</th><th>phase</th><th>gesture</th><th>target</th><th>mods</th></tr></thead>
              <tbody>
                {routeRegistry.map((r, i) => (
                  <tr key={i}>
                    <td>{r.toolId}</td>
                    <td><span className={s.slot} data-slot={slotFor(r.toolId)}>{slotFor(r.toolId)}</span></td>
                    <td>{r.phase}</td>
                    <td>{r.gesture}</td>
                    <td>{r.target}</td>
                    <td><Keys parts={routingModsToParts(r.modifiers)} /></td>
                  </tr>
                ))}
                {routeRegistry.length === 0 && (
                  <tr><td colSpan={6} className={s.empty}>No tools selected.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className={s.sectionTitle}>Static route overlaps ({conflicts.length})</h3>
            <p className={s.note}>
              Tuples claimed by 2+ tools. Most are <em>not</em> runtime
              conflicts — the dispatcher's slot precedence (hotkey →
              active → ambient) picks one tool per pointer event, and
              only one tool occupies the active slot at a time.
            </p>
            {conflicts.length === 0
              ? <p className={s.empty}>No overlaps.</p>
              : (
                <ul className={s.conflicts}>
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      <code>{c.phase}.{c.gesture}[{c.target}]</code>
                      {c.modifiers !== 'default' && (
                        <> <Keys parts={routingModsToParts(c.modifiers)} /></>
                      )}
                      {' '}claimed by {c.toolIds.join(', ')}
                    </li>
                  ))}
                </ul>
              )
            }
          </section>
        </aside>
      </div>
    </div>
  );
}

function routingModsToParts(mods: string): readonly string[] | undefined {
  if (!mods || mods === 'default') return undefined;
  return mods
    .split('+')
    .map((m) => (m === 'mod' ? '⌘' : m === 'shift' ? '⇪' : m === 'alt' ? '⌥' : m));
}

function Keys({ parts }: { parts: readonly string[] | undefined }) {
  if (!parts || parts.length === 0) return <span className={s.keysEmpty}>—</span>;
  return (
    <span className={s.keys}>
      {parts.map((p, i) => <kbd key={i} className={s.key}>{p}</kbd>)}
    </span>
  );
}
