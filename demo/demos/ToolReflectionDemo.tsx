import { useMemo } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  useSceneAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useHandTool,
  useTools,
} from '@orochi235/weasel';
import {
  buildActionRegistry,
  canonicalModifiers,
  findConflicts,
  type RegistryEntry,
  type Conflict,
  type ToolDef,
} from '@orochi235/weasel/routing';
import type { DrawCommand } from '../../src/renderer';
import styles from './ToolReflectionDemo.module.css';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 360, H = 280;
const INITIAL: Rect[] = [
  { id: 'a', x:  40, y:  60, width: 90, height: 70, color: '#7fb069' },
  { id: 'b', x: 170, y:  90, width: 90, height: 70, color: '#d4a574' },
  { id: 'c', x:  90, y: 170, width: 90, height: 70, color: '#7ab8d4' },
];

function ToolReflectionDemoInner() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });

  const select = useSelectTool(adapter, { getSelection: () => selection.current });
  const hand = useHandTool();
  const tools = useTools({ active: 'select', registry: { select, hand } });

  // Walk the live tools' attached `def` (set by `defineTool`) to feed the
  // reflection consumers — no synthetic stubs.
  const toolDefs = useMemo<readonly ToolDef<unknown>[]>(
    () => Object.values(tools.registry)
      .map((t) => t.def as ToolDef<unknown> | undefined)
      .filter((d): d is ToolDef<unknown> => d != null),
    [tools.registry],
  );
  const registry: RegistryEntry[] = useMemo(() => buildActionRegistry(toolDefs), [toolDefs]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(toolDefs), [toolDefs]);

  return (
    <div className={styles.demo}>
      <p className={styles.note}>
        Live introspection of the registered <code>useSelectTool</code> +{' '}
        <code>useHandTool</code> via their attached <code>tool.def</code>.
        Registry on the left, conflict report in the middle, the canvas
        they're driving on the right.
      </p>
      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Action registry ({registry.length})</h3>
          <RegistryTable rows={registry} />
        </div>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Conflicts ({conflicts.length})</h3>
          <ConflictsReport conflicts={conflicts} />
        </div>
        <div className={`${styles.panel} ${styles.canvasPanel}`}>
          <h3 className={styles.panelTitle}>Canvas (select + hand)</h3>
          <SceneCanvas
            width={W}
            height={H}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            selectionMode="multi"
            tools={tools}
            layers={{
              scene: {
                drawOne: (n, p): DrawCommand[] => [{
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { color: (n.data as Rect).color },
                }],
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ToolReflectionDemo() {
  return <WeaselProvider><ToolReflectionDemoInner /></WeaselProvider>;
}

function RegistryTable({ rows }: { rows: RegistryEntry[] }) {
  return (
    <table className={styles.registry}>
      <thead>
        <tr>
          <th>tool</th>
          <th>phase</th>
          <th>gesture</th>
          <th>target</th>
          <th>mods</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const modKey = canonicalModifiers(r.modifiers);
          return (
          <tr key={`${r.toolId}.${r.phase}.${r.gesture}.${r.target}.${modKey}.${i}`}>
            <td>{r.toolId}</td>
            <td>{r.phase}</td>
            <td>{r.gesture}</td>
            <td>{r.target}</td>
            <td>{modKey || 'default'}</td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConflictsReport({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) {
    return <p className={styles.conflictsEmpty}>No conflicts.</p>;
  }
  return (
    <ul className={styles.conflicts}>
      {conflicts.map((c, i) => {
        const modKey = canonicalModifiers(c.modifiers);
        return (
        <li key={i}>
          <code>
            {c.phase}.{c.gesture}[{c.target}]
            {modKey !== '' && `:${modKey}`}
          </code>{' '}
          claimed by {c.toolIds.join(', ')}
        </li>
        );
      })}
    </ul>
  );
}
