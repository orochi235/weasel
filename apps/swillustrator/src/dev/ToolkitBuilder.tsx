/**
 * Toolkit Builder — assemble a custom canvas from kit primitives and inspect
 * the resulting action registry, route table, and conflicts. Independent of
 * the main Swillustrator app; mounted under `#/dev/toolkits`.
 *
 * v1 catalog covers the shape tools, the lasso tool, and most of the
 * selection-driven action hooks. Tools whose adapters require additional
 * state (text, pen, clone, useGroup/useUngroup) are deferred — they need
 * surfaces the synthesized scene adapter doesn't provide.
 *
 * URL state is canonical: `?tools=...&actions=...` survives reload.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  cloneByAltDrag,
  ellipsePath,
  linePath,
  rectPath,
  regularPolygonPath,
  starPath,
  SceneCanvas,
  useActionsRegistry,
  useAlign,
  useClipboard,
  useCloneTool,
  useDelete,
  useDistribute,
  useDuplicate,
  useEllipseTool,
  useEscape,
  useFlip,
  useGroup,
  useHandTool,
  useLineTool,
  useLassoTool,
  useNest,
  useNudge,
  usePencilTool,
  usePolygonTool,
  useRectTool,
  useReorder,
  useScene,
  useSceneAdapter,
  useSelectAll,
  useSelection,
  useSelectTool,
  useStarTool,
  useTextTool,
  useTools,
  useUndoRedo,
  useUngroup,
  useUnnest,
  type AnyTool,
  type ClipboardSnapshot,
  type Group,
  type NodeId,
  type Path,
  type PolygonPath,
  type SceneNode,
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

/** Action ID → icon component. Actions without an icon (escape, selectAll,
 *  nudge.*, nest/unnest) render '—'. */
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

interface ShapeData { path?: Path; text?: string; fill: string; stroke?: string; strokeWidth?: number }
interface ShapePose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<ShapeData, 'default', ShapePose>;

const FILLS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];
let _seq = 0;
const nextFill = () => FILLS[_seq++ % FILLS.length];
const freshId = (prefix: string) => asNodeId(`${prefix}-${++_seq}`);

function makeNode(id: NodeId, pose: ShapePose, data: ShapeData): DemoNode {
  return { id, kind: 'leaf', layer: 'default', pose, data, parent: null };
}

interface CatalogEntry { id: string; label: string; group: 'tool' | 'action' }

const CATALOG: readonly CatalogEntry[] = [
  // Tools
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
  // Actions
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
  return {
    tools: new Set((params.get('tools') ?? 'select,hand,rect').split(',').filter(Boolean)),
    actions: new Set((params.get('actions') ?? 'delete,undoRedo').split(',').filter(Boolean)),
  };
}

function writeHash(tools: Set<string>, actions: Set<string>) {
  const params = new URLSearchParams();
  if (tools.size) params.set('tools', [...tools].join(','));
  if (actions.size) params.set('actions', [...actions].join(','));
  const next = `#/dev/toolkits${params.toString() ? `?${params.toString()}` : ''}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

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

  // Playground scene + selection.
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });

  // Separate Group registry — useGroup / useUngroup need a parallel
  // structure that tracks lasso-style groups distinct from scene parenting.
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

  // ── Tool hooks (always called; conditionally registered) ────────────────────
  const select = useSelectTool(adapter, { getSelection: () => selection.current });
  const hand = useHandTool();
  const rect = useRectTool<DemoNode>({
    create: (b) => makeNode(freshId('rc'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: rectPath(b.x, b.y, b.width, b.height), fill: nextFill() }),
  });
  const ellipse = useEllipseTool<DemoNode>({
    create: (b) => makeNode(freshId('el'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: ellipsePath(b), fill: nextFill() }),
  });
  const line = useLineTool<DemoNode>({
    create: (a, b) => makeNode(freshId('ln'),
      { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x) || 1, height: Math.abs(b.y - a.y) || 1 },
      { path: linePath(a, b), fill: nextFill(), stroke: nextFill(), strokeWidth: 2 }),
  });
  const polygon = usePolygonTool<DemoNode>({
    create: (center, radius, rotation, sides) => makeNode(freshId('pg'),
      { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 },
      { path: regularPolygonPath(center, radius, sides, rotation), fill: nextFill() }),
  });
  const star = useStarTool<DemoNode>({
    create: (center, outerRadius, rotation, points) => makeNode(freshId('st'),
      { x: center.x - outerRadius, y: center.y - outerRadius,
        width: outerRadius * 2, height: outerRadius * 2 },
      { path: starPath(center, outerRadius, points, undefined, rotation), fill: nextFill() }),
  });
  const pencil = usePencilTool<DemoNode>({
    create: (path: PolygonPath) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < path.coords.length; i += 2) {
        const px = path.coords[i], py = path.coords[i + 1];
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
      return makeNode(freshId('pe'),
        { x: isFinite(minX) ? minX : 0, y: isFinite(minY) ? minY : 0,
          width: isFinite(maxX - minX) ? (maxX - minX) || 1 : 1,
          height: isFinite(maxY - minY) ? (maxY - minY) || 1 : 1 },
        { path, fill: nextFill(), stroke: nextFill(), strokeWidth: 2 });
    },
  });
  const lasso = useLassoTool(adapter);
  const text = useTextTool<DemoNode>({
    pointInsert: (point) => makeNode(freshId('tx'),
      { x: point.x, y: point.y, width: 80, height: 20 },
      { fill: nextFill(), text: 'Text' }),
  });
  const cloneInsertAdapter = useMemo(() => ({
    ...adapter,
    commitInsert: () => null,
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
  }), [adapter]);
  const clone = useCloneTool<DemoNode, ShapePose>(cloneInsertAdapter, {
    behaviors: [cloneByAltDrag()],
  });

  const allTools: Record<string, AnyTool> = useMemo(() => ({
    select, hand, rect, ellipse, line, polygon, star, pencil, lasso, text, clone,
  }), [select, hand, rect, ellipse, line, polygon, star, pencil, lasso, text, clone]);

  const registry = useMemo(() => {
    const out: Record<string, AnyTool> = {};
    for (const id of enabled.tools) {
      const t = allTools[id];
      if (t) out[id] = t;
    }
    return out;
  }, [enabled.tools, allTools]);

  const fallbackRegistry = Object.keys(registry).length ? registry : { select };
  const active = (registry.select && 'select')
    || (Object.keys(registry)[0] ?? 'select');
  const tools = useTools({ active, registry: fallbackRegistry });

  // ── Action hooks (always called; gated via enableKeyboard / bindKeyboard) ───
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
      return makeNode(freshId('clone'),
        { x: p.x + offset.dx, y: p.y + offset.dy, width: p.width, height: p.height },
        { ...n.data });
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
      return items.map((src) => makeNode(freshId('paste'),
        { ...src.pose, x: src.pose.x + offset.dx, y: src.pose.y + offset.dy },
        { ...src.data }));
    },
    getNode: (id: string) => scene.get(asNodeId(id)) ?? undefined,
    removeNode: (id: string) => scene.remove(asNodeId(id)),
  }, {
    getSelection: () => [...selection.current],
    enableKeyboard: enabled.actions.has('clipboard'),
  });

  // Group / Ungroup wired against the parallel Group registry.
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

  // Nest / Unnest — scene v1 stores world poses, so compose/decompose are
  // identity (matches NestingDemo).
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

  // ── Reflection panels ───────────────────────────────────────────────────────
  const toolDefs: readonly ToolDef<unknown>[] = useMemo(
    () => Object.values(registry)
      .map((t) => t.def as ToolDef<unknown> | undefined)
      .filter((d): d is ToolDef<unknown> => d != null),
    [registry],
  );
  const routeRegistry: RegistryEntry[] = useMemo(() => buildActionRegistry(toolDefs), [toolDefs]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(toolDefs), [toolDefs]);

  // Slot map: which dispatcher slot each registered tool occupies right
  // now. Slot determines runtime precedence (hotkey > active > ambient)
  // and is what makes most "static overlaps" non-conflicts. Computed
  // from the live `tools` API rather than the ToolDef so it reflects
  // current state.
  const slotFor = (toolId: string): 'active' | 'hotkey' | 'ambient' | 'inactive' => {
    if (tools.active === toolId) return 'active';
    if (tools.ambient.some((t) => t.id === toolId)) return 'ambient';
    const t = registry[toolId];
    if (t?.hotkey) return 'hotkey';
    // Tool is in the registry but not in any dispatcher slot — its routes
    // can't fire until it's switched active (or moved to ambient/hotkey).
    // Treat as a dead entry for visualization purposes.
    return 'inactive';
  };

  const actionsReg = useActionsRegistry();
  const actions = actionsReg ? actionsReg.list() : [];

  return (
    <div className={s.root}>
      <header className={s.header}>
        <h1 className={s.title}>Toolkit Builder</h1>
        <p className={s.subtitle}>
          Assemble a canvas from kit primitives. URL state is canonical —
          copy the address to share a config.
        </p>
      </header>
      <div className={s.layout}>
        <aside className={s.catalog}>
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
            tools={tools}
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

/** Convert routing's canonical modifier key ('mod' | 'shift' | 'alt' |
 *  'mod+shift' | 'default' | ...) to per-key chip parts that match the
 *  vocabulary `formatShortcutParts` uses for keybindings. */
function routingModsToParts(mods: string): readonly string[] | undefined {
  if (!mods || mods === 'default') return undefined;
  return mods
    .split('+')
    .map((m) => (m === 'mod' ? '⌘' : m === 'shift' ? '⇪' : m === 'alt' ? '⌥' : m));
}

/** Render an array of keystroke chips with key-cap styling. */
function Keys({ parts }: { parts: readonly string[] | undefined }) {
  if (!parts || parts.length === 0) return <span className={s.keysEmpty}>—</span>;
  return (
    <span className={s.keys}>
      {parts.map((p, i) => <kbd key={i} className={s.key}>{p}</kbd>)}
    </span>
  );
}
