import { useEffect, useMemo, useState } from 'react';
import { autoSkin } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { Pose, SampledTrack, Skeleton } from '@weasel-js/animator';
import {
  asNodeId,
  easeInOutSine,
  polygonFromPoints,
  SceneCanvas,
  solid,
  useRig,
  useScene,
} from '@weasel-js/core';
import type { NodeId, Path, RectPose, Stroke, Fill } from '@weasel-js/core';
import num from '@weasel-js/theme/numeric.module.css';
import { DemoStage } from './DemoStage';

const W = 600, H = 300;
const BONE = 110, HALF = 16, Y = 230;

/** shoulder → elbow → wrist along +x. The wrist is where the forearm's bone ends. */
const armAt = (x: number): Skeleton => ({
  joints: [
    { name: 'shoulder', parent: null, bind: { x, y: Y, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'elbow', parent: 'shoulder', bind: { x: BONE, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'wrist', parent: 'elbow', bind: { x: BONE, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
});
const RIGID = armAt(40);
const SKINNED = armAt(340);

type Data = { shape: 'rect'; fill: Fill; stroke: Stroke } | { path: Path; fill: Fill; stroke: Stroke };
interface NodeSpec { id: NodeId; kind: 'mark'; layer: 'main'; pose: RectPose; data: Data }

const INK: Stroke = { paint: { color: '#2b2118' }, width: 3, join: 'round' };
const UPPER = asNodeId('rigid:upper'), LOWER = asNodeId('rigid:lower'), SLEEVE = asNodeId('skinned:sleeve');

/** One outline around both bones, with a point every 11 units for the bend to use. */
const SLEEVE_PATH = polygonFromPoints([
  ...Array.from({ length: 21 }, (_, i) => ({ x: 340 + i * 11, y: Y - HALF })),
  ...Array.from({ length: 21 }, (_, i) => ({ x: 560 - i * 11, y: Y + HALF })),
]);

const piece = (id: NodeId, x: number, color: string): NodeSpec => ({
  id, kind: 'mark', layer: 'main',
  pose: { x, y: Y - HALF, width: BONE, height: 2 * HALF },
  data: { shape: 'rect', fill: { paint: solid(color) }, stroke: INK },
});
const INITIAL: NodeSpec[] = [
  piece(UPPER, 40, '#7fb069'),
  piece(LOWER, 40 + BONE, '#a8cf96'),
  {
    id: SLEEVE, kind: 'mark', layer: 'main',
    pose: { x: 340, y: Y - HALF, width: 2 * BONE, height: 2 * HALF },
    data: { path: SLEEVE_PATH, fill: { paint: solid('#d4a574') }, stroke: INK },
  },
];
const RIGID_BINDINGS = { shoulder: UPPER, elbow: LOWER };

const bent = (angle: number): Pose => ({ elbow: { rotation: -angle } });

export function SkinDemo() {
  const scene = useScene<Data, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => INITIAL, []),
  });
  const animator = useAnimator();
  const [angle, setAngle] = useState(1.2);
  const [power, setPower] = useState(4);
  const [playing, setPlaying] = useState(false);

  const skins = useMemo(() => ({ [SLEEVE]: autoSkin(SLEEVE_PATH, SKINNED, { power }) }), [power]);
  const rigid = useRig({ scene, skeleton: RIGID, bindings: RIGID_BINDINGS });
  const skinned = useRig({ scene, skeleton: SKINNED, skins });

  useEffect(() => {
    if (!playing) {
      rigid.pose(bent(angle));
      skinned.pose(bent(angle));
      return;
    }
    const tracks = [rigid, skinned].map((rig): SampledTrack<Pose> => ({
      kind: 'sampled',
      keys: [
        { t: 0, value: bent(0) },
        { t: 1200, value: bent(2.1), easing: easeInOutSine },
        { t: 2400, value: bent(0), easing: easeInOutSine },
      ],
      target: rig.target,
    }));
    const tl = animator.timeline({ tracks, loop: true });
    return () => tl.cancel();
  }, [animator, rigid, skinned, angle, playing]);

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <label className="ckd-field">
          elbow
          <input
            className="ckd-range" type="range" min={0} max={2.3} step={0.01} disabled={playing}
            value={angle} onChange={(e) => setAngle(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{angle.toFixed(2)}</span>
        </label>
        <label className="ckd-field">
          falloff power
          <input
            className="ckd-range" type="range" min={1} max={12} step={0.5}
            value={power} onChange={(e) => setPower(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{power.toFixed(1).padStart(4)}</span>
        </label>
        <button className="ckd-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'stop' : 'play'}
        </button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          features={['pick']}
          animator={animator}
        />
      </DemoStage>
      <div className="ckd-hint">
        The same three-joint arm twice. On the left, <code>bindings</code> carry two rects, each
        whole with its joint, so they overlap inside the bend and gape outside it. On the right,
        <code> skins</code> bend one path: <code>autoSkin</code> weighs each of its points by
        distance to the bones, and the rig shows the bent path through the node&apos;s pose
        override. Fill, stroke, and picking all read that path, so click the bent arm and the
        selection box follows it. A low falloff power spreads the bend along the arm; a high one
        makes it hinge.
      </div>
    </div>
  );
}
