import { useState } from 'react';
import {
  DEFAULT_HANDLE_SIZE,
  gridSnapStrategy,
  SceneCanvas,
  useScene,
} from '@weasel-js/core';
import type {
  DebugConfig,
  DebugFeature,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';

interface Box { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 520, H = 320, HANDLE = DEFAULT_HANDLE_SIZE;

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
  { key: 'ids',      label: 'ids',      help: 'Per-node id label rendered at the top-left of each tracked bounds — useful for tying scene ids to what you see on the canvas.' },
  { key: 'fps',      label: 'fps',      help: 'Rolling frames-per-second counter (top-left). Tracks the rate of the debug overlay\'s own draw callback, which matches the canvas\'s effective repaint rate.' },
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
  const scene = useScene<Box>({ items: INITIAL });

  const [enabled, setEnabled] = useState<Record<DebugFeature, boolean>>({
    bounds: true, origins: true, hitboxes: false,
    handles: false, snap: false, layers: false, ids: false, fps: false,
  });

  const toggle = (k: DebugFeature) =>
    setEnabled((e) => ({ ...e, [k]: !e[k] }));
  const allOn = () =>
    setEnabled({ bounds: true, origins: true, hitboxes: true, handles: true, snap: true, layers: true, ids: true, fps: true });
  const allOff = () =>
    setEnabled({ bounds: false, origins: false, hitboxes: false, handles: false, snap: false, layers: false, ids: false, fps: false });

  const debug: DebugConfig | false = (
    enabled.bounds || enabled.origins || enabled.hitboxes ||
    enabled.handles || enabled.snap || enabled.layers || enabled.ids || enabled.fps
  ) ? enabled : false;

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
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectTool={{
          handleHitRadius: HANDLE,
          snap: gridSnapStrategy<Box>(20),
        }}
        debug={debug}
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
      <div style={{ fontSize: 12, color: '#a89878', maxWidth: W }}>
        Click a box to select; drag the body to move (snaps to a 20px grid); drag a
        corner to resize. Toggle features above to layer in the kit's view of the
        scene. Hover any chip for a one-line description of what it shows.
      </div>
    </div>
  );
}
