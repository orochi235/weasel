import { useState } from 'react';
import {
  SceneCanvas, asNodeId, fillInPoseFrame, fillToBoundsFrame, useScene, viewToTransform,
  worldToScreen,
} from '@weasel-js/core';
import type { GradientFill, View } from '@weasel-js/core';
import { GradientEditor, GradientHandles } from '@weasel-js/ui';

const W = 600;
const H = 400;
const ID = asNodeId('gradient-rect');

/** The box the gradient is expressed against — the node's pose. `units:
 *  'bounds'` means the paint is stored as fractions of it, so it survives pan
 *  and zoom. The built-in `kit:shape` painter resolves it against the pose. */
const SHAPE_RECT = { x: 80, y: 60, width: W - 160, height: H - 120 };

const INITIAL: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0.1, y: 0.1 },
  to: { x: 0.9, y: 0.9 },
  stops: [
    { offset: 0, color: '#0fb5a8' },
    { offset: 0.55, color: '#c84edb' },
    { offset: 1, color: '#f4c43c' },
  ],
  units: 'bounds',
};

interface GradientRect {
  shape: 'rect';
  fill: GradientFill;
}

export function GradientsDemo() {
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  const scene = useScene<GradientRect, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'leaf',
      layer: 'default',
      pose: SHAPE_RECT,
      data: { shape: 'rect', fill: INITIAL },
      id: ID,
    }],
    // A gradient drag fires per pointermove; without a window each frame
    // would be its own undo entry.
    coalesceWindowMs: 300,
  });

  const paint = scene.get(ID)?.data.fill ?? INITIAL;
  const setPaint = (next: GradientFill) =>
    scene.update(ID, { data: { shape: 'rect', fill: next } });

  // The handles work in the resolved frame — page coordinates, where the
  // box's two axes have the same scale — so `bounds` is resolved on the way
  // in and re-normalized on the way out.
  const resolved = fillInPoseFrame(paint, SHAPE_RECT) as GradientFill;
  const t = viewToTransform(view);
  const toScreen = (p: { x: number; y: number }) => {
    const [x, y] = worldToScreen(p.x, p.y, t);
    return { x, y };
  };
  const origin = toScreen({ x: 0, y: 0 });
  const unit = toScreen({ x: 1, y: 1 });
  const toLocal = (p: { x: number; y: number }) => ({
    x: (p.x - origin.x) / (unit.x - origin.x),
    y: (p.y - origin.y) / (unit.y - origin.y),
  });
  const setResolved = (next: GradientFill) =>
    setPaint(fillToBoundsFrame(next, SHAPE_RECT) as GradientFill);

  return (
    <div className="ckd-stack">
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          view={view}
          onViewChange={setView}
          selectionMode="none"
        />
        <GradientHandles
          value={resolved}
          toScreen={toScreen}
          toLocal={toLocal}
          width={W}
          height={H}
          onInput={setResolved}
          onChange={setResolved}
        />
      </div>
      <GradientEditor value={paint} onInput={setPaint} onChange={setPaint} />
    </div>
  );
}
