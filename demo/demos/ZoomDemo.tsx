import { useState } from 'react';
import {
  Canvas,
  useTools,
  useKeybindings,
  useHandTool,
  useSelectTool,
  useWheelZoomTool,
  useWheelPanTool,
  useKeyboardZoomTool,
} from '../../src';
import type { View } from '../../src/features/viewport/view';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string; pin: 'screen' | 'world' }

const INITIAL_ITEMS: Rect[] = [
  // Left rect: stroke pinned to 2 screen px (compensates for view.scale).
  { id: 'screen-pin', x:  60, y:  80, width: 120, height: 90, color: '#7fb069', pin: 'screen' },
  // Right rect: stroke pinned to 2 world px (grows with zoom).
  { id: 'world-pin',  x: 220, y:  80, width: 120, height: 90, color: '#a48bd4', pin: 'world' },
];

export const ZOOM_DEMO_SOURCE = `const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
const wheelZoom = useWheelZoomTool();
const wheelPan  = useWheelPanTool();
const keyZoom   = useKeyboardZoomTool();
const hand      = useHandTool();
const tools = useTools({
  active: 'select',
  registry: { select, hand },
  alwaysOn: [wheelZoom, wheelPan, keyZoom],
});
useKeybindings(tools);

<Canvas
  view={view}
  onViewChange={setView}
  tools={tools}
  layers={{
    scene: {
      drawOne: (ctx, _obj, pose, view) => {
        const r = pose as Rect;
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, r.width, r.height);
        // Screen-pinned: divide by view.scale so the stroke stays 2 CSS px.
        ctx.lineWidth = r.pin === 'screen' ? 2 / view.scale : 2;
        ctx.strokeStyle = '#1a130d';
        ctx.strokeRect(r.x, r.y, r.width, r.height);
      },
    },
  }}
/>`;

export function ZoomDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL_ITEMS);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });

  const selectAdapter = {
    getObject: (id: string) => items.find((r) => r.id === id),
    getPose: (id: string) => items.find((r) => r.id === id) ?? null,
    getObjects: () => items,
    getParent: () => null,
    setParent: () => {},
    setPose: (id: string, pose: unknown) =>
      setItems((cur) => cur.map((r) => (r.id === id ? { ...r, ...(pose as Rect) } : r))),
    getSelection: () => [] as string[],
    setSelection: () => {},
    hitTestArea: () => [] as string[],
    applyOps: () => {},
  };
  const select = useSelectTool(selectAdapter, {
    hitBody: (wx, wy) =>
      items
        .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
        .map((r) => r.id),
    boundsOf: (id) => {
      const r = items.find((o) => o.id === id);
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    },
  });
  const hand = useHandTool();
  const wheelZoom = useWheelZoomTool();
  const wheelPan = useWheelPanTool();
  const keyZoom = useKeyboardZoomTool();

  const tools = useTools({
    active: 'select',
    registry: { select, hand },
    alwaysOn: [wheelZoom, wheelPan, keyZoom],
  });
  useKeybindings(tools);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace' }}>tool: {tools.modifierEngaged ?? tools.active}</span>
        <span style={{ fontFamily: 'monospace' }}>
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) · scale: {view.scale.toFixed(2)}
        </span>
        <button onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Reset view</button>
        <span style={{ color: '#888' }}>
          ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · H drag · space drag
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#d4c4a8' }}>
        <span>Left (green): stroke = 2 / view.scale (screen-pinned)</span>
        <span>Right (purple): stroke = 2 (world-scaled)</span>
      </div>
      <Canvas
        width={400}
        height={300}
        items={items}
        setItems={setItems}
        view={view}
        onViewChange={setView}
        tools={tools}
        background="#1a130d"
        layers={{
          scene: {
            drawOne: (ctx, _obj, pose, v) => {
              const r = pose as Rect;
              ctx.fillStyle = r.color;
              ctx.fillRect(r.x, r.y, r.width, r.height);
              ctx.lineWidth = r.pin === 'screen' ? 2 / v.scale : 2;
              ctx.strokeStyle = '#1a130d';
              ctx.strokeRect(r.x, r.y, r.width, r.height);
            },
          },
        }}
      />
    </div>
  );
}
