import { useEffect, useMemo, useState } from 'react';
import {
  asNodeId,
  lerpOklab,
  oklabToSrgbU8,
  SceneCanvas,
  sceneClipTargets,
  solid,
  srgbU8ToOklab,
  useScene,
} from '@weasel-js/core';
import { bindClip, createTarget } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { Paint, RectPose, Fill } from '@weasel-js/core';
import type { Clip, SampledTrack, TimelineHandle } from '@weasel-js/animator';
import { Button } from '@weasel-js/ui/components/Button';
import { AnimatedTransport } from '@weasel-js/ui/components/Timeline';
import { DemoStage } from './DemoStage';

type Lab = [number, number, number];

const W = 600, H = 300;
const FAR = W - 64;
const box = (x: number, y: number, size = 44) => ({ x, y, width: size, height: size });
const TINT = asNodeId('tint');
const COLD = srgbU8ToOklab(0x4f, 0x8f, 0xd4);
const HOT = srgbU8ToOklab(0xd4, 0x62, 0x4f);

const tintFill = (lab: Lab): Paint => {
  const rgb = oklabToSrgbU8(lab[0], lab[1], lab[2]);
  return solid(`#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`);
};

/** The whole animation as data. `pose:<id>` names a node's pose, and `tint` a target the demo makes. */
const CLIP: Clip = {
  version: 1,
  tracks: [
    {
      kind: 'sampled', label: 'x', target: 'pose:x',
      keys: [
        { t: 0, value: box(20, 24) },
        { t: 1500, value: box(FAR, 24), easing: 'easeInOutCubic' },
        { t: 3000, value: box(20, 24), easing: 'easeInOutCubic' },
      ],
    },
    {
      kind: 'sampled', label: 'y', target: 'pose:y',
      keys: [
        { t: 0, value: box(24, 90) },
        { t: 1800, value: box(24, 190), easing: 'easeOutCubic' },
        { t: 3000, value: box(24, 90), easing: 'easeInOutCubic' },
      ],
    },
    {
      kind: 'sampled', label: 'tint', target: 'tint', interpolate: 'oklab',
      keys: [{ t: 0, value: COLD }, { t: 1500, value: HOT }, { t: 3000, value: COLD }],
    },
    { kind: 'event', label: 'beats', events: [0, 750, 1500, 2250].map((t) => ({ t, name: 'beat', data: t })) },
    {
      kind: 'timeline', label: 'child @ 500 ms', at: 500,
      timeline: {
        duration: 2000,
        tracks: [{
          kind: 'sampled', label: 'child x', target: 'pose:nested',
          keys: [{ t: 0, value: box(20, 230) }, { t: 1400, value: box(FAR, 230), easing: 'easeOutCubic' }],
        }],
      },
    },
  ],
};

const rect = (id: string, pose: RectPose, paint: Paint) =>
  ({ id: asNodeId(id), kind: 'mark' as const, layer: 'main' as const, pose, data: { shape: 'rect' as const, fill: { paint } } });

export function TimelineDemo() {
  // Nothing here renders scene data as DOM. The scrub readout drives its own `setNow`.
  const scene = useScene<{ shape: 'rect'; fill: Fill }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => [
      rect('x', box(20, 24), solid('#7fb069')),
      rect('y', box(24, 90), solid('#d4a574')),
      rect(TINT, box(268, 110, 64), tintFill(COLD)),
      rect('nested', box(20, 230), solid('#a8c4d4')),
    ], []),
    subscribe: false,
  });
  const animator = useAnimator();

  const [log, setLog] = useState<{ id: number; text: string }[]>([]);

  // Bound once and mutated only through `timeline.edit`.
  const [live] = useState(() => {
    let lab = COLD;
    // A color is not a pose, so the track gets a target of its own: it shows the tint as the node's fill.
    const tint = createTarget<Lab>({
      get: () => lab,
      set: (next) => { lab = next; },
      show: (next) => scene.untracked(() => scene.update(TINT, { data: { shape: 'rect', fill: { paint: tintFill(next) } } })),
    });
    const sceneTarget = sceneClipTargets(scene);
    return bindClip(CLIP, {
      target: (name) => (name === 'tint' ? tint : sceneTarget(name)),
      interpolate: { oklab: lerpOklab },
      event: (name, t) => (name === 'beat'
        ? { fire: () => setLog((l) => [{ id: (l[0]?.id ?? 0) + 1, text: `beat @ ${String(t)} ms` }, ...l].slice(0, 40)) }
        : undefined),
    });
  });

  const [handle, setHandle] = useState<TimelineHandle | null>(null);
  useEffect(() => {
    const tl = animator.timeline({ ...live, loop: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hands over the timeline this effect creates
    setHandle(tl);
    return () => { tl.cancel(); };
  }, [animator, live]);

  const addKey = (): void => {
    if (!handle) return;
    const track = live.tracks[0] as SampledTrack<RectPose>;
    handle.edit(() => {
      const last = track.keys[track.keys.length - 1];
      track.keys.push({ t: last.t + 600, value: box(last.value.x === 20 ? FAR : 20, 24), easing: 'easeInOutCubic' });
    });
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        {handle ? <AnimatedTransport handle={handle} /> : null}
        <Button onClick={addKey}>add x keyframe</Button>
      </div>
      <div className="ckd-row">
        <DemoStage width={W} height={H}>
          <SceneCanvas className="ckd-canvas" scene={scene} features={[]} animator={animator} />
        </DemoStage>
        <div className="ckd-panel">
          <div className="ckd-panel-title">event track</div>
          <p className="ckd-panel-note">
            Events fire on forward playback only. Drag the position bar and watch this
            list stay exactly where it is — <code>seek</code> never fires an event, at any
            nesting depth.
          </p>
          <ol className="ckd-log">
            {log.map((entry) => <li key={entry.id}>{entry.id}. {entry.text}</li>)}
          </ol>
        </div>
      </div>
      <div className="ckd-hint">
        The whole animation is one <code>Clip</code>, bound by <code>bindClip</code>: green = x
        track · orange = y track, each on its node&apos;s pose through <code>sceneClipTargets</code> ·
        center square = a color track interpolating through OKLab, on a target the demo makes ·
        blue = a child timeline nested at 500 ms with its own 2000 ms duration.
        <strong> add x keyframe</strong> pushes a key past the current end inside
        <code> timeline.edit</code>, which recomputes the duration and drops cached
        interpolators — the readout and the position bar grow immediately.
      </div>
    </div>
  );
}
