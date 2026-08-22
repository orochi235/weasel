import { useEffect, useRef, useState } from 'react';
import {
  asNodeId,
  easeInOutCubic,
  easeOutCubic,
  lerpOklab,
  oklabToSrgbU8,
  SceneCanvas,
  srgbU8ToOklab,
  useAnimator,
  useScene,
} from '@weasel-js/core';
import type {
  DrawCommand,
  EventTrack,
  SampledTrack,
  TimelineHandle,
  TimelineTrack,
  Track,
} from '@weasel-js/core';

interface Rect { id: string; x: number; y: number; width: number; height: number }

const W = 600, H = 300;
const INITIAL: Rect[] = [
  { id: 'x', x: 20, y: 24, width: 44, height: 44 },
  { id: 'y', x: 24, y: 90, width: 44, height: 44 },
  { id: 'tint', x: 268, y: 110, width: 64, height: 64 },
  { id: 'nested', x: 20, y: 230, width: 44, height: 44 },
];
const FILLS: Record<string, string> = {
  x: '#7fb069', y: '#d4a574', nested: '#a8c4d4',
};
const COLD = srgbU8ToOklab(0x4f, 0x8f, 0xd4);
const HOT = srgbU8ToOklab(0xd4, 0x62, 0x4f);

const toHex = (lab: readonly [number, number, number]): string => {
  const rgb = oklabToSrgbU8(lab[0], lab[1], lab[2]);
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

export function TimelineDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const animator = useAnimator();

  const tint = useRef(toHex(COLD));
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = timeScale;

  const move = (id: string, patch: Partial<Rect>): void => {
    const nodeId = asNodeId(id);
    const node = scene.get(nodeId);
    if (node) scene.setPose(nodeId, { ...(node.pose as Rect), ...patch });
  };

  // Built once and mutated only through `timeline.edit`, so keys added at
  // runtime survive the rebuild a loop-toggle forces.
  const tracksRef = useRef<Track[] | null>(null);
  if (!tracksRef.current) {
    const x: SampledTrack<number> = {
      kind: 'sampled', label: 'x',
      keys: [
        { t: 0, value: 20 },
        { t: 1500, value: W - 64, easing: easeInOutCubic },
        { t: 3000, value: 20, easing: easeInOutCubic },
      ],
      onTick: (v) => move('x', { x: v }),
    };
    const y: SampledTrack<number> = {
      kind: 'sampled', label: 'y',
      keys: [
        { t: 0, value: 90 },
        { t: 1800, value: 190, easing: easeOutCubic },
        { t: 3000, value: 90, easing: easeInOutCubic },
      ],
      onTick: (v) => move('y', { y: v }),
    };
    const tintTrack: SampledTrack<[number, number, number]> = {
      kind: 'sampled', label: 'tint',
      keys: [{ t: 0, value: COLD }, { t: 1500, value: HOT }, { t: 3000, value: COLD }],
      interpolate: lerpOklab,
      onTick: (v) => { tint.current = toHex(v); },
    };
    const beats: EventTrack = {
      kind: 'event', label: 'beats',
      events: [0, 750, 1500, 2250].map((t) => ({
        t,
        fire: () => setLog((l) => [
          { id: (l[0]?.id ?? 0) + 1, text: `beat @ ${t} ms` },
          ...l,
        ].slice(0, 40)),
      })),
    };
    const child: SampledTrack<number> = {
      kind: 'sampled', label: 'child x',
      keys: [{ t: 0, value: 20 }, { t: 1400, value: W - 64, easing: easeOutCubic }],
      onTick: (v) => move('nested', { x: v }),
    };
    const nested: TimelineTrack = {
      kind: 'timeline', label: 'child @ 500 ms', at: 500,
      timeline: { tracks: [child], duration: 2000 },
    };
    tracksRef.current = [x, y, tintTrack, beats, nested];
  }

  const handle = useRef<TimelineHandle | null>(null);
  useEffect(() => {
    const tl = animator.timeline({ tracks: tracksRef.current as Track[], loop });
    tl.setTimeScale(scaleRef.current);
    handle.current = tl;
    setDuration(tl.duration());
    setPlaying(true);
    const unsubscribe = tl.subscribe(() => setDuration(tl.duration()));
    return () => { unsubscribe(); tl.cancel(); handle.current = null; };
  }, [animator, loop]);

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
    const track = (tracksRef.current as Track[])[0] as SampledTrack<number>;
    tl.edit(() => {
      const last = track.keys[track.keys.length - 1];
      track.keys.push({
        t: last.t + 600,
        value: last.value === 20 ? W - 64 : 20,
        easing: easeInOutCubic,
      });
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
        <span className="ckd-readout">{Math.round(now)} / {duration} ms</span>
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
          <span className="ckd-readout">{timeScale.toFixed(1)}×</span>
        </label>
        <button className="ckd-btn" onClick={addKey}>add x keyframe</button>
      </div>
      <div className="ckd-row">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selectionMode="none"
          animator={animator}
          layers={{
            scene: {
              drawOne: (n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: String(n.id) === 'tint' ? tint.current : FILLS[String(n.id)] },
              }],
            },
            selectionOverlay: null,
          }}
        />
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
        Green = x track · orange = y track · center square = a colour track interpolating
        through OKLab · blue = a child timeline nested at 500 ms with its own 2000 ms
        duration. <strong>add x keyframe</strong> pushes a key past the current end inside
        <code> timeline.edit</code>, which recomputes the duration and drops cached
        interpolators — the readout and the scrub range grow immediately.
      </div>
    </div>
  );
}
