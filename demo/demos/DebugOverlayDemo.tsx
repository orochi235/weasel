import { useRef, useState } from 'react';
import {
  Canvas,
  gridSnapStrategy,
} from '@orochi235/weasel';
import type {
  MoveAdapter,
  ResizeAdapter,
  AreaSelectAdapter,
  DebugConfig,
  DebugFeature,
} from '@orochi235/weasel';

interface Box { id: string; x: number; y: number; width: number; height: number; color: string }
type Pose = { x: number; y: number; width: number; height: number };

const W = 520, H = 320, HANDLE = 8;

const INITIAL: Box[] = [
  { id: 'a', x:  60, y:  60, width: 80, height: 60, color: '#d4c4a8' },
  { id: 'b', x: 220, y: 100, width: 100, height: 80, color: '#a8c4d4' },
  { id: 'c', x: 380, y:  60, width: 80, height: 60, color: '#c4d4a8' },
];

const FEATURES: { key: DebugFeature; label: string; help: string }[] = [
  { key: 'bounds',   label: 'bounds',   help: 'AABB the kit derives from each object\'s pose (drives selection chrome, area-select, snap math).' },
  { key: 'origins',  label: 'origins',  help: 'Pose-origin point — top-left for rects, configurable for other pose shapes.' },
  { key: 'hitboxes', label: 'hitboxes', help: 'Every shape the pointer hit-test considers (body rects, corner handles, rotation handle).' },
  { key: 'handles',  label: 'handles',  help: 'Resize / rotate handle positions exactly where the gesture-side computes them.' },
  { key: 'snap',     label: 'snap',     help: 'Snap candidates considered during the most recent gesture — green ring = accepted, dim ring = considered.' },
  { key: 'layers',   label: 'layers',   help: 'Layer-id + space + draw-order labels in the corner. Use to debug layer ordering.' },
];

const btn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  background: '#2a2018', color: '#d4c4a8',
  border: '1px solid #4a3c2e', borderRadius: 3,
};

const chip = (active: boolean): React.CSSProperties => ({
  ...btn,
  background: active ? '#4a3c2e' : '#2a2018',
  fontWeight: active ? 600 : 400,
});

export function DebugOverlayDemo() {
  const [boxes, setBoxes] = useState<Box[]>(INITIAL);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;

  const [enabled, setEnabled] = useState<Record<DebugFeature, boolean>>({
    bounds: true, origins: true, hitboxes: false,
    handles: false, snap: false, layers: false,
  });

  const toggle = (k: DebugFeature) =>
    setEnabled((e) => ({ ...e, [k]: !e[k] }));
  const allOn = () =>
    setEnabled({ bounds: true, origins: true, hitboxes: true, handles: true, snap: true, layers: true });
  const allOff = () =>
    setEnabled({ bounds: false, origins: false, hitboxes: false, handles: false, snap: false, layers: false });

  const debug: DebugConfig | false = (
    enabled.bounds || enabled.origins || enabled.hitboxes ||
    enabled.handles || enabled.snap || enabled.layers
  ) ? enabled : false;

  const adapter: MoveAdapter<Box, Pose> & ResizeAdapter<Box, Pose> & AreaSelectAdapter = {
    getObject: (id) => boxesRef.current.find((b) => b.id === id),
    getObjects: () => boxesRef.current,
    getPose: (id) => {
      const b = boxesRef.current.find((x) => x.id === id);
      if (!b) throw new Error(`no box: ${id}`);
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    },
    getParent: () => null,
    setPose: (id, p) => {
      setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));
    },
    setParent: () => {},
    hitTestArea: (r) =>
      boxesRef.current
        .filter((o) => o.x < r.x + r.width && o.x + o.width > r.x && o.y < r.y + r.height && o.y + o.height > r.y)
        .map((o) => o.id),
    getSelection: () => [],
    setSelection: () => {},
    applyOps: () => {},
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {FEATURES.map((f) => (
          <button
            key={f.key}
            style={chip(enabled[f.key])}
            title={f.help}
            onClick={() => toggle(f.key)}
          >
            {enabled[f.key] ? '☑' : '☐'} {f.label}
          </button>
        ))}
        <button style={btn} onClick={allOn}>all on</button>
        <button style={btn} onClick={allOff}>all off</button>
      </div>
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        handleHitRadius={HANDLE}
        snap={gridSnapStrategy<Pose>(20)}
        debug={debug}
        layers={{
          scene: {
            drawOne: (cx, b: Box, p: Pose) => {
              cx.fillStyle = b.color;
              cx.fillRect(p.x, p.y, p.width, p.height);
            },
          },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
      <div style={{ fontSize: 12, color: '#a89878', maxWidth: W }}>
        Click a box to select; drag the body to move (snaps to a 20px grid); drag a
        corner to resize. Toggle features above to layer in the kit's view of the
        scene. Hover any chip for a one-line description of what it shows.
      </div>
    </div>
  );
}

export const DEBUG_OVERLAY_DEMO_SOURCE = `// Pass a DebugConfig (or true / 'all') to <Canvas debug={...}> and the
// kit appends a screen-space overlay layer that paints what the
// interaction system "sees": bounds, pose origins, hitboxes, handle
// positions, snap candidates, and layer metadata.
//
// Off in prod by default. The overlay layer + sink are tree-shaken when
// debug is false / undefined, so there's no runtime cost when disabled.

const debug: DebugConfig = {
  bounds: true,
  origins: true,
  hitboxes: true,
  handles: true,
  snap: true,
  layers: true,
};

<Canvas
  adapter={adapter}
  debug={debug}              // <-- this is the whole opt-in
  snap={gridSnapStrategy(20)}
  layers={{ scene: { drawOne }, selectionOverlay: { handles: true } }}
/>;

// You can also leave \`debug\` undefined and append \`?debug=all\` (or
// \`?debug=bounds,handles\`) to the URL — Canvas reads the flag from
// location.search as a fallback.`;
