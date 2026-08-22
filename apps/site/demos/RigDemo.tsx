import { useEffect, useRef, useState } from 'react';
import {
  blendPoses,
  easeInOutSine,
  mat3,
  PATH_L,
  PATH_M,
  resolveSkeleton,
  SceneCanvas,
  textCommand,
  useAnimator,
  useScene,
} from '@weasel-js/core';
import type {
  DrawCommand,
  Mat3,
  Pose,
  RenderLayer,
  SampledTrack,
  Skeleton,
  TimelineHandle,
} from '@weasel-js/core';

const W = 600, H = 340;
const BONES: { name: string; parent: string | null; x: number; y: number; rotation: number; length: number }[] = [
  { name: 'pelvis', parent: null, x: 0, y: 250, rotation: -Math.PI / 2, length: 80 },
  { name: 'torso', parent: 'pelvis', x: 80, y: 0, rotation: 0, length: 55 },
  { name: 'upperArm', parent: 'torso', x: 55, y: 0, rotation: 2.2, length: 60 },
  { name: 'forearm', parent: 'upperArm', x: 60, y: 0, rotation: 0.9, length: 55 },
  { name: 'thigh', parent: 'pelvis', x: 0, y: 0, rotation: 2.6, length: 65 },
  { name: 'shin', parent: 'thigh', x: 65, y: 0, rotation: 0.5, length: 60 },
];

const skeletonAt = (rootX: number): Skeleton => ({
  joints: BONES.map((b) => ({
    name: b.name,
    parent: b.parent,
    bind: {
      x: b.parent === null ? rootX : b.x,
      y: b.y,
      rotation: b.rotation,
      scaleX: 1,
      scaleY: 1,
    },
  })),
});

const BY_SLIDER = skeletonAt(160);
const BY_TRACK = skeletonAt(430);

const POSE_A: Pose = {
  torso: { rotation: -0.15 },
  upperArm: { rotation: -0.9 },
  forearm: { rotation: -0.7 },
  thigh: { rotation: 0.45 },
  shin: { rotation: -0.35 },
};
const POSE_B: Pose = {
  torso: { rotation: 0.15 },
  upperArm: { rotation: 0.85 },
  forearm: { rotation: 0.9 },
  thigh: { rotation: -0.5 },
  shin: { rotation: 0.6 },
};

function drawFigure(skeleton: Skeleton, pose: Pose, color: string, labels: boolean): DrawCommand[] {
  const world = resolveSkeleton(skeleton, pose);
  const cmds: DrawCommand[] = [];
  for (const bone of BONES) {
    const m = world.get(bone.name) as Mat3;
    // A bone runs from its joint's origin along the joint's local +x.
    const [ox, oy] = mat3.apply(m, 0, 0);
    const [tx, ty] = mat3.apply(m, bone.length, 0);
    cmds.push({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([ox, oy, tx, ty]),
        fillRule: 'nonzero',
      },
      stroke: { paint: { color }, width: 5 },
    });
    cmds.push({
      kind: 'path',
      path: { kind: 'rect', x: ox - 4, y: oy - 4, width: 8, height: 8 },
      fill: { color: '#f0e4cc' },
    });
    if (labels) {
      cmds.push(textCommand(ox + 8, oy - 6, bone.name, {
        fontFamily: 'sans-serif',
        fontSize: 10,
        fill: { fill: 'solid', color: '#a89878' },
      }));
    }
  }
  return cmds;
}

export function RigDemo() {
  const scene = useScene<{ id: string }>({ items: [] });
  const animator = useAnimator();
  const [blend, setBlend] = useState(0);
  const [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(false);
  const trackPose = useRef<Pose>(POSE_A);
  // The `u` the track's interpolate was last handed, expressed against A→B so
  // the return leg reads as a blend factor rather than as its own segment.
  const trackBlend = useRef(0);
  const [shownTrackBlend, setShownTrackBlend] = useState(0);

  const handle = useRef<TimelineHandle | null>(null);
  useEffect(() => {
    if (!playing) return;
    const track: SampledTrack<Pose> = {
      kind: 'sampled', label: 'pose',
      keys: [
        { t: 0, value: POSE_A },
        { t: 1400, value: POSE_B, easing: easeInOutSine },
        { t: 2800, value: POSE_A, easing: easeInOutSine },
      ],
      interpolate: (a, b, u) => {
        trackBlend.current = a === POSE_A ? u : 1 - u;
        return blendPoses([a, b], [1 - u, u]);
      },
      onTick: (p) => { trackPose.current = p; },
    };
    const tl = animator.timeline({ tracks: [track], loop: true });
    handle.current = tl;
    return () => { tl.cancel(); handle.current = null; };
  }, [animator, playing]);

  // The canvas repaints off `animator.onTick`, so the loop has to keep running
  // even when nothing is animating — otherwise the slider moves the pose with
  // nothing redrawing it.
  useEffect(() => animator.keepAlive(), [animator]);
  useEffect(() => animator.onTick(() => setShownTrackBlend(trackBlend.current)), [animator]);

  const sliderPose = blendPoses([POSE_A, POSE_B], [1 - blend, blend]);

  const figures: RenderLayer<unknown> = {
    id: 'figures', label: 'Figures',
    draw: () => [
      ...drawFigure(BY_SLIDER, sliderPose, '#7fb069', labels),
      ...drawFigure(BY_TRACK, trackPose.current, '#d4a574', labels),
      textCommand(60, 300, 'blendPoses by hand', {
        fontFamily: 'sans-serif', fontSize: 12, fill: { fill: 'solid', color: '#7fb069' },
      }),
      textCommand(330, 300, 'SampledTrack<Pose>.interpolate', {
        fontFamily: 'sans-serif', fontSize: 12, fill: { fill: 'solid', color: '#d4a574' },
      }),
    ],
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <label className="ckd-field">
          blend A → B
          <input
            className="ckd-range" type="range" min={0} max={1} step={0.01}
            value={blend} onChange={(e) => setBlend(Number(e.target.value))}
          />
          <span className="ckd-readout">{blend.toFixed(2)}</span>
        </label>
        <button className="ckd-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'stop track' : 'play track'}
        </button>
        <span className="ckd-readout">track u {shownTrackBlend.toFixed(2)}</span>
        <label className="ckd-field">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
          joint labels
        </label>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectionMode="none"
        animator={animator}
        layers={{
          figures: { layer: figures, before: 'scene' },
          selectionOverlay: null,
        }}
      />
      <div className="ckd-hint">
        Both figures are the same six-joint skeleton resolved by
        <code> resolveSkeleton</code>. The green one is posed by
        <code> blendPoses([A, B], [1 - t, t])</code> called directly from the slider; the
        orange one is posed by a <code>SampledTrack&lt;Pose&gt;</code> whose
        <code> interpolate</code> is that same call. Set the slider to the track&apos;s
        reported <code>u</code> while it plays and the two silhouettes coincide — pose
        interpolation and pose blending are one operation, which is why the rig needs no
        timeline integration of its own.
      </div>
    </div>
  );
}
