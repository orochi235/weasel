import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_HANDLE_SIZE,
  rasterToPng,
  debugSnapshotArgs,
  renderDebugSnapshot,
  SceneCanvas,
  useScene,
  warmRender,
} from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type {
  DebugConfig,
  DebugFeature,
  Dims,
  SceneCanvasApi,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { DemoStage } from './DemoStage';

interface Box { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 520, H = 320, HANDLE = DEFAULT_HANDLE_SIZE;
const SNAP = { sources: [gridSnapSource({ spacing: 20 })] };

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
  fill: { paint: { color: p.color } },
}];

export function DebugOverlayDemo() {
  const scene = useScene<Box>({ items: INITIAL });

  const [enabled, setEnabled] = useState<Record<DebugFeature, boolean>>({
    ...NONE, bounds: true, origins: true,
  });
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [size, setSize] = useState<Dims>({ width: W, height: H });
  const [shot, setShot] = useState<{ url: string; size: Dims } | null>(null);
  // One object URL at a time: revoke the last when a new one replaces it or the demo unmounts.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

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
    const args = {
      scene,
      drawOne: drawBox,
      view: api.getView(),
      size,
      pixelRatio: window.devicePixelRatio || 1,
      background: '#6a6a6a', // .ckd-canvas's CSS background, which the GL canvas composites over
      debug: sink.snapshot(),
      config: debug,
    };
    await warmRender({ render: debugSnapshotArgs(args) }).catch(() => {});
    const image = renderDebugSnapshot(args);
    setShot({ url: URL.createObjectURL(await rasterToPng(image)), size });
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        {FEATURES.map((f) => (
          <button
            key={f.key}
            className="ckd-btn"
            aria-pressed={enabled[f.key]}
            title={f.help}
            onClick={() => toggle(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button className="ckd-btn" onClick={allOn}>all on</button>
        <button className="ckd-btn" onClick={allOff}>all off</button>
        <button className="ckd-btn" onClick={snapshot} disabled={!debug}>snapshot</button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={['view', 'pick', 'move', 'transform']}
          ref={canvasRef}
          className="ckd-canvas"
          onResize={setSize}
          scene={scene}
          selectTool={{ handleHitRadius: HANDLE }}
          snap={SNAP}
          debug={debug}
          layers={{
            scene: { drawOne: drawBox },
            selectionOverlay: { handles: { size: HANDLE } },
          }}
        />
      </DemoStage>
      <p className="ckd-hint ckd-prose">
        Click a box to select; drag the body to move or a corner to resize, both
        snapping to a 20px grid; wheel to pan and Cmd/Ctrl+wheel to zoom. Toggle features
        above to layer in the kit's view of the scene. Hover any chip for a one-line
        description of what it shows. Snapshot rasterizes the scene and the overlay
        into one PNG, below.
      </p>
      {shot && (
        <a href={shot.url} download="weasel-debug-snapshot.png">
          <img src={shot.url} width={shot.size.width} height={shot.size.height} alt="Debug snapshot of the canvas above" />
        </a>
      )}
    </div>
  );
}
