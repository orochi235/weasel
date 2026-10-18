import { useEffect, useMemo, useState } from 'react';
import { bindClip, toClip } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { Clip, TimelineHandle } from '@weasel-js/animator';
import { asNodeId, SceneCanvas, sceneClipTargets, solid, useScene } from '@weasel-js/core';
import type { RectPose, Fill } from '@weasel-js/core';
import { AnimatedTimeline } from '@weasel-js/ui/components/Timeline';
import s from './ClipDemo.module.css';
import { DemoStage } from './DemoStage';

const W = 420, H = 260;
const BOX = asNodeId('box');
const at = (x: number, y: number) => ({ x, y, width: 40, height: 40 });

/** The whole animation, as it would sit in a file. */
const CLIP: Clip = {
  version: 1,
  tracks: [
    {
      kind: 'sampled', label: 'box', target: `pose:${BOX}`,
      keys: [
        { t: 0, value: at(30, 30) },
        { t: 900, value: at(340, 30), easing: 'easeInOutCubic' },
        { t: 1800, value: at(340, 190), easing: 'easeOutBounce' },
        { t: 2700, value: at(30, 30), easing: { bezier: [0.6, 0, 0.2, 1] } },
      ],
    },
    { kind: 'event', label: 'marks', events: [{ t: 900, name: 'log', data: 'corner' }, { t: 1800, name: 'log', data: 'landed' }] },
  ],
};

export function ClipDemo() {
  const scene = useScene<{ shape: 'rect'; fill: Fill }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => [
      { id: BOX, kind: 'leaf' as const, layer: 'main' as const, pose: at(30, 30), data: { shape: 'rect' as const, fill: { paint: solid('#7fb069') } } },
    ], []),
  });
  const animator = useAnimator();
  const [clip, setClip] = useState(CLIP);
  const [text, setText] = useState(() => JSON.stringify(CLIP, null, 2));
  const [error, setError] = useState('');
  const [fired, setFired] = useState('');
  const [handle, setHandle] = useState<TimelineHandle | null>(null);

  useEffect(() => {
    const live = bindClip(clip, {
      target: sceneClipTargets(scene),
      event: (name, data) => (name === 'log' ? { fire: () => setFired(String(data)) } : undefined),
    });
    const tl = animator.timeline({ ...live, loop: true });
    // The editor below needs the handle to render from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandle(tl);
    return () => tl.cancel();
  }, [animator, scene, clip]);

  const load = () => {
    try {
      const next = JSON.parse(text) as Clip;
      bindClip(next, { target: sceneClipTargets(scene), event: () => ({}) });
      setClip(next);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const save = () => {
    if (handle) setText(JSON.stringify(toClip({ tracks: [...handle.tracks()] }), null, 2));
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={load}>load the JSON</button>
        <button className="ckd-btn" onClick={save}>save to JSON</button>
        <span className="ckd-readout">last event: {fired || 'none'}</span>
        <span className={s.error}>{error}</span>
      </div>
      <div className={s.top}>
        <textarea
          className={s.code} spellCheck={false} aria-label="Clip JSON"
          value={text} onChange={(e) => setText(e.target.value)}
        />
        <DemoStage width={W} height={H}>
          <SceneCanvas className="ckd-canvas" scene={scene} features={[]} animator={animator} />
        </DemoStage>
      </div>
      <div className={s.editor}>{handle && <AnimatedTimeline handle={handle} />}</div>
      <div className="ckd-hint">
        The animation on the right is the JSON on the left. <code>bindClip</code> turns a clip
        into a timeline by resolving its names: <code>sceneClipTargets</code> answers
        <code> pose:box</code> with that node&apos;s pose target, and the demo&apos;s binder turns the
        event name <code>log</code> into a callback. Edit the JSON and load it, or drag a key
        in the editor below and save: <code>toClip</code> reads the live timeline back into
        data, easings included.
      </div>
    </div>
  );
}
