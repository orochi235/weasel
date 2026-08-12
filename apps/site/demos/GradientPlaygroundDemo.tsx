import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas, fillInPoseFrame, fillToBoundsFrame, useScene, viewToTransform, worldToScreen,
} from '@weasel-js/core';
import type { GradientFill, RenderLayer, View } from '@weasel-js/core';
import { viewToMat3, type DrawCommand } from '@weasel-js/core/renderer';
import { GradientEditor, GradientHandles } from '@weasel-js/ui';

const W = 600;
const H = 400;

/** The box the gradient is expressed against. `units: 'bounds'` means the
 *  paint is stored as fractions of it, so it survives pan and zoom. */
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

export function GradientPlaygroundDemo() {
  const [paint, setPaint] = useState<GradientFill>(INITIAL);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // paintRef lets the layer's draw() read the current paint without
  // recreating the layer object — and so the memo below can stay empty-dep.
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'gradient-rect',
    label: 'Gradient rect',
    draw: (_data, v): DrawCommand[] => [{
      kind: 'group',
      transform: viewToMat3(v),
      children: [{
        kind: 'path',
        path: { kind: 'rect', ...SHAPE_RECT },
        // Resolve `bounds` against the box, exactly as a node painter does
        // for a scene node — this layer draws the rect itself, so it owns
        // that step.
        fill: fillInPoseFrame(paintRef.current, SHAPE_RECT),
      }],
    }],
  }), []);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

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
          layers={{
            scene: { drawOne: () => [] },
            gradient: { layer, after: 'scene' },
          }}
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
