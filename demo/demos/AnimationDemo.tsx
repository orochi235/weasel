import { useEffect, useMemo, useRef, useState } from 'react';
import {
  animateLifecycle,
  animateOnSetPose,
  asNodeId,
  easeInOutSine,
  momentum,
  SceneCanvas,
  sceneToAdapter,
  useAnimator,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

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

// Flick-snap panel: a separate 2D-point physics demo (decay → snap) parked
// below the card canvas. Snap grid spacing in panel units.
const FLICK_W = 600, FLICK_H = 160;
const FLICK_GRID = 60;
const FLICK_BLOCK = 40;

interface Vec2 { x: number; y: number }
const v2 = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k }),
  mag: (v: Vec2): number => Math.hypot(v.x, v.y),
};

function nearestGridCell(p: Vec2): Vec2 {
  const round = (v: number) => Math.round(v / FLICK_GRID) * FLICK_GRID;
  return {
    x: Math.max(0, Math.min(FLICK_W - FLICK_BLOCK, round(p.x))),
    y: Math.max(0, Math.min(FLICK_H - FLICK_BLOCK, round(p.y))),
  };
}

export function AnimationDemo() {
  const scene = useScene<Card>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const animator = useAnimator();
  const nextId = useRef(1);

  // Per-card visual effects (multiplicative scale + alpha). Read by drawOne,
  // mutated by breathing-loop / stagger-fade onTick. A ref so onTick writes
  // don't churn React state, paired with a tick counter to nudge re-renders
  // when SceneCanvas isn't already redrawing from pose changes.
  const effects = useRef<Map<string, { scale: number; alpha: number }>>(new Map());
  const getEffect = (id: string) => {
    let e = effects.current.get(id);
    if (!e) { e = { scale: 1, alpha: 1 }; effects.current.set(id, e); }
    return e;
  };
  const [, bumpTick] = useState(0);
  const tick = () => bumpTick(t => (t + 1) & 0xffff);

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

  const baseAdapter = useMemo(() => {
    const base = sceneToAdapter(scene, { selection });
    return {
      ...base,
      insertNode: (card: Card) => {
        scene.add({
          kind: 'leaf',
          layer: 'default',
          pose: card,
          data: card,
          id: asNodeId(card.id),
        });
      },
      removeNode: (id: string) => {
        scene.remove(asNodeId(id));
      },
      hitTest: (worldX: number, worldY: number): string | null => {
        const order = [...scene.renderOrder()];
        for (let i = order.length - 1; i >= 0; i--) {
          const n = scene.get(order[i]);
          if (!n) continue;
          const p = n.pose as Pose;
          if (worldX >= p.x && worldX <= p.x + p.width && worldY >= p.y && worldY <= p.y + p.height) {
            return order[i];
          }
        }
        return null;
      },
      snapshotSelection: () => ({ items: [] }),
    };
  }, [scene, selection]);

  const adapter = useMemo(
    () =>
      animateLifecycle<Card, Pose>(
        animateOnSetPose<Card, Pose>(baseAdapter as never, animator, { ms: 250 }),
        animator,
        {
          enterFrom: (p: Pose) => ({ ...p, width: 0, height: 0 }),
          exitTo: (p: Pose) => ({ ...p, width: 0, height: 0 }),
          ms: 250,
        },
      ),
    [baseAdapter, animator],
  );

  const select = useSelectTool<Card, Pose>(adapter as never, {
    move: {
      behaviors: [
        momentum<Pose>({
          animator,
          friction: 0.93,
          bounds: { x: 0, y: 0, width: W - 60, height: H - 60 },
        }),
      ],
    },
    drawGhost: (card, pose): DrawCommand[] => card == null ? [] : [{
      kind: 'path',
      path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
      fill: { color: (card as unknown as Card).color },
    }],
  });
  const tools = useTools({ active: 'select', registry: { select } });

  const tweenTo = (id: string, x: number, y: number) => {
    const node = scene.get(asNodeId(id));
    if (!node) return;
    const p = node.pose as Pose;
    adapter.setPose(id, { x, y, width: p.width, height: p.height });
  };

  const addCard = () => {
    const id = `n${nextId.current++}`;
    adapter.insertNode({
      id,
      x: 200 + Math.random() * 100,
      y: 250,
      width: 60,
      height: 60,
      color: CARD_FILL,
    } as Card);
  };

  // --- Breathing handle: pulse alpha on the (single) selected card. ---
  // Cancels and rebuilds when the selection changes. Loop handles are not
  // animator-id-registered, so we cancel via the local handle.
  const selectedIds = selection.current;
  const breathingFocus = selectedIds.length === 1 ? (selectedIds[0] as string) : null;
  useEffect(() => {
    if (!breathingFocus) return;
    const id = breathingFocus;
    getEffect(id); // ensure entry exists
    const handle = animator.tweenLoop<number>({
      from: 1.0,
      to: 1.06,
      ms: 800,
      direction: 'alternate',
      easing: easeInOutSine,
      onTick: (v) => {
        const e = getEffect(id);
        e.scale = v;
        // alpha pulse alongside scale — subtle glow effect.
        e.alpha = 0.85 + (v - 1.0) * 2.5;
        tick();
      },
    });
    return () => {
      handle.cancel();
      const e = effects.current.get(id);
      if (e) { e.scale = 1; e.alpha = 1; }
      tick();
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
      adapter.insertNode({
        id,
        x: 60 + i * 100,
        y: 320,
        width: 60,
        height: 50,
        color: CARD_FILL,
      } as Card);
    }
    animator.stagger(newIds, 50).tween<number>({
      from: 0.3,
      to: 1,
      ms: 300,
      onTick: (v, id) => {
        const e = getEffect(id);
        e.alpha = v;
        tick();
      },
    });
  };

  // --- Flick-snap panel: drag a block, on release decay with velocity,
  //     then mid-flight retarget to the nearest grid cell. ---
  const [flickPos, setFlickPos] = useState<Vec2>({ x: 60, y: 60 });
  const flickPosRef = useRef(flickPos);
  flickPosRef.current = flickPos;
  const flickHandleRef = useRef<{ cancel: () => void } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    offset: Vec2;
    lastPos: Vec2;
    lastT: number;
    velocity: Vec2;
  } | null>(null);

  const onFlickPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    flickHandleRef.current?.cancel();
    flickHandleRef.current = null;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const local = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    dragStateRef.current = {
      pointerId: ev.pointerId,
      offset: { x: local.x - flickPosRef.current.x, y: local.y - flickPosRef.current.y },
      lastPos: local,
      lastT: performance.now(),
      velocity: { x: 0, y: 0 },
    };
  };

  const onFlickPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== ev.pointerId) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const local = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const now = performance.now();
    const dt = Math.max(1, now - st.lastT);
    // px/sec
    st.velocity = {
      x: ((local.x - st.lastPos.x) / dt) * 1000,
      y: ((local.y - st.lastPos.y) / dt) * 1000,
    };
    st.lastPos = local;
    st.lastT = now;
    setFlickPos({ x: local.x - st.offset.x, y: local.y - st.offset.y });
  };

  const onFlickPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== ev.pointerId) return;
    dragStateRef.current = null;
    const start = flickPosRef.current;
    const velocity = st.velocity;
    const handle = animator.physics<Vec2>({
      from: start,
      to: null, // start in decay mode
      velocity,
      damping: 5,
      stiffness: 80,
      add: v2.add,
      subtract: v2.sub,
      scale: v2.scale,
      magnitude: v2.mag,
      onTick: (p) => setFlickPos(p),
    });
    flickHandleRef.current = handle;
    // After a brief decay, retarget to the nearest grid cell of the
    // current (in-flight) position.
    setTimeout(() => {
      const snap = nearestGridCell(flickPosRef.current);
      handle.setTarget(snap);
    }, 180);
  };

  useEffect(() => () => { flickHandleRef.current?.cancel(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</button>
        <button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</button>
        <button onClick={addCard}>Add card</button>
        <button onClick={addBatch}>Add 5 (staggered fade-in)</button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onTogglePause}>{paused ? 'Resume' : 'Pause'} animations</button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          time-scale: {timeScale.toFixed(2)}×
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={timeScale}
            onChange={(e) => onTimeScale(Number(e.target.value))}
          />
        </label>
        <span style={{ opacity: 0.7 }}>Tip: select one card to see the breathing pulse.</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        tools={tools}
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
                fill: { color: (p as Card).color, opacity: e.alpha },
              }];
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ opacity: 0.7 }}>
          Flick-snap: drag the block, release with velocity. Decay first, then snaps to nearest 60-px grid cell.
        </span>
        <div
          onPointerDown={onFlickPointerDown}
          onPointerMove={onFlickPointerMove}
          onPointerUp={onFlickPointerUp}
          onPointerCancel={onFlickPointerUp}
          style={{
            position: 'relative',
            width: FLICK_W,
            height: FLICK_H,
            background: '#14100b',
            border: '1px solid #4a3c2e',
            backgroundImage:
              'linear-gradient(to right, #2a2018 1px, transparent 1px),' +
              'linear-gradient(to bottom, #2a2018 1px, transparent 1px)',
            backgroundSize: `${FLICK_GRID}px ${FLICK_GRID}px`,
            touchAction: 'none',
            userSelect: 'none',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: flickPos.x,
              top: flickPos.y,
              width: FLICK_BLOCK,
              height: FLICK_BLOCK,
              background: '#7fb069',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
