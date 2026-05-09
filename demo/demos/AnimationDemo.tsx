import { useMemo, useRef, useState } from 'react';
import {
  animateLifecycle,
  animateOnSetPose,
  arrayAdapter,
  Canvas,
  momentum,
  useAnimator,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

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

export function AnimationDemo() {
  const backend = useBackend();
  const [cards, setCards] = useState<Card[]>(INITIAL);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const nextId = useRef(1);
  const selection = useSelection();
  const animator = useAnimator();

  const baseAdapter = useMemo(() => ({
    ...arrayAdapter<Card, Pose>({
      ref: cardsRef,
      setItems: setCards,
      toPose: (c) => ({ x: c.x, y: c.y, width: c.width, height: c.height }),
    }),
    ...selection.adapterMethods,
    insertObject: (obj: Card) => {
      // Mutate the live ref synchronously so wrappers that read getPose
      // immediately after insertObject (e.g. animateLifecycle) see the new
      // object before React state catches up.
      cardsRef.current = [...cardsRef.current, obj];
      setCards(cardsRef.current);
    },
    removeObject: (id: string) => {
      cardsRef.current = cardsRef.current.filter((c) => c.id !== id);
      setCards(cardsRef.current);
    },
    hitTestArea: (r: Pose) =>
      cardsRef.current
        .filter((o) => o.x < r.x + r.width && o.x + o.width > r.x && o.y < r.y + r.height && o.y + o.height > r.y)
        .map((o) => o.id),
    snapshotSelection: () => ({ items: [] }),
  }), [selection.adapterMethods]);

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
    pickEvery: (wx, wy) =>
      cardsRef.current
        .filter((c) => wx >= c.x && wx <= c.x + c.width && wy >= c.y && wy <= c.y + c.height)
        .map((c) => c.id),
    boundsOf: (id) => {
      const c = cardsRef.current.find((x) => x.id === id);
      return c ? { x: c.x, y: c.y, width: c.width, height: c.height } : null;
    },
    move: {
      behaviors: [momentum<Pose>({ animator, friction: 0.93 })],
    },
    drawGhost: (ctx, card, pose) => {
      if (!card) return;
      ctx.fillStyle = card.color;
      ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
    },
    drawGhostGL: (card, pose): DrawCommand[] => card == null ? [] : [{
      kind: 'path',
      path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
      fill: { color: card.color },
    }],
    getObject: (id) => cardsRef.current.find((c) => c.id === id) ?? null,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  const tweenTo = (id: string, x: number, y: number) => {
    const c = cardsRef.current.find((s) => s.id === id);
    if (!c) return;
    adapter.setPose(id, { x, y, width: c.width, height: c.height });
  };

  const addCard = () => {
    const id = `n${nextId.current++}`;
    adapter.insertObject({
      id,
      x: 200 + Math.random() * 100,
      y: 250,
      width: 60,
      height: 60,
      color: CARD_FILL,
    } as Card);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</button>
        <button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</button>
        <button onClick={addCard}>Add card</button>
      </div>
      <Canvas
backend={backend}
              width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter as never}
        selection={selection}
        tools={tools}
        layers={{
          scene: {
            drawOne: (cx, c: Card, p: Pose) => {
              cx.fillStyle = c.color;
              cx.fillRect(p.x, p.y, p.width, p.height);
            },
            drawOneGL: (c: Card, p: Pose): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: c.color },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}

export const ANIMATION_DEMO_SOURCE = `// Wrap a base adapter with animateLifecycle + animateOnSetPose so
// programmatic setPose tweens, and inserts/removes fade by scaling
// from/to width:0,height:0. Plug \`momentum\` into the move tool's
// behavior list to get flick-and-decay on drag release.

const animator = useAnimator();

const adapter = useMemo(
  () =>
    animateLifecycle(
      animateOnSetPose(baseAdapter, animator, { ms: 250 }),
      animator,
      {
        enterFrom: (p) => ({ ...p, width: 0, height: 0 }),
        exitTo:    (p) => ({ ...p, width: 0, height: 0 }),
        ms: 250,
      },
    ),
  [baseAdapter, animator],
);

const select = useSelectTool(adapter, {
  // ...
  move: { behaviors: [momentum({ animator, friction: 0.93 })] },
});
`;
