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
import type { DrawCommand } from '@orochi235/weasel-gl';
import type { View } from '../../src/core/viewport/view';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string; pin: 'screen' | 'world' }

const INITIAL_ITEMS: Rect[] = [
  // Left rect: stroke pinned to 2 screen px (compensates for view.scale).
  { id: 'screen-pin', x:  60, y:  80, width: 120, height: 90, color: '#7fb069', pin: 'screen' },
  // Right rect: stroke pinned to 2 world px (grows with zoom).
  { id: 'world-pin',  x: 220, y:  80, width: 120, height: 90, color: '#a48bd4', pin: 'world' },
];
export function ZoomDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL_ITEMS);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });

  const selectAdapter = {
    getObject: (id: string) => items.find((r) => r.id === id),
    getPose: (id: string) => items.find((r) => r.id === id) ?? null,
    getObjects: () => items,
    setPose: (id: string, pose: unknown) =>
      setItems((cur) => cur.map((r) => (r.id === id ? { ...r, ...(pose as Rect) } : r))),
    getSelection: () => [] as string[],
    setSelection: () => {},
  };
  const select = useSelectTool(selectAdapter, {
    pickEvery: (wx, wy) =>
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
    ambient: [wheelZoom, wheelPan, keyZoom],
  });
  useKeybindings(tools);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace' }}>tool: {tools.hotkeyEngaged ?? tools.active}</span>
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
            drawOne: (_obj, pose, v): DrawCommand[] => {
              const r = pose as Rect;
              const lineWidth = r.pin === 'screen' ? 2 / v.scale : 2;
              return [{
                kind: 'path',
                path: { kind: 'rect', x: r.x, y: r.y, width: r.width, height: r.height },
                fill: { color: r.color },
                stroke: { paint: { color: '#d4c4a8' }, width: lineWidth },
              }];
            },
          },
        }}
      />
    </div>
  );
}
