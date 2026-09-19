import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  blendPoses,
  easeInOutSine,
  mat3,
  RECT_POSE_DESCRIPTOR,
  resolveSkeleton,
  rigidRigApply,
  SceneCanvas,
  solid,
  useAnimator,
  useRig,
  useScene,
} from '@weasel-js/core';
import type {
  FillStyle,
  NodeId,
  Pose,
  RectPose,
  RigApply,
  SampledTrack,
  Skeleton,
  TextStyle,
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
const BONE_WIDTH = 5;
const JOINT_SIZE = 8;

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

type Layer = 'bones' | 'joints' | 'labels';
type Data = { shape: 'rect'; fill: FillStyle } | { text: string; style: TextStyle; fill: FillStyle };
interface NodeSpec { id: NodeId; kind: 'leaf'; layer: Layer; pose: RectPose; data: Data }

const LABEL_STYLE: TextStyle = { fontFamily: 'sans-serif', fontSize: 10 };
const CAPTION_STYLE: TextStyle = { fontFamily: 'sans-serif', fontSize: 12 };

interface Figure {
  skeleton: Skeleton;
  nodes: NodeSpec[];
  bindings: Record<string, NodeId[]>;
}

/**
 * The figure's nodes, laid over its bind pose — where an editor would have the
 * author place them. Each bone is a rect running from its joint along the
 * joint's +x, with a marker on the joint and a label beside it.
 */
function figure(prefix: string, rootX: number, color: string): Figure {
  const skeleton = skeletonAt(rootX);
  const rest = resolveSkeleton(skeleton, {});
  const nodes: NodeSpec[] = [];
  const bindings: Record<string, NodeId[]> = {};
  for (const bone of BONES) {
    const m = rest.get(bone.name)!;
    const [ox, oy] = mat3.apply(m, 0, 0);
    const [tx, ty] = mat3.apply(m, bone.length, 0);
    const ids = ['bone', 'joint', 'label'].map((k) => asNodeId(`${prefix}:${k}:${bone.name}`));
    nodes.push(
      {
        id: ids[0], kind: 'leaf', layer: 'bones',
        pose: {
          x: (ox + tx) / 2 - bone.length / 2, y: (oy + ty) / 2 - BONE_WIDTH / 2,
          width: bone.length, height: BONE_WIDTH, rotation: Math.atan2(ty - oy, tx - ox),
        },
        data: { shape: 'rect', fill: solid(color) },
      },
      {
        id: ids[1], kind: 'leaf', layer: 'joints',
        pose: { x: ox - JOINT_SIZE / 2, y: oy - JOINT_SIZE / 2, width: JOINT_SIZE, height: JOINT_SIZE },
        data: { shape: 'rect', fill: solid('#f0e4cc') },
      },
      {
        id: ids[2], kind: 'leaf', layer: 'labels',
        pose: { x: ox + 8, y: oy - 14, width: 60, height: 12 },
        data: { text: bone.name, style: LABEL_STYLE, fill: solid('#a89878') },
      },
    );
    bindings[bone.name] = ids;
  }
  return { skeleton, nodes, bindings };
}

const BY_SLIDER = figure('slider', 160, '#7fb069');
const BY_TRACK = figure('track', 430, '#d4a574');

const caption = (id: string, x: number, text: string, color: string): NodeSpec => ({
  id: asNodeId(id), kind: 'leaf', layer: 'labels',
  pose: { x, y: 292, width: 220, height: 14 },
  data: { text, style: CAPTION_STYLE, fill: solid(color) },
});

const INITIAL: NodeSpec[] = [
  ...BY_SLIDER.nodes,
  ...BY_TRACK.nodes,
  caption('caption:slider', 60, 'blendPoses by hand', '#7fb069'),
  caption('caption:track', 330, 'SampledTrack<Pose>.interpolate', '#d4a574'),
];

// Bones and joint markers ride their joints rigidly; labels follow the joint
// but stay upright, which is the one thing here the default apply does not do.
const rigid = rigidRigApply(RECT_POSE_DESCRIPTOR);
const APPLY: RigApply<RectPose> = (world, ctx) => {
  if (!ctx.node.includes(':label:')) return rigid(world, ctx);
  const [x, y] = mat3.apply(world, 0, 0);
  return { ...ctx.rest, x: x + 8, y: y - 14 };
};

export function RigDemo() {
  const scene = useScene<Data, Layer, RectPose>({
    systemLayers: [{ id: 'bones' }, { id: 'joints' }, { id: 'labels' }],
    initial: useMemo(() => INITIAL, []),
  });
  const animator = useAnimator();
  const [blend, setBlend] = useState(0);
  const [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(false);
  // The `u` the track's interpolate was last handed, expressed against A→B so
  // the return leg reads as a blend factor rather than as its own segment.
  const trackBlend = useRef(0);
  const [shownTrackBlend, setShownTrackBlend] = useState(0);

  const sliderRig = useRig({ scene, skeleton: BY_SLIDER.skeleton, bindings: BY_SLIDER.bindings, apply: APPLY });
  const trackRig = useRig({ scene, skeleton: BY_TRACK.skeleton, bindings: BY_TRACK.bindings, apply: APPLY });

  useEffect(() => {
    sliderRig.pose(blendPoses([POSE_A, POSE_B], [1 - blend, blend]));
  }, [sliderRig, blend]);

  useEffect(() => {
    if (!playing) {
      trackRig.pose(POSE_A);
      return;
    }
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
      onTick: (p) => trackRig.pose(p),
    };
    const tl = animator.timeline({ tracks: [track], loop: true });
    return () => tl.cancel();
  }, [animator, playing, trackRig]);

  useEffect(() => animator.onTick(() => setShownTrackBlend(trackBlend.current)), [animator]);

  useEffect(() => scene.setLayerVisible('labels', labels), [scene, labels]);

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
        <label className="ckd-field">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
          joint labels
        </label>
        <span className="ckd-readout">track u {shownTrackBlend.toFixed(2)}</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectionMode="none"
        animator={animator}
        layers={{ selectionOverlay: null }}
      />
      <div className="ckd-hint">
        Both figures are the same six-joint skeleton, bound to scene nodes by
        <code> useRig</code>: each bone, joint marker and label is a node that rides its
        joint through the scene&apos;s pose overrides, so a frame costs no undo entry. The
        green one is posed by
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
