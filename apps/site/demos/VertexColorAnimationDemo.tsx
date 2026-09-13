import { useEffect, useState } from 'react';
import {
  asNodeId,
  boundsOfPath,
  cycleVertexColors,
  pathFromD,
  rainbowVertexColors,
  SceneCanvas,
  solidVertexColors,
  staggerVertexColors,
  strokeOf,
  tweenVertexColors,
  useAnimator,
  useScene,
  type Path,
  type Stroke,
} from '@weasel-js/core';

const W = 440, H = 240;
const ANCHORS = 7;
const RAINBOW = rainbowVertexColors(ANCHORS);
const RED = solidVertexColors(ANCHORS, 0.95, 0.25, 0.3);
const WHITE = solidVertexColors(ANCHORS, 1, 1, 1);

type WaveData = { path: Path; stroke: Stroke & { vertexColors: number[] } };

// A seven-anchor wave whose stroke carries one RGBA per anchor.
function wave(id: string, y: number) {
  let d = `M40 ${y}`;
  for (let i = 1; i < ANCHORS; i++) d += ` Q${10 + 60 * i} ${y + (i % 2 ? -40 : 40)} ${40 + 60 * i} ${y}`;
  const path = pathFromD(d);
  const { x, y: top, width, height } = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y: top, width, height },
    data: { path, stroke: { ...strokeOf('#ffffff', 10), vertexColors: RAINBOW } },
  };
}

export function VertexColorAnimationDemo() {
  const scene = useScene<WaveData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [wave('cycle', 50), wave('tween', 120), wave('stagger', 190)],
  });
  const animator = useAnimator();
  const [cycling, setCycling] = useState(true);
  const [oklch, setOklch] = useState(false);

  useEffect(() => {
    if (!cycling) return;
    const cycle = cycleVertexColors(animator, {
      id: 'cycle',
      channel: 'stroke',
      msPerCycle: 4000,
      direction: -1,
      interpolation: oklch ? 'oklch' : 'rgb',
    });
    return () => cycle.cancel();
  }, [animator, cycling, oklch]);

  // Toggle between the rainbow and `other`. The animation's colors are an
  // override that ends with it, so `commit` writes the final colors to the node.
  const nextColors = (id: string, other: number[]) => {
    const node = scene.get(asNodeId(id))!;
    const from = node.data.stroke.vertexColors;
    const to = from.every((v, i) => v === RAINBOW[i]) ? other : RAINBOW;
    const commit = () => scene.update(node.id, {
      data: { ...node.data, stroke: { ...node.data.stroke, vertexColors: to } },
    });
    return { from, to, commit };
  };

  const tween = () => {
    const { from, to, commit } = nextColors('tween', RED);
    tweenVertexColors(animator, { id: 'tween', channel: 'stroke', from, to, ms: 800, onDone: commit });
  };

  const stagger = () => {
    const { from, to, commit } = nextColors('stagger', WHITE);
    staggerVertexColors(animator, {
      id: 'stagger', channel: 'stroke', from, to, anchorMs: 400, perAnchorDelay: 120, onDone: commit,
    });
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={() => setCycling((c) => !c)}>
          {cycling ? 'pause cycle' : 'cycle'}
        </button>
        <label className="ckd-field">
          <input type="checkbox" checked={oklch} onChange={(e) => setOklch(e.currentTarget.checked)} />
          OKLCh
        </label>
        <button className="ckd-btn" onClick={tween}>tween</button>
        <button className="ckd-btn" onClick={stagger}>stagger</button>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        animator={animator}
        selectionMode="none"
      />
    </div>
  );
}
