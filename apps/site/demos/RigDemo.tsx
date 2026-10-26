import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  easeInOutSine,
  effectivePose,
  mat3,
  RECT_POSE_DESCRIPTOR,
  rigidRigApply,
  SceneCanvas,
  solid,
  useRig,
  useScene,
} from '@weasel-js/core';
import {
  jointAxes,
  resolveSkeleton,
  sampleTrack,
  solveIk,
} from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type {
  NodeId,
  RectPose,
  RigApply,
  TextStyle,
  Fill,
} from '@weasel-js/core';
import type {
  HoldHandle,
  Pose,
  SampledTrack,
  Skeleton,
} from '@weasel-js/animator';
import num from '@weasel-js/theme/numeric.module.css';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { DemoStage } from './DemoStage';

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

type Layer = 'bones' | 'joints' | 'labels' | 'target';
type Data = { shape: 'rect'; fill: Fill } | { text: string; style: TextStyle; fill: Fill };
interface NodeSpec { id: NodeId; kind: 'mark'; layer: Layer; pose: RectPose; data: Data }

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
        id: ids[0], kind: 'mark', layer: 'bones',
        pose: {
          x: (ox + tx) / 2 - bone.length / 2, y: (oy + ty) / 2 - BONE_WIDTH / 2,
          width: bone.length, height: BONE_WIDTH, rotation: Math.atan2(ty - oy, tx - ox),
        },
        data: { shape: 'rect', fill: { paint: solid(color) } },
      },
      {
        id: ids[1], kind: 'mark', layer: 'joints',
        pose: { x: ox - JOINT_SIZE / 2, y: oy - JOINT_SIZE / 2, width: JOINT_SIZE, height: JOINT_SIZE },
        data: { shape: 'rect', fill: { paint: solid('#f0e4cc') } },
      },
      {
        id: ids[2], kind: 'mark', layer: 'labels',
        pose: { x: ox + 8, y: oy - 14, width: 60, height: 12 },
        data: { text: bone.name, style: LABEL_STYLE, fill: { paint: solid('#a89878') } },
      },
    );
    bindings[bone.name] = ids;
  }
  return { skeleton, nodes, bindings };
}

const BY_SLIDER = figure('slider', 160, '#7fb069');
const BY_TRACK = figure('track', 430, '#d4a574');

const caption = (id: string, x: number, text: string, color: string): NodeSpec => ({
  id: asNodeId(id), kind: 'mark', layer: 'labels',
  pose: { x, y: 292, width: 220, height: 14 },
  data: { text, style: CAPTION_STYLE, fill: { paint: solid(color) } },
});

const TARGET = asNodeId('slider:target');
const TARGET_SIZE = 14;
const ARM = ['upperArm', 'forearm'];
const HAND = { x: BONES.find((b) => b.name === 'forearm')!.length, y: 0 };
const ARM_AXES = jointAxes(BY_SLIDER.skeleton, ARM);
const BODY_AXES = jointAxes(BY_SLIDER.skeleton, BONES.map((b) => b.name).filter((n) => !ARM.includes(n)));

const INITIAL: NodeSpec[] = [
  {
    id: TARGET, kind: 'mark', layer: 'target',
    pose: { x: 235 - TARGET_SIZE / 2, y: 150 - TARGET_SIZE / 2, width: TARGET_SIZE, height: TARGET_SIZE },
    data: { shape: 'rect', fill: { paint: solid('#e06c75') } },
  },
  ...BY_SLIDER.nodes,
  ...BY_TRACK.nodes,
  caption('caption:slider', 60, 'holds on rig.target, by weight and joint', '#7fb069'),
  caption('caption:track', 330, 'SampledTrack<Pose> on rig.target', '#d4a574'),
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
    systemLayers: [
      { id: 'bones', locked: true }, { id: 'joints', locked: true }, { id: 'labels', locked: true }, { id: 'target' },
    ],
    initial: useMemo(() => INITIAL, []),
  });
  const animator = useAnimator();
  const [blend, setBlend] = useState(0);
  const [reach, setReach] = useState(1);
  const [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(false);
  // How far the track's pose is from A toward B, read off the torso.
  const trackBlend = useRef(0);
  const [shownTrackBlend, setShownTrackBlend] = useState(0);

  const sliderRig = useRig({ scene, skeleton: BY_SLIDER.skeleton, bindings: BY_SLIDER.bindings, apply: APPLY });
  const trackRig = useRig({ scene, skeleton: BY_TRACK.skeleton, bindings: BY_TRACK.bindings, apply: APPLY });

  // Holds on one rig share it by weight, joint by joint. Poses A and B hold the body between
  // them. On the arm they give way to its reach for the target, wherever the move action has
  // it — its drag preview lives in the overrides, its drop in the document. Posing the rig
  // commits overrides too, so only a moved target is solved.
  useEffect(() => {
    const target = sliderRig.target;
    const held = ([[POSE_A, 1 - blend], [POSE_B, blend]] as const).flatMap(([value, weight]) => [
      animator.hold({ target, value, weight, axes: BODY_AXES }),
      animator.hold({ target, value, weight: weight * (1 - reach), axes: ARM_AXES }),
    ]);
    let reaching: HoldHandle | undefined;
    // The solver starts from the two poses as one: the same mix, sampled instead of held.
    const body = sampleTrack<Pose>(
      { kind: 'sampled', keys: [{ t: 0, value: POSE_A }, { t: 1, value: POSE_B }], target }, blend,
    )!;
    let last = '';
    const aim = () => {
      const p = effectivePose(scene, scene.get(TARGET)!);
      const at = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
      const key = `${at.x},${at.y}`;
      if (key === last) return;
      last = key;
      reaching?.release({ commit: false });
      const solved = solveIk(BY_SLIDER.skeleton, body, { joints: ARM, tip: HAND, target: at }).pose;
      reaching = animator.hold({ target, value: solved, weight: reach, axes: ARM_AXES });
    };
    aim();
    const offScene = scene.subscribe(aim);
    const offOverrides = scene.overrides.subscribe(aim);
    return () => {
      offScene();
      offOverrides();
      for (const h of [...held, reaching]) h?.release({ commit: false });
    };
  }, [animator, scene, sliderRig, blend, reach]);

  useEffect(() => {
    if (!playing) {
      trackRig.pose(POSE_A);
      return;
    }
    const a = POSE_A.torso!.rotation!;
    const track: SampledTrack<Pose> = {
      kind: 'sampled', label: 'pose',
      keys: [
        { t: 0, value: POSE_A },
        { t: 1400, value: POSE_B, easing: easeInOutSine },
        { t: 2800, value: POSE_A, easing: easeInOutSine },
      ],
      target: trackRig.target,
      onTick: (p) => { trackBlend.current = (p.torso!.rotation! - a) / (POSE_B.torso!.rotation! - a); },
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
          <InlineRange
            min={0} max={1} step={0.01}
            value={blend} onChange={(e) => setBlend(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{blend.toFixed(2)}</span>
        </label>
        <label className="ckd-field">
          reach
          <InlineRange
            min={0} max={1} step={0.01}
            value={reach} onChange={(e) => setReach(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{reach.toFixed(2)}</span>
        </label>
        <Button onClick={() => setPlaying((p) => !p)}>
          {playing ? 'stop track' : 'play track'}
        </Button>
        <Checkbox isSelected={labels} onChange={setLabels}>joint labels</Checkbox>
        <span className={`ckd-readout ${num.numeric}`}>track u {shownTrackBlend.toFixed(2)}</span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          features={['pick', 'move']}
          animator={animator}
          layers={{ selectionOverlay: null }}
        />
      </DemoStage>
      <div className="ckd-hint">
        Both figures are the same six-joint skeleton, bound to scene nodes by
        <code> useRig</code>: each bone, joint marker and label is a node that rides its
        joint through the scene&apos;s pose overrides, so a frame costs no undo entry. A rig
        is an animation target, <code>rig.target</code>, and everything here moves one. The
        green figure is <code>animator.hold</code>s on it, poses A and B at weights
        <code> 1 - t</code> and <code>t</code>. The orange one is a
        <code> SampledTrack&lt;Pose&gt;</code> naming it as its <code>target</code>, with no
        <code> interpolate</code>: set the slider to the track&apos;s reported <code>u</code>
        while it plays and the two bodies coincide. Drag the red target: <code>solveIk</code>
        {' '}answers with one more pose, held on the arm&apos;s joints alone through
        <code> axes: jointAxes(skeleton, arm)</code> at the reach weight, where it takes its
        share from A and B. The body stays theirs.
      </div>
    </div>
  );
}
