import { useMemo } from 'react';
import { SceneCanvas, WeaselProvider, solid, useScene, useSelection, type Fill, useScopedTools } from '@weasel-js/core';
import {
  buildRouteRegistry,
  canonicalModifiers,
  findConflicts,
  type RegistryEntry,
  type Conflict,
} from '@weasel-js/routing';
import styles from './ToolReflectionDemo.module.css';
import { DemoStage } from './DemoStage';
import { movePreset, pickPreset } from '@weasel-js/editing';

interface Rect { id: string; x: number; y: number; width: number; height: number; fill: Fill }

const W = 360, H = 280;
const INITIAL: Rect[] = [
  { id: 'a', x:  40, y:  60, width: 90, height: 70, fill: { paint: solid('#7fb069') } },
  { id: 'b', x: 170, y:  90, width: 90, height: 70, fill: { paint: solid('#d4a574') } },
  { id: 'c', x:  90, y: 170, width: 90, height: 70, fill: { paint: solid('#7ab8d4') } },
];

function ToolReflectionDemoInner() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  const tools = useScopedTools();

  const toolList = useMemo(() => (tools ? Object.values(tools.registry) : []), [tools]);
  const registry: RegistryEntry[] = useMemo(() => buildRouteRegistry(toolList), [toolList]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(toolList), [toolList]);

  return (
    <div className={styles.demo}>
      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Route registry ({registry.length})</h3>
          <RegistryTable rows={registry} />
        </div>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Conflicts ({conflicts.length})</h3>
          <ConflictsReport conflicts={conflicts} />
        </div>
        <div className={`${styles.panel} ${styles.canvasPanel}`}>
          <h3 className={styles.panelTitle}>Canvas</h3>
          <DemoStage width={W} height={H}>
            <SceneCanvas
              features={[pickPreset, movePreset]}
              defaultTools={['hand']}
              className="ckd-canvas"
              scene={scene}
              selection={selection}
            />
          </DemoStage>
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
          <th>action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const modKey = canonicalModifiers(r.modifiers);
          return (
          <tr key={`${r.ownerId}.${r.phase}.${r.gesture}.${r.target}.${modKey}.${i}`}>
            <td>{r.ownerId}</td>
            <td>{r.phase}</td>
            <td>{r.gesture}</td>
            <td>{r.target}</td>
            <td>{modKey || 'default'}</td>
            <td>{r.actionId}</td>
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
          claimed by {c.ownerIds.join(', ')}
        </li>
        );
      })}
    </ul>
  );
}
