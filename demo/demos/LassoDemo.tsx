import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  sceneToAdapter,
  selectFromLasso,
  selectFromMarquee,
  useKeybindings,
  useLassoTool,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { CanvasExtensionApi, LassoHitMode } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

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

  // pickEvery / boundsOf are auto-derived from the adapter (rect-pose AABB
  // scan) — no boilerplate needed for the common case. Override either if
  // your TPose isn't `{x,y,width,height}`-shaped.
  const select = useSelectTool(adapter, {
    getSelection: () => selection.current,
    areaSelect: { behaviors: [selectFromMarquee()] },
  });

  // toolsRef lets the lasso's onGestureEnd flip back to 'select' after
  // commit without rebuilding the lasso Tool record (which would lose
  // gesture state mid-flight). Forward declaration via ref since `tools`
  // isn't constructed until below.
  const toolsRef = useRef<ReturnType<typeof useTools> | null>(null);

  // Lasso tool reads `mode` through a behavior that captures the latest value
  // each render — recreating the behavior with a fresh closure is the simplest
  // way to make the on-screen mode toggle live. After a lasso gesture commits,
  // flip the active tool back to 'select' so corner handles on the multi-union
  // chrome become draggable (Photoshop / Illustrator convention).
  const lasso = useLassoTool(adapter, {
    behaviors: [selectFromLasso({ mode })],
    onGestureEnd: (committed) => {
      if (committed) toolsRef.current?.setActive('select');
    },
  });

  const tools = useTools({
    active: 'select',
    registry: { select, lasso },
  });
  toolsRef.current = tools;
  // Wire V (select) and L (lasso) so the consumer can swap active tools by
  // keystroke. SceneCanvas disables its internal keybindings whenever a
  // `tools=` prop is supplied; the consumer owns the wiring.
  useKeybindings(tools);

  const canvasRef = useRef<CanvasExtensionApi | null>(null);
  useEffect(() => { canvasRef.current?.element?.focus(); }, []);

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
          Press <kbd>L</kbd> for lasso · Active: <code>{tools.active}</code>
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
