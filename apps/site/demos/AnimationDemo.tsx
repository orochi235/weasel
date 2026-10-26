import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  createTransformOp,
  easeInOutSine,
  momentum,
  SceneCanvas,
  WeaselProvider,
  useAnimatedReflow,
  useScene,
  useSelection,
  useVelocityTracker,
} from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import { createGridLayer } from '@weasel-js/guides';
import type { Dims, MoveBehavior, PoseTransitionSeat } from '@weasel-js/core';
import type { AnimationInfo, Animator, LiveAnimation, PhysicsHandle } from '@weasel-js/animator';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import styles from './AnimationDemo.module.css';
import num from '@weasel-js/theme/numeric.module.css';
import { DemoStage } from './DemoStage';

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

// Flick-snap panel: a second canvas below the cards, showing decay → snap.
const FLICK_W = 600, FLICK_H = 160;
const FLICK_GRID = 60;

const FLICK_GRID_LAYER = createGridLayer({ spacing: FLICK_GRID });
const FLICK_BLOCK = 40;
const FLICK_COAST_MS = 180;

interface Vec2 { x: number; y: number }
const v2 = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  subtract: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k }),
  magnitude: (v: Vec2): number => Math.hypot(v.x, v.y),
};

function nearestGridCell(p: Vec2, area: Dims): Vec2 {
  const round = (v: number) => Math.round(v / FLICK_GRID) * FLICK_GRID;
  return {
    x: Math.max(0, Math.min(area.width - FLICK_BLOCK, round(p.x))),
    y: Math.max(0, Math.min(area.height - FLICK_BLOCK, round(p.y))),
  };
}

export function AnimationCards({ animator }: { animator: Animator }) {
  const scene = useScene<Card>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
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

  // --- Time-scale + pause ---
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

  // --- Breathing handle: pulse alpha on the (single) selected card. ---
  // Cancels and rebuilds when the selection changes. Loop handles are not
  // animator-id-registered, so we cancel via the local handle.
  const selectedIds = selection.current;
  const breathingFocus = selectedIds.length === 1 ? (selectedIds[0] as string) : null;
  useEffect(() => {
    if (!breathingFocus) return;
    const id = breathingFocus;
    const effectsMap = effects.current;
    getEffect(id); // ensure entry exists
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
        // alpha pulse alongside scale — subtle glow effect.
        e.alpha = 0.85 + (v - 1.0) * 2.5;
      },
    });
    return () => {
      handle.cancel();
      const e = effectsMap.get(id);
      if (e) { e.scale = 1; e.alpha = 1; }
    };
  }, [breathingFocus, animator]);

  // --- Stagger fade-in: add a batch of 5 cards, fade them in 50ms apart. ---
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</Button>
        <Button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</Button>
        <Button onClick={addCard}>Add card</Button>
        <Button onClick={addBatch}>Add 5 (staggered fade-in)</Button>
        <Button onClick={removeSelected} disabled={selection.current.length === 0}>Remove selected</Button>
        <Button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</Button>
        <Button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</Button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button onClick={onTogglePause}>{paused ? 'Resume' : 'Pause'} animations</Button>
        <label className="ckd-field">
          time-scale: <span className={num.numeric}>{timeScale.toFixed(2)}×</span>
          <InlineRange
            min={0}
            max={2}
            step={0.05}
            value={timeScale}
            onChange={(e) => onTimeScale(Number(e.target.value))}
          />
        </label>
        <span style={{ opacity: 0.7 }}>Tip: select one card to see the breathing pulse.</span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={['pick', 'move']}
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

/**
 * Move behavior: on release, coast on the flick velocity, then retarget the
 * same in-flight physics to the nearest grid cell. One animation throughout —
 * `PhysicsHandle.setTarget` turns the decay into a spring without restarting.
 */
function flickToGrid(args: {
  animator: Animator;
  tracker: ReturnType<typeof useVelocityTracker>;
  flight: React.MutableRefObject<PhysicsHandle<Vec2> | null>;
  area: () => Dims;
}): MoveBehavior<Pose> {
  const { animator, tracker, flight, area } = args;
  const PREV = 'flickToGrid.prev';
  const pointer = (ctx: { pointer: { worldX: number; worldY: number } }): Vec2 =>
    ({ x: ctx.pointer.worldX, y: ctx.pointer.worldY });

  return {
    onStart(ctx) {
      flight.current?.cancel();
      flight.current = null;
      tracker.reset();
      ctx.scratch[PREV] = pointer(ctx);
    },
    onMove(ctx) {
      const prev = ctx.scratch[PREV] as Vec2;
      const now = pointer(ctx);
      tracker.record(now.x - prev.x, now.y - prev.y, performance.now());
      ctx.scratch[PREV] = now;
    },
    onEnd(ctx, end) {
      if (end.answered) return undefined;
      const id = ctx.draggedIds[0];
      const start = id ? ctx.current.get(id) : undefined;
      if (!id || !start) return undefined;

      let live: Vec2 = { x: start.x, y: start.y };
      const write = (p: Vec2) => {
        live = p;
        ctx.adapter.setPose(id, { ...start, x: p.x, y: p.y });
      };
      // A flick below the rest threshold finishes without ever ticking, so the
      // release pose has to be written before the physics starts.
      write(live);

      const { vx, vy } = tracker.getVelocity();
      const handle = animator.physics<Vec2>({
        from: live,
        to: null, // start in decay mode
        // useVelocityTracker reports px/ms; physics velocity is units/sec.
        velocity: { x: vx * 1000, y: vy * 1000 },
        damping: 5,
        stiffness: 80,
        ...v2,
        onTick: write,
        onDone: () => {
          flight.current = null;
          ctx.adapter.applyOps?.(
            [createTransformOp<Pose>({ id, from: start, to: { ...start, x: live.x, y: live.y } })],
            'flick',
          );
        },
      });
      flight.current = handle;
      // A newer flick, or the demo unmounting, has already canceled this one.
      setTimeout(() => {
        if (flight.current === handle) handle.setTarget(nearestGridCell(live, area()));
      }, FLICK_COAST_MS);
      return null;
    },
  };
}

function FlickSnapPanel({ animator }: { animator: Animator }) {
  const scene = useScene<{ color: string }, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      id: asNodeId('block'),
      kind: 'mark',
      layer: 'default',
      pose: { x: 60, y: 60, width: FLICK_BLOCK, height: FLICK_BLOCK },
      data: { color: '#7fb069' },
    }],
  });
  const selection = useSelection();
  const tracker = useVelocityTracker();
  const flight = useRef<PhysicsHandle<Vec2> | null>(null);
  const size = useRef<Dims>({ width: FLICK_W, height: FLICK_H });
  useEffect(() => () => {
    flight.current?.cancel();
    flight.current = null;
  }, []);

  const behaviors = useMemo(
    () => [flickToGrid({ animator, tracker, flight, area: () => size.current })],
    [animator, tracker],
  );

  // The demo site mounts one provider set at its root; isolated so this canvas
  // and the card canvas each keep their own selection.
  return (
    <WeaselProvider isolate>
      <DemoStage width={FLICK_W} height={FLICK_H}>
        <SceneCanvas features={['pick', 'move']}
          className="ckd-canvas"
          onResize={(s) => { size.current = s; }}
          scene={scene}
          selection={selection}
          selectTool={{ move: { behaviors } }}
          layers={{
            grid: { layer: FLICK_GRID_LAYER },
            scene: {
              drawOne: (n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { paint: { color: n.data.color } },
              }],
            },
            selectionOverlay: { handles: false },
          }}
        />
      </DemoStage>
    </WeaselProvider>
  );
}

const nameOf = (a: AnimationInfo): string => `#${a.id} ${a.kind} ${a.label ?? a.key ?? ''}`;

/** What the animator is running, from `live()`, and its last few lifecycle
 *  events, from `watch()`. Refreshed on the animator's own frames. */
function AnimatorWatch({ animator }: { animator: Animator }) {
  const [rows, setRows] = useState<LiveAnimation[]>([]);
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setRows(animator.live());
    const stopTick = animator.onTick(refresh);
    const stopWatch = animator.watch((e) => {
      if (e.type === 'fire' || e.type === 'lap') return;
      setLog((l) => [`${e.type.padEnd(9)} ${nameOf(e.animation)}`, ...l].slice(0, 8));
      refresh();
    });
    refresh();
    return () => { stopTick(); stopWatch(); };
  }, [animator]);
  return (
    <div className={styles.watch}>
      <div>
        <h4>live ({rows.length})</h4>
        <table>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{nameOf(a)}</td>
                <td className={styles.num}>{a.progress == null ? '' : `${(a.progress * 100).toFixed(0)}%`}</td>
                <td>{a.paused ? 'paused' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h4>events</h4>
        <ul className={styles.log}>{log.map((line, i) => <li key={i}>{line}</li>)}</ul>
      </div>
    </div>
  );
}

export function AnimationDemo() {
  const animator = useAnimator();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <WeaselProvider isolate><AnimationCards animator={animator} /></WeaselProvider>
      <AnimatorWatch animator={animator} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ opacity: 0.7 }}>
          Flick-snap: drag the block, release with velocity. Decay first, then snaps to nearest 60-px grid cell.
        </span>
        <FlickSnapPanel animator={animator} />
      </div>
    </div>
  );
}
