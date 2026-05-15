/**
 * Toolkit Builder — assemble a custom canvas from kit primitives and inspect
 * the resulting action registry, route table, and conflicts. Independent of
 * the main Swillustrator app; mounted under `#/dev/toolkits`.
 *
 * v0 scope: hard-coded catalog of select / hand / rect tools and delete /
 * undo-redo action hooks. URL state survives reload (`?tools=...&actions=...`).
 * Catalog grows iteratively.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  asNodeId,
  rectPath,
  SceneCanvas,
  useActionsRegistry,
  useDelete,
  useHandTool,
  useRectTool,
  useScene,
  useSceneAdapter,
  useSelection,
  useSelectTool,
  useTools,
  useUndoRedo,
  type AnyTool,
  type KeyBinding,
  type Path,
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

interface RectData { path: Path; fill: string }
interface RectPose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<RectData, 'default', RectPose>;

const FILLS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];
let _seq = 0;
const nextFill = () => FILLS[_seq++ % FILLS.length];

interface CatalogEntry {
  id: string;
  label: string;
  group: 'tool' | 'action';
}

const CATALOG: readonly CatalogEntry[] = [
  { id: 'select', label: 'useSelectTool', group: 'tool' },
  { id: 'hand', label: 'useHandTool', group: 'tool' },
  { id: 'rect', label: 'useRectTool', group: 'tool' },
  { id: 'delete', label: 'useDelete', group: 'action' },
  { id: 'undoRedo', label: 'useUndoRedo', group: 'action' },
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
  // URL state — survives reload, copy-pasteable as a config link.
  const [enabled, setEnabled] = useState(() => parseHash(window.location.hash));
  useEffect(() => { writeHash(enabled.tools, enabled.actions); }, [enabled]);

  const toggle = (group: 'tool' | 'action', id: string) => {
    setEnabled((cur) => {
      const next = group === 'tool' ? new Set(cur.tools) : new Set(cur.actions);
      if (next.has(id)) next.delete(id); else next.add(id);
      return group === 'tool' ? { ...cur, tools: next } : { ...cur, actions: next };
    });
  };

  // Playground scene + selection. All hooks are always called (React rules);
  // selection just decides which ones get wired into the live canvas.
  const scene = useScene<RectData, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });

  // Tool hooks — always called, conditionally registered.
  const select = useSelectTool(adapter, { getSelection: () => selection.current });
  const hand = useHandTool();
  const rect = useRectTool<DemoNode>({
    create: (b) => ({
      id: asNodeId(`r-${++_seq}`),
      kind: 'leaf',
      layer: 'default',
      pose: { x: b.x, y: b.y, width: b.width, height: b.height },
      data: { path: rectPath(b.x, b.y, b.width, b.height), fill: nextFill() },
      parent: null,
    }),
  });

  const registry = useMemo(() => {
    const out: Record<string, AnyTool> = {};
    if (enabled.tools.has('select')) out.select = select;
    if (enabled.tools.has('hand')) out.hand = hand;
    if (enabled.tools.has('rect')) out.rect = rect;
    return out;
  }, [enabled.tools, select, hand, rect]);

  const active = registry.select ? 'select' : Object.keys(registry)[0] ?? 'select';
  const tools = useTools({ active, registry: Object.keys(registry).length ? registry : { select } });

  // Action hooks — always called; the boolean gates whether they bind keys
  // and register into the surrounding ActionsProvider.
  useDelete(
    {
      getSelection: () => [...selection.current],
      getNode: (id) => scene.get(id) ?? { id },
      removeNode: (id) => scene.remove(asNodeId(id)),
      applyOps: adapter.applyOps?.bind(adapter),
    },
    { enableKeyboard: enabled.actions.has('delete') },
  );
  useUndoRedo(
    {
      undo: () => scene.undo(),
      redo: () => scene.redo(),
      canUndo: () => scene.canUndo(),
      canRedo: () => scene.canRedo(),
    },
    { bindKeyboard: enabled.actions.has('undoRedo') },
  );

  // Reflection panels.
  const toolDefs: readonly ToolDef<unknown>[] = useMemo(
    () => Object.values(registry)
      .map((t) => t.def as ToolDef<unknown> | undefined)
      .filter((d): d is ToolDef<unknown> => d != null),
    [registry],
  );
  const routeRegistry: RegistryEntry[] = useMemo(() => buildActionRegistry(toolDefs), [toolDefs]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(toolDefs), [toolDefs]);

  const actionsReg = useActionsRegistry();
  // Re-snapshot per render so registrations from the hooks above flow through.
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
            Click & drag with the configured tools to draw / select / pan.
            Action keybindings live (Delete, Mod+Z, Mod+Shift+Z) when wired.
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
