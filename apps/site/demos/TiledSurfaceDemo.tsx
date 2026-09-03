import { useLayoutEffect, useRef, useState } from 'react';
import {
  PathBuilder, SceneCanvas, WeaselProvider, sceneFromJSON, useSelection,
} from '@weasel-js/core';
import type { FillStyle, Path, SerializedScene, View } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';

interface NodeData { fill: FillStyle; ring?: boolean }
interface Pose { x: number; y: number; width: number; height: number }

const SURFACE_W = 820;
const SURFACE_H = 400;
const PANE_W = 380;
const PANE_H = 360;

const PANES = [
  { id: 'A', x: 20, y: 20, view: { x: 0, y: 0, scale: { x: 1, y: 1 } } as View,
    fill: '#2d7d46', bg: '#e8f0fb' },
  { id: 'B', x: 420, y: 20, view: { x: -40, y: -30, scale: { x: 2, y: 2 } } as View,
    fill: '#2d5f9a', bg: '#fdf3d8' },
] as const;

/** A rect with a rect-shaped hole, filled even-odd — so it goes through
 *  `drawPathFillStencil`, which uses stencil bit 0. The hole is what the guard
 *  test probes: it is only a hole while this pane's stencil state is its own. */
function ring(pose: Pose): Path {
  const b = new PathBuilder().setFillRule('evenodd');
  const { x, y, width: w, height: h } = pose;
  b.moveTo(x, y); b.lineTo(x + w, y); b.lineTo(x + w, y + h); b.lineTo(x, y + h); b.close();
  const i = Math.min(w, h) / 4;
  b.moveTo(x + i, y + i); b.lineTo(x + w - i, y + i);
  b.lineTo(x + w - i, y + h - i); b.lineTo(x + i, y + h - i); b.close();
  return b.build();
}

const paneScene = (fill: string): SerializedScene<NodeData, string, Pose> => ({
  version: 1,
  systemLayers: [{ id: 'default' }],
  nodes: [
    { id: 'box', kind: 'leaf', layer: 'default',
      pose: { x: 40, y: 40, width: 100, height: 80 }, data: { fill: { color: fill } } },
    { id: 'mark', kind: 'leaf', layer: 'default',
      pose: { x: 180, y: 150, width: 60, height: 60 }, data: { fill: { color: '#c0392b' } } },
    { id: 'ring', kind: 'leaf', layer: 'default',
      pose: { x: 40, y: 180, width: 100, height: 100 },
      data: { fill: { color: '#6b4c9a' }, ring: true } },
  ],
} as unknown as SerializedScene<NodeData, string, Pose>);

function Pane({
  id, x, y, view, fill, bg, surface,
}: {
  id: string; x: number; y: number; view: View; fill: string; bg: string;
  surface: HTMLCanvasElement | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  const [scene] = useState(() => sceneFromJSON(paneScene(fill), {}));
  const selection = useSelection();

  useLayoutEffect(() => { setInput(boxRef.current); }, []);

  return (
    <>
      <div
        ref={boxRef}
        tabIndex={0}
        data-pane={id}
        className="ckd-tile-pane"
        style={{ left: x, top: y, width: PANE_W, height: PANE_H }}
      />
      {surface && input && (
        // One scope per pane: a shared <ActionsProvider> lets only the newest
        // canvas under it respond to input, and the rest go silently dead.
        <WeaselProvider isolate>
          <SceneCanvas
            width={PANE_W}
            height={PANE_H}
            scene={scene}
            selection={selection}
            view={view}
            paintInto={{ canvas: surface, x, y }}
            inputElement={input}
            backgroundFill={{ color: bg }}
            defaultTools={['select']}
            layers={{
              scene: {
                // Poses are plain rects here, so both branches build their own
                // path rather than taking the descriptor's — `ring` needs an
                // even-odd compound path that no pose shape can express.
                drawOne: (node): DrawCommand[] => {
                  const pose = node.pose as Pose;
                  return [{
                    kind: 'path',
                    path: node.data.ring
                      ? ring(pose)
                      : { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
                    fill: node.data.fill,
                  }];
                },
              },
            }}
          />
        </WeaselProvider>
      )}
    </>
  );
}

export function TiledSurfaceDemo() {
  const surfaceRef = useRef<HTMLCanvasElement | null>(null);
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null);

  // The shared buffer is the host's to size. Each pane's renderer is handed
  // `gl` only — given the element it would resize it to its own pane.
  useLayoutEffect(() => {
    const c = surfaceRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(SURFACE_W * dpr);
    c.height = Math.round(SURFACE_H * dpr);
    c.style.width = `${SURFACE_W}px`;
    c.style.height = `${SURFACE_H}px`;
    setSurface(c);
  }, []);

  return (
    <div className="ckd-tile-surface" style={{ width: SURFACE_W, height: SURFACE_H }}>
      <canvas ref={surfaceRef} data-testid="tiled-surface" className="ckd-tile-canvas" />
      {PANES.map((p) => (
        <Pane key={p.id} {...p} surface={surface} />
      ))}
    </div>
  );
}
