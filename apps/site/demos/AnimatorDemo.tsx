import { useEffect, useReducer, useRef, useState } from 'react';
import { createTarget, useAnimator, type AnimationKind, type HoldHandle } from '@weasel-js/animator';
import { DrawCanvas, solid } from '@weasel-js/core';
import { Button, ToggleBar } from '@weasel-js/ui';
import s from './AnimatorDemo.module.css';

const W = 560, H = 260, SIZE = 28, COUNT = 7, PITCH = 44, INSET = 24;
const SLIDE = W - 2 * INSET - SIZE - (COUNT - 1) * PITCH;
const TOP = 40, BOTTOM = H - 40 - SIZE, MIDDLE = (TOP + BOTTOM) / 2;
const FILL = solid('#7ab8d4');

interface Mark { x: number; y: number }

const slid = (m: Mark): Mark => ({ ...m, x: m.x === 0 ? SLIDE : 0 });
const dropped = (m: Mark): Mark => ({ ...m, y: m.y === TOP ? BOTTOM : TOP });

const SPEEDS = [{ value: 1, label: '1×' }, { value: 0.25, label: '¼×' }];
const KINDS: AnimationKind[] = ['tween', 'spring', 'stagger', 'hold'];

export function AnimatorDemo() {
  const animator = useAnimator();
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  // Each mark is a value the demo owns. A target commits a destination to it at once and
  // hands `show` the value to draw; `publish` runs once a frame for every mark it showed.
  const [marks] = useState(() => Array.from({ length: COUNT }, () => {
    const mark = { value: { x: 0, y: TOP }, shown: { x: 0, y: TOP } };
    const target = createTarget<Mark>({
      get: () => mark.value,
      set: (v) => { mark.value = v; },
      show: (v) => { mark.shown = v; },
      publish: repaint,
    });
    return { mark, target };
  }));
  const targets = marks.map((m) => m.target);

  useEffect(() => animator.watch(() => repaint()), [animator]);

  // Every call below leaves `cancelKey` off, so a new animation adds to the ones still running.
  const tween = () => targets.forEach((target) => animator.tween({
    target, to: slid(target.committed()), ms: 900, easing: 'easeInOutCubic',
  }));
  const spring = () => targets.forEach((target) => animator.spring({
    target, to: dropped(target.committed()), preset: 'wobbly',
  }));
  const stagger = () => animator.stagger(targets, 80).spring({
    to: (target) => dropped(target.committed()), preset: 'wobbly',
  });

  const [held, setHeld] = useState(false);
  const holds = useRef<HoldHandle[]>([]);
  const weight = useRef(0);
  const hold = () => {
    const on = !held;
    setHeld(on);
    if (holds.current.length === 0) {
      holds.current = targets.map((target) => animator.hold({
        target, value: { x: 0, y: MIDDLE }, axes: ['y'], weight: () => weight.current,
      }));
    }
    animator.tween({
      from: weight.current, to: on ? 1 : 0, ms: 300, cancelKey: 'hold-weight',
      onTick: (v) => { weight.current = v; },
      onDone: () => {
        if (on) return;
        for (const h of holds.current) h.release({ commit: false });
        holds.current = [];
      },
    });
  };

  const [paused, setPaused] = useState(false);
  const pause = () => {
    if (paused) animator.resume(); else animator.pause();
    setPaused(!paused);
  };
  const [speed, setSpeed] = useState(1);

  const live = animator.live();
  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <Button onClick={tween}>Tween</Button>
        <Button onClick={spring}>Spring</Button>
        <Button onClick={stagger}>Stagger</Button>
        <Button pressed={held} onClick={hold}>Hold</Button>
        <Button pressed={paused} onClick={pause}>Pause</Button>
        <ToggleBar
          items={SPEEDS}
          value={speed}
          onChange={(v) => { if (v) { animator.setTimeScale(v); setSpeed(v); } }}
          ariaLabel="Time scale"
          size="sm"
        />
      </div>
      <DrawCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        background={{ kind: 'solid', color: '#ffffff' }}
        draw={marks.map(({ mark }, i) => ({
          kind: 'path',
          path: { kind: 'rect', x: INSET + i * PITCH + mark.shown.x, y: mark.shown.y, width: SIZE, height: SIZE },
          fill: { paint: FILL },
        }))}
      />
      <dl className={s.live}>
        {KINDS.map((kind) => (
          <div key={kind} className={s.kind}>
            <dt>{kind}</dt>
            <dd className={s.count}>{live.filter((a) => a.kind === kind).length}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
