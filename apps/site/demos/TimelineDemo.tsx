import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  lerpOklab,
  oklabToSrgbU8,
  SceneCanvas,
  sceneClipTargets,
  solid,
  srgbU8ToOklab,
  useLatest,
  useScene,
} from '@weasel-js/core';
import { bindClip, createTarget } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { Paint, RectPose, Fill } from '@weasel-js/core';
import type { Clip, SampledTrack, TimelineHandle } from '@weasel-js/animator';
import num from '@weasel-js/theme/numeric.module.css';
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
  ({ id: asNodeId(id), kind: 'leaf' as const, layer: 'main' as const, pose, data: { shape: 'rect' as const, fill: { paint } } });

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
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const scaleRef = useLatest(timeScale);

  // Bound once and mutated only through `timeline.edit`, so keys added at
  // runtime survive the rebuild a loop-toggle forces.
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

  const handle = useRef<TimelineHandle | null>(null);
  useEffect(() => {
    const tl = animator.timeline({ ...live, loop });
    tl.setTimeScale(scaleRef.current);
    handle.current = tl;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads back the timeline this effect creates
    setDuration(tl.duration());
    setPlaying(true);
    const unsubscribe = tl.subscribe(() => setDuration(tl.duration()));
    return () => { unsubscribe(); tl.cancel(); handle.current = null; };
  }, [animator, loop, scaleRef, live]);

  useEffect(() => animator.onTick(() => setNow(handle.current?.time() ?? 0)), [animator]);

  const toggle = (): void => {
    const tl = handle.current;
    if (!tl) return;
    if (tl.isPaused()) { tl.resume(); setPlaying(true); } else { tl.pause(); setPlaying(false); }
  };

  // Scrubbing pauses first: a playhead the user is dragging and a playhead the
  // animator is advancing are two different intents.
  const scrub = (t: number): void => {
    const tl = handle.current;
    if (!tl) return;
    tl.pause();
    setPlaying(false);
    tl.seek(t);
    setNow(t);
  };

  const onTimeScale = (s: number): void => {
    setTimeScale(s);
    handle.current?.setTimeScale(s);
  };

  const addKey = (): void => {
    const tl = handle.current;
    if (!tl) return;
    const track = live.tracks[0] as SampledTrack<RectPose>;
    tl.edit(() => {
      const last = track.keys[track.keys.length - 1];
      track.keys.push({ t: last.t + 600, value: box(last.value.x === 20 ? FAR : 20, 24), easing: 'easeInOutCubic' });
    });
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={toggle}>{playing ? 'pause' : 'play'}</button>
        <label className="ckd-field">
          scrub
          <input
            className="ckd-range" type="range" min={0} max={duration || 1} step={10}
            value={Math.round(now)} onChange={(e) => scrub(Number(e.target.value))}
          />
        </label>
        <span className={`ckd-readout ${num.numeric}`}>{Math.round(now)} / {duration} ms</span>
        <label className="ckd-field">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          loop
        </label>
        <label className="ckd-field">
          time-scale
          <input
            className="ckd-range" type="range" min={0.1} max={3} step={0.1}
            value={timeScale} onChange={(e) => onTimeScale(Number(e.target.value))}
          />
          <span className={`ckd-readout ${num.numeric}`}>{timeScale.toFixed(1)}×</span>
        </label>
        <button className="ckd-btn" onClick={addKey}>add x keyframe</button>
      </div>
      <div className="ckd-row">
        <DemoStage width={W} height={H}>
          <SceneCanvas className="ckd-canvas" scene={scene} features={[]} animator={animator} />
        </DemoStage>
        <div className="ckd-panel">
          <div className="ckd-panel-title">event track</div>
          <p className="ckd-panel-note">
            Events fire on forward playback only. Drag <strong>scrub</strong> and watch this
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
        interpolators — the readout and the scrub range grow immediately.
      </div>
    </div>
  );
}
