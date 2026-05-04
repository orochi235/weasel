import { useState } from 'react';
import { Canvas, useTools, useKeybindings, useHandTool, useSelectTool } from '../../src';
import type { View } from '../../src/features/viewport/view';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const INITIAL_ITEMS: Rect[] = [
  { id: 'a', x:  50, y:  50, width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 300, y: 200, width: 80, height: 60, color: '#a48bd4' },
  { id: 'c', x: 600, y: 400, width: 80, height: 60, color: '#f0e0a8' },
];

export const PAN_DEMO_SOURCE = `const [view, setView] = useState<View>({ x: 0, y: 0 });
const hand = useHandTool();
const tools = useTools({ active: 'select', registry: { select, hand } });
useKeybindings(tools);

<Canvas
  view={view}
  onViewChange={setView}
  tools={tools}
  ...
/>`;

export function PanDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL_ITEMS);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });

  // We only need select + hand for this demo.
  const selectAdapter = {
    getPose: (id: string) => items.find((r) => r.id === id) ?? null,
    getObjects: () => items,
    setPose: (id: string, pose: unknown) => setItems((cur) => cur.map((r) => r.id === id ? { ...r, ...(pose as Rect) } : r)),
    getSelection: () => [] as string[],
    setSelection: () => {},
    hitTestArea: () => [] as string[],
    applyOps: () => {},
  };
  const select = useSelectTool(selectAdapter, {
    hitBody: (wx, wy) => items.filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height).map((r) => r.id),
    boundsOf: (id) => { const r = items.find((o) => o.id === id); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; },
  });
  const hand = useHandTool();

  const tools = useTools({
    active: 'select',
    registry: { select, hand },
  });
  useKeybindings(tools);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>tool: {tools.modifierEngaged ?? tools.active}</span>
        <span style={{ fontFamily: 'monospace' }}>view: ({view.x.toFixed(0)}, {view.y.toFixed(0)})</span>
        <button onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Reset view</button>
        <span style={{ color: '#888' }}>H = hand · space (hold) = momentary hand</span>
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
            drawOne: (ctx, _obj, pose) => {
              const r = pose as Rect;
              ctx.fillStyle = r.color;
              ctx.fillRect(r.x, r.y, r.width, r.height);
            },
          },
        }}
      />
    </div>
  );
}
