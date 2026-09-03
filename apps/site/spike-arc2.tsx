/**
 * Arc 2 spike — one GL surface, N interactive panes.
 *
 * Two `<SceneCanvas>`es paint into ONE caller-owned canvas at two rects, each
 * taking pointer input from its own transparent box over its rect, and each on
 * its own camera. Panes B's camera is deliberately scaled and panned so any
 * shared-rect or shared-camera confusion shows up as a wrong number rather
 * than as a plausible one.
 *
 * The question: does a drag land at the right world coordinates, and does any
 * preview or chrome layer measure the canvas it paints into?
 */
import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneCanvas, WeaselProvider, sceneFromJSON, useSelection } from '@weasel-js/core';
import type { FillStyle, SerializedScene, View } from '@weasel-js/core';

interface NodeData { fill: FillStyle }
interface Pose { x: number; y: number; width: number; height: number }
type SpikeScene = ReturnType<typeof sceneFromJSON<NodeData, string, Pose>>;

const SURFACE_W = 820;
const SURFACE_H = 400;
const PANE_W = 380;
const PANE_H = 360;

/** Pane rects on the shared surface, in its CSS pixels. Deliberately not at
 *  the origin: a rect ignored anywhere shows up as a 20px offset. */
const PANES = [
  { id: 'A', x: 20, y: 20, view: { x: 0, y: 0, scale: { x: 1, y: 1 } } as View },
  // Panned AND scaled: a pane painting through its neighbour's camera lands
  // somewhere obviously wrong instead of somewhere close.
  { id: 'B', x: 420, y: 20, view: { x: -40, y: -30, scale: { x: 2, y: 2 } } as View },
] as const;

const sceneJson = (fill: string): SerializedScene<NodeData, string, Pose> => ({
  version: 1,
  systemLayers: [{ id: 'default' }],
  nodes: [
    { id: 'box', kind: 'leaf', layer: 'default',
      pose: { x: 40, y: 40, width: 100, height: 80 }, data: { fill: { color: fill } } },
    { id: 'mark', kind: 'leaf', layer: 'default',
      pose: { x: 180, y: 150, width: 60, height: 60 }, data: { fill: { color: '#c0392b' } } },
  ],
} as unknown as SerializedScene<NodeData, string, Pose>);

declare global {
  interface Window {
    __spike?: {
      poseOf(pane: string, id: string): Pose | null;
      viewOf(pane: string): View | null;
      /** The pane's own client→world, for asserting what a drag SHOULD do. */
      worldAt(pane: string, clientX: number, clientY: number): { x: number; y: number } | null;
      paneRect(pane: string): DOMRect | null;
      ready: boolean;
    };
  }
}

const scenes = new Map<string, SpikeScene>();
const inputs = new Map<string, HTMLDivElement>();
const views = new Map<string, View>();

function Pane({
  id, x, y, view, surface, fill,
}: {
  id: string; x: number; y: number; view: View;
  surface: HTMLCanvasElement | null; fill: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  const [scene] = useState(() => sceneFromJSON(sceneJson(fill), {}));
  const selection = useSelection();

  useLayoutEffect(() => {
    scenes.set(id, scene as SpikeScene);
    views.set(id, view);
    if (boxRef.current) {
      inputs.set(id, boxRef.current);
      setInput(boxRef.current);
    }
  }, [id, scene, view]);

  return (
    <>
      <div
        ref={boxRef}
        tabIndex={0}
        data-pane={id}
        className="spike-pane"
        style={{ left: x, top: y, width: PANE_W, height: PANE_H }}
      />
      {surface && input && (
        // One scope per pane. Sharing an `<ActionsProvider>` lets only the
        // newest canvas under it respond to input — the kit warns about this,
        // and it has nothing to do with which element the pointer is on.
        <WeaselProvider isolate>
          <SceneCanvas
            width={PANE_W}
            height={PANE_H}
            scene={scene}
            selection={selection}
            view={view}
            paintInto={{ canvas: surface, x, y }}
            inputElement={input}
            backgroundFill={{ color: id === 'A' ? '#e8f0fb' : '#fdf3d8' }}
            defaultTools={['select']}
          />
        </WeaselProvider>
      )}
    </>
  );
}

function Spike() {
  const surfaceRef = useRef<HTMLCanvasElement | null>(null);
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null);

  // The shared surface is the caller's to size — the renderers painting into
  // it are handed `gl` only, never the element.
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

  useLayoutEffect(() => {
    window.__spike = {
      poseOf: (pane, nodeId) => {
        const s = scenes.get(pane);
        if (!s) return null;
        const json = s.toJSON() as unknown as { nodes: { id: string; pose: Pose }[] };
        return json.nodes.find((n) => n.id === nodeId)?.pose ?? null;
      },
      viewOf: (pane) => views.get(pane) ?? null,
      worldAt: (pane, clientX, clientY) => {
        const el = inputs.get(pane);
        const v = views.get(pane);
        if (!el || !v) return null;
        const r = el.getBoundingClientRect();
        return {
          x: (clientX - r.left) / v.scale.x + v.x,
          y: (clientY - r.top) / v.scale.y + v.y,
        };
      },
      paneRect: (pane) => inputs.get(pane)?.getBoundingClientRect() ?? null,
      ready: true,
    };
  }, [surface]);

  return (
    <div className="spike-root">
      <h1>arc 2 spike — one surface, two interactive panes</h1>
      <div className="spike-surface" style={{ width: SURFACE_W, height: SURFACE_H }}>
        <canvas ref={surfaceRef} className="spike-canvas" />
        {PANES.map((p) => (
          <Pane
            key={p.id}
            id={p.id}
            x={p.x}
            y={p.y}
            view={p.view}
            surface={surface}
            fill={p.id === 'A' ? '#2d7d46' : '#2d5f9a'}
          />
        ))}
      </div>
      <p className="spike-note">
        Pane A: camera 1×. Pane B: camera 2×, panned (−40, −30). Both painted into
        the single canvas behind them; each takes input from its own box.
      </p>
    </div>
  );
}

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; font: 13px/1.5 system-ui, sans-serif; background: #fafafa; color: #222; }
  .spike-root { padding: 16px; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
  .spike-surface { position: relative; }
  .spike-canvas { position: absolute; inset: 0; background: #d8d8d8; }
  .spike-pane { position: absolute; outline: none; }
  .spike-pane:focus-visible { box-shadow: 0 0 0 2px #4a90d9; }
  .spike-note { max-width: 820px; color: #555; }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WeaselProvider><Spike /></WeaselProvider>
  </StrictMode>,
);
