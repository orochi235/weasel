import { useEffect, useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  useAlign,
  useDistribute,
  useFlip,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { AlignEdge, CanvasExtensionApi, DistributeAxis, DistributeMode } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320, HANDLE = 8;

// Five rects, irregular sizes and offsets — every align edge and both
// distribute axes have a visible effect from this start state.
const INITIAL: Rect[] = [
  { id: 'a', x: 30,  y: 50,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 130, y: 80,  width: 50, height: 90, color: '#d4a574' },
  { id: 'c', x: 220, y: 40,  width: 80, height: 60, color: '#a48bd4' },
  { id: 'd', x: 320, y: 100, width: 60, height: 70, color: '#7ab8d4' },
  { id: 'e', x: 400, y: 60,  width: 60, height: 50, color: '#d47a7a' },
];

export function AlignDistributeFlipDemo() {
  const scene = useScene({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  const baseAdapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

  // Adapter for the action hooks: getSelection + getPose + applyBatch.
  // applyBatch is dispatched by sceneToAdapter automatically (it provides
  // applyOps); we read getSelection from the SelectionApi.
  const actionAdapter = useMemo(
    () => ({
      getSelection: () => [...selection.current],
      getPose: (id: ReturnType<typeof asNodeId>) => {
        const n = scene.get(id);
        return (n?.pose ?? { x: 0, y: 0, width: 0, height: 0 }) as Rect;
      },
      applyOps: baseAdapter.applyOps,
    }),
    [scene, selection, baseAdapter],
  );

  const { align } = useAlign<Rect>(actionAdapter);
  const { distribute } = useDistribute<Rect>(actionAdapter);
  const { flip, flipHorizontal, flipVertical } = useFlip<Rect>(actionAdapter);

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

  const select = useSelectTool(baseAdapter, {
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  const canvasRef = useRef<CanvasExtensionApi | null>(null);
  useEffect(() => { canvasRef.current?.element?.focus(); }, []);

  // Pre-select all five so every button has an immediate visible effect.
  useEffect(() => {
    selection.set(INITIAL.map((r) => asNodeId(r.id)));
  }, [selection]);

  const ALIGN_BTNS: { edge: AlignEdge; label: string }[] = [
    { edge: 'left', label: 'Align L' },
    { edge: 'center-x', label: 'Align Cx' },
    { edge: 'right', label: 'Align R' },
    { edge: 'top', label: 'Align T' },
    { edge: 'center-y', label: 'Align Cy' },
    { edge: 'bottom', label: 'Align B' },
  ];
  const DIST_BTNS: { axis: DistributeAxis; mode: DistributeMode; label: string }[] = [
    { axis: 'x', mode: 'centers', label: 'Dist X centers' },
    { axis: 'x', mode: 'gaps', label: 'Dist X gaps' },
    { axis: 'y', mode: 'centers', label: 'Dist Y centers' },
    { axis: 'y', mode: 'gaps', label: 'Dist Y gaps' },
  ];

  const btn: React.CSSProperties = {
    padding: '4px 8px', fontSize: 11, borderRadius: 4,
    border: '1px solid #4a4030', background: '#2a2418', color: '#d8c8a8',
    cursor: 'pointer',
  };
  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}>
        {ALIGN_BTNS.map((b) => (
          <button key={b.edge} style={btn} onClick={() => align(b.edge)}>{b.label}</button>
        ))}
      </div>
      <div style={row}>
        {DIST_BTNS.map((b, i) => (
          <button key={i} style={btn} onClick={() => distribute(b.axis, b.mode)}>{b.label}</button>
        ))}
        <button style={btn} onClick={flipHorizontal}>Flip H (⇧H)</button>
        <button style={btn} onClick={flipVertical}>Flip V (⇧V)</button>
        <button style={btn} onClick={() => { flip('x'); flip('y'); }}>Flip both</button>
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
