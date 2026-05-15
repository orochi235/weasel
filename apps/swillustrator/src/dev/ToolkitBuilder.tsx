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
import { useEffect, useMemo, useState } from 'react';
import {
  asNodeId,
  ellipsePath,
  linePath,
  rectPath,
  regularPolygonPath,
  starPath,
  SceneCanvas,
  useActionsRegistry,
  useAlign,
  useDelete,
  useDistribute,
  useDuplicate,
  useEllipseTool,
  useEscape,
  useFlip,
  useHandTool,
  useLineTool,
  useLassoTool,
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
  useTools,
  useUndoRedo,
  type AnyTool,
  type KeyBinding,
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
import s from './ToolkitBuilder.module.css';

interface ShapeData { path: Path; fill: string; stroke?: string; strokeWidth?: number }
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

  const allTools: Record<string, AnyTool> = useMemo(() => ({
    select, hand, rect, ellipse, line, polygon, star, pencil, lasso,
  }), [select, hand, rect, ellipse, line, polygon, star, pencil, lasso]);

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

  // useAlign/useDistribute/useFlip auto-register their actions
  // unconditionally when an ActionsProvider is in scope — no opt-out
  // surface today. Listed in the catalog for visibility; the checkboxes
  // are inert (call sites below always run).
  useAlign<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  });
  useDistribute<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  });
  useFlip<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
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
        <main className={s.canvas}>
          <SceneCanvas
            width={520}
            height={360}
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
              <thead><tr><th>id</th><th>label</th><th>binding</th></tr></thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td><code>{a.id}</code></td>
                    <td>{a.label}</td>
                    <td><code>{formatBinding(a.defaultBinding)}</code></td>
                  </tr>
                ))}
                {actions.length === 0 && (
                  <tr><td colSpan={3} className={s.empty}>No actions registered.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className={s.sectionTitle}>Tool routes ({routeRegistry.length})</h3>
            <table className={s.table}>
              <thead><tr><th>tool</th><th>phase</th><th>gesture</th><th>target</th><th>mods</th></tr></thead>
              <tbody>
                {routeRegistry.map((r, i) => (
                  <tr key={i}>
                    <td>{r.toolId}</td>
                    <td>{r.phase}</td>
                    <td>{r.gesture}</td>
                    <td>{r.target}</td>
                    <td>{r.modifiers}</td>
                  </tr>
                ))}
                {routeRegistry.length === 0 && (
                  <tr><td colSpan={5} className={s.empty}>No tools selected.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className={s.sectionTitle}>Conflicts ({conflicts.length})</h3>
            {conflicts.length === 0
              ? <p className={s.empty}>No conflicts.</p>
              : (
                <ul className={s.conflicts}>
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      <code>{c.phase}.{c.gesture}[{c.target}]{c.modifiers !== 'default' && `:${c.modifiers}`}</code>
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

function formatBinding(b: KeyBinding | undefined): string {
  if (!b) return '—';
  const parts: string[] = [];
  if (b.mod) parts.push('Mod');
  if (b.shift === true) parts.push('Shift');
  if (b.alt) parts.push('Alt');
  const keyStr = Array.isArray(b.key) ? b.key.join('/') : (b.key as string);
  parts.push(keyStr);
  return parts.join('+');
}
