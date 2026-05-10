import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  selectFromLasso,
  selectFromMarquee,
  useLassoTool,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { LassoHitMode } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320, HANDLE = 8;

// A scattering of small shapes — enough variety that each hit mode produces
// visibly different selection outcomes for the same lasso path.
const PALETTE = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a', '#e8c547', '#5fad9a'];
const INITIAL: Rect[] = (() => {
  const out: Rect[] = [];
  let i = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 20 + col * 55 + (row % 2) * 18;
      const y = 20 + row * 55;
      out.push({
        id: `r${i}`,
        x, y,
        width: 30 + ((i * 7) % 25),
        height: 28 + ((i * 11) % 22),
        color: PALETTE[i % PALETTE.length],
      });
      i++;
    }
  }
  return out;
})();

const MODE_LABELS: Record<LassoHitMode, string> = {
  centers: 'centers (snappy)',
  intersect: 'intersect (Figma)',
  enclosed: 'enclosed (strict)',
};

export function LassoDemo() {
  const scene = useScene({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const [mode, setMode] = useState<LassoHitMode>('intersect');

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
          && worldY >= p.y && worldY <= p.y + p.height) {
        hits.push(id);
      }
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
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
    areaSelect: { behaviors: [selectFromMarquee()] },
  });

  // Lasso tool reads `mode` through a behavior that captures the latest value
  // each render — recreating the behavior with a fresh closure is the simplest
  // way to make the on-screen mode toggle live.
  const lasso = useLassoTool(adapter, {
    behaviors: [selectFromLasso({ mode })],
  });

  const tools = useTools({
    active: 'select',
    registry: { select, lasso },
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { canvasRef.current?.focus(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
        <span>Hit mode:</span>
        {(Object.keys(MODE_LABELS) as LassoHitMode[]).map((m) => (
          <label key={m} style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="lasso-mode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {' '}{MODE_LABELS[m]}
          </label>
        ))}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          Active: <code>{tools.active}</code>
        </span>
      </div>
      <SceneCanvas
        ref={canvasRef}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
        selectTool={{ handleHitRadius: HANDLE }}
        layers={{
          scene: {
            drawOne: (_node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: p.color },
            }],
          },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
    </div>
  );
}
