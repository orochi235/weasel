import { useMemo } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useHandTool,
  useTools,
} from '@orochi235/weasel';
import {
  buildActionRegistry,
  findConflicts,
  apply,
  mods,
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

// Stub ActionFn — registry/conflict walkers don't invoke it, they only
// enumerate route-table keys and modifier-table keys. Using a single
// shared no-op keeps the demo focused on the introspection surface.
const noOp = () => apply<unknown>([]);

/** Demo ToolDef stubs that mirror the gesture surface of useSelectTool +
 *  useHandTool. Real kit consumers introspect their own ToolDefs; the
 *  builtins return the translated `Tool<TScratch>` so we re-declare the
 *  shape here to feed buildActionRegistry / findConflicts. Mirrors the
 *  routes in src/tools/builtin/useSelectTool.ts and useHandTool.ts. */
function buildDemoToolDefs(): readonly ToolDef<unknown>[] {
  const selectTool: ToolDef<unknown> = {
    id: 'select',
    initial: {
      pointerDown: {
        rect: noOp, text: noOp, path: noOp, '*': noOp, empty: noOp,
      },
      drag: {
        rect: noOp, text: noOp, path: noOp, '*': noOp, empty: noOp,
      },
      click: {
        rect: noOp,
        text: noOp,
        path: noOp,
        '*':  noOp,
        empty: {
          [mods()]:                noOp,
          [mods('shift')]:         noOp,
          [mods('mod')]:           noOp,
          [mods('mod', 'shift')]:  noOp,
        },
      },
      dblTap: {
        '*':   noOp,
        empty: noOp,
      },
    },
  };
  const handTool: ToolDef<unknown> = {
    id: 'hand',
    initial: {
      // useHandTool exposes function-form drag — registers as one row
      // with gesture=drag, target='*'.
      drag: noOp,
    },
  };
  return [selectTool, handTool];
}

export function ToolReflectionDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      if (worldX >= p.x && worldX <= p.x + p.width
          && worldY >= p.y && worldY <= p.y + p.height) hits.push(id);
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  };

  const select = useSelectTool(adapter, {
    pickEvery, boundsOf,
    getSelection: () => selection.current,
  });
  const hand = useHandTool();
  const tools = useTools({
    active: 'select',
    registry: { select, hand },
  });

  const toolDefs = useMemo(() => buildDemoToolDefs(), []);
  const registry: RegistryEntry[] = useMemo(
    () => buildActionRegistry(toolDefs),
    [toolDefs],
  );
  const conflicts: Conflict[] = useMemo(
    () => findConflicts(toolDefs),
    [toolDefs],
  );

  return (
    <div className={styles.demo}>
      <p className={styles.note}>
        Three reflection consumers operating on stub ToolDefs that mirror the
        gesture surface of <code>useSelectTool</code> + <code>useHandTool</code>.
        Registry on the left, conflict report in the middle, live canvas on the
        right. Live debug overlay coverage requires a SceneCanvas API extension
        — see follow-ups in the Phase 4 plan.
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
        {rows.map((r, i) => (
          <tr key={`${r.toolId}.${r.phase}.${r.gesture}.${r.target}.${r.modifiers}.${i}`}>
            <td>{r.toolId}</td>
            <td>{r.phase}</td>
            <td>{r.gesture}</td>
            <td>{r.target}</td>
            <td>{r.modifiers}</td>
          </tr>
        ))}
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
      {conflicts.map((c, i) => (
        <li key={i}>
          <code>
            {c.phase}.{c.gesture}[{c.target}]
            {c.modifiers !== 'default' && `:${c.modifiers}`}
          </code>{' '}
          claimed by {c.toolIds.join(', ')}
        </li>
      ))}
    </ul>
  );
}
