import { useEffect, useMemo, useRef, useState } from 'react';
import { asNodeId, easeInOutSine, momentum, SceneCanvas, WeaselProvider, useAnimatedReflow, useScene } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Dims, PoseTransitionSeat } from '@weasel-js/core';
import type { Animator } from '@weasel-js/animator';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import styles from './AnimationDemo.module.css';
import { AnimatorWatch } from './animation/AnimatorWatch';
import { FlickSnapPanel } from './animation/FlickSnapPanel';
import { DemoStage } from './DemoStage';
import { movePreset, pickPreset, useSelection } from '@weasel-js/editing';

interface Card { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
const CARD_FILL = '#d4c4a8';
const ACCENT_FILLS = ['#d4c4a8', '#c4d4a8', '#a8c4d4'];
const INITIAL: Card[] = [
  { id: 'a', x: 100, y: 100, width: 80, height: 60, color: ACCENT_FILLS[0] },
  { id: 'b', x: 220, y: 100, width: 80, height: 60, color: ACCENT_FILLS[1] },
  { id: 'c', x: 340, y: 100, width: 80, height: 60, color: ACCENT_FILLS[2] },
];

/** A card collapsed to a point at its center: where one grows from and shrinks into. */
const toCenter = (p: Card): Card => ({ ...p, x: p.x + p.width / 2, y: p.y + p.height / 2, width: 0, height: 0 });

export function AnimationCards({ animator }: { animator: Animator }) {
  const scene = useScene<Card>({ items: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  const nextId = useRef(1);
  const [size, setSize] = useState<Dims>({ width: W, height: H });

  // Per-card visual effects (multiplicative scale + alpha). Read by drawOne,
  // mutated by breathing-loop / stagger-fade onTick. A ref, so a tick renders
  // nothing: the canvas repaints on the animator's own frames (`redrawOn`).
  const effects = useRef<Map<string, { scale: number; alpha: number }>>(new Map());
  const getEffect = (id: string) => {
    let e = effects.current.get(id);
    if (!e) { e = { scale: 1, alpha: 1 }; effects.current.set(id, e); }
    return e;
  };
  const redrawOn = useMemo(() => [{ subscribe: (repaint: () => void) => animator.onTick(repaint) }], [animator]);

  const [timeScale, setTimeScaleState] = useState(1);
  const [paused, setPausedState] = useState(false);

  const onTimeScale = (s: number) => {
    setTimeScaleState(s);
    animator.setTimeScale(s);
  };
  const onTogglePause = () => {
    if (paused) { animator.resume(); setPausedState(false); }
    else { animator.pause(); setPausedState(true); }
  };

  // A pose the scene is handed — a button's setPose, an undo or redo — glides
  // there on screen, a card the scene adds grows from its center, and one it
  // removes shrinks into it, fading. The document takes each write at once;
  // only what is shown travels.
  const glide = useAnimatedReflow(scene, animator, { ms: 250, label: 'glide' });
  const poseTransition = useMemo<PoseTransitionSeat<Card> | null>(
    () => glide && { transition: glide, enter: toCenter, exit: toCenter },
    [glide],
  );

  const selectToolOpts = useMemo(() => ({
    move: {
      behaviors: [
        momentum<Card>({
          animator,
          friction: 0.93,
          bounds: { x: 0, y: 0, width: size.width - 60, height: size.height - 60 },
        }),
      ],
    },
  }), [animator, size]);

  const insertCard = (card: Card) => {
    scene.add({ id: asNodeId(card.id), kind: 'mark', layer: 'default', pose: card, data: card });
  };

  const tweenTo = (id: string, x: number, y: number) => {
    const node = scene.get(asNodeId(id));
    if (!node) return;
    scene.setPose(node.id, { ...node.pose, x, y });
  };

  const removeSelected = () => {
    const ids = selection.current;
    scene.batch('Remove', () => ids.forEach((id) => scene.remove(asNodeId(id))));
  };

  const addCard = () => {
    const id = `n${nextId.current++}`;
    insertCard({ id, x: 200 + Math.random() * 100, y: 250, width: 60, height: 60, color: CARD_FILL });
  };

  // Loop handles are not registered by id with the animator, so the effect cancels its own.
  const selectedIds = selection.current;
  const breathingFocus = selectedIds.length === 1 ? (selectedIds[0] as string) : null;
  useEffect(() => {
    if (!breathingFocus) return;
    const id = breathingFocus;
    const effectsMap = effects.current;
    getEffect(id);
    const handle = animator.tweenLoop<number>({
      from: 1.0,
      to: 1.06,
      ms: 800,
      direction: 'alternate',
      easing: easeInOutSine,
      label: 'breathe',
      onTick: (v) => {
        const e = getEffect(id);
        e.scale = v;
        e.alpha = 0.85 + (v - 1.0) * 2.5;
      },
    });
    return () => {
      handle.cancel();
      const e = effectsMap.get(id);
      if (e) { e.scale = 1; e.alpha = 1; }
    };
  }, [breathingFocus, animator]);

  const addBatch = () => {
    const newIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `n${nextId.current++}`;
      newIds.push(id);
      // Seed alpha at 0.3 so the stagger has somewhere to start from.
      effects.current.set(id, { scale: 1, alpha: 0.3 });
    }
    scene.batch('Add 5', () => newIds.forEach((id, i) =>
      insertCard({ id, x: 60 + i * 100, y: 320, width: 60, height: 50, color: CARD_FILL })));
    animator.stagger(newIds, 50).tween<number>({
      from: 0.3,
      to: 1,
      ms: 300,
      onTick: (v, id) => {
        const e = getEffect(id);
        e.alpha = v;
      },
    });
  };

  return (
    <div className={styles.demo}>
      <div className="ckd-toolbar">
        <Button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</Button>
        <Button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</Button>
        <Button onClick={addCard}>Add card</Button>
        <Button onClick={addBatch}>Add 5 (staggered fade-in)</Button>
        <Button onClick={removeSelected} disabled={selection.current.length === 0}>Remove selected</Button>
        <Button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</Button>
        <Button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</Button>
      </div>
      <div className="ckd-toolbar">
        <Button onClick={onTogglePause}>{paused ? 'Resume' : 'Pause'} animations</Button>
        <Field orientation="row" className="ckd-field" label="time-scale" output={<span className={styles.scale}>{timeScale.toFixed(2)}×</span>}>
          <InlineRange
            min={0}
            max={2}
            step={0.05}
            value={timeScale}
            onChange={(e) => onTimeScale(Number(e.target.value))}
          />
        </Field>
        <span className="ckd-toolbar-note">Select one card to see the breathing pulse.</span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={[pickPreset, movePreset]}
          className="ckd-canvas"
          onResize={setSize}
          scene={scene}
          selection={selection}
          selectTool={selectToolOpts}
          poseTransition={poseTransition}
          redrawOn={redrawOn}
          layers={{
            scene: {
              drawOne: (n, p): DrawCommand[] => {
                const id = String(n.id);
                const e = effects.current.get(id) ?? { scale: 1, alpha: 1 };
                const r = p as Pose;
                const cx = r.x + r.width / 2;
                const cy = r.y + r.height / 2;
                const w = r.width * e.scale;
                const h = r.height * e.scale;
                return [{
                  kind: 'path',
                  path: { kind: 'rect', x: cx - w / 2, y: cy - h / 2, width: w, height: h },
                  fill: { paint: { color: (n.data as Card).color, opacity: e.alpha } },
                }];
              },
            },
            selectionOverlay: { handles: false },
          }}
        />
      </DemoStage>
    </div>
  );
}

export function AnimationDemo() {
  const animator = useAnimator();
  return (
    <div className={styles.demo}>
      <WeaselProvider isolate><AnimationCards animator={animator} /></WeaselProvider>
      <AnimatorWatch animator={animator} />
      <span className="ckd-toolbar-note">
        Flick-snap: drag the block, release with velocity. Decay first, then snaps to nearest 60-px grid cell.
      </span>
      <FlickSnapPanel animator={animator} />
    </div>
  );
}
