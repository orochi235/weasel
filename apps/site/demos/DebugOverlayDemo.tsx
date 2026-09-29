import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_HANDLE_SIZE,
  rasterToPng,
  renderDebugSnapshot,
  SceneCanvas,
  useScene,
  warmRender,
} from '@weasel-js/core';
import { gridSnapStrategy } from '@weasel-js/guides';
import type {
  DebugConfig,
  DebugFeature,
  SceneCanvasApi,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';

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
  { key: 'fps',      label: 'fps',      help: 'Frame panel (top-left): repaint rate and interval, then the last paint\'s CPU time and GL draw calls, in total and per render layer.' },
  { key: 'viewport', label: 'viewport', help: 'The last pan or zoom: the viewport it started from, outlined in the current view, and the world point it held fixed. Wheel to pan, Cmd/Ctrl+wheel to zoom, hold Space and drag to pan.' },
];

const NONE: Record<DebugFeature, boolean> = {
  bounds: false, origins: false, hitboxes: false, handles: false,
  snap: false, layers: false, ids: false, fps: false, viewport: false,
};

const drawBox = (_node: unknown, p: Box): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
  fill: { color: p.color },
}];

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
    ...NONE, bounds: true, origins: true,
  });
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  // One object URL at a time: revoke the last when a new one replaces it or the demo unmounts.
  useEffect(() => () => { if (snapshotUrl) URL.revokeObjectURL(snapshotUrl); }, [snapshotUrl]);

  const toggle = (k: DebugFeature) =>
    setEnabled((e) => ({ ...e, [k]: !e[k] }));
  const allOn = () =>
    setEnabled(Object.fromEntries(Object.keys(NONE).map((k) => [k, true])) as Record<DebugFeature, boolean>);
  const allOff = () => setEnabled(NONE);

  const debug: DebugConfig | false = Object.values(enabled).some(Boolean) ? enabled : false;

  const snapshot = async () => {
    const api = canvasRef.current;
    const sink = api?.getDebug();
    if (!api || !sink || !debug) return;
    await warmRender().catch(() => {});
    const image = renderDebugSnapshot({
      scene,
      drawOne: drawBox,
      view: api.getView(),
      size: { width: W, height: H },
      pixelRatio: window.devicePixelRatio || 1,
      background: '#6a6a6a', // .ckd-canvas's CSS background, which the GL canvas composites over
      debug: sink.snapshot(),
      config: debug,
    });
    setSnapshotUrl(URL.createObjectURL(await rasterToPng(image)));
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
        <button style={btn} onClick={snapshot} disabled={!debug}>snapshot</button>
      </div>
      <SceneCanvas features={['view', 'pick', 'move', 'transform']}
        ref={canvasRef}
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
          scene: { drawOne: drawBox },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
      <div style={{ fontSize: 12, color: '#a89878', maxWidth: W }}>
        Click a box to select; drag the body to move (snaps to a 20px grid); drag a
        corner to resize; wheel to pan and Cmd/Ctrl+wheel to zoom. Toggle features
        above to layer in the kit's view of the scene. Hover any chip for a one-line
        description of what it shows. Snapshot rasterizes the scene and the overlay
        into one PNG, below.
      </div>
      {snapshotUrl && (
        <a href={snapshotUrl} download="weasel-debug-snapshot.png">
          <img src={snapshotUrl} width={W} height={H} alt="Debug snapshot of the canvas above" />
        </a>
      )}
    </div>
  );
}
