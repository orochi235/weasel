import { useMemo, useRef } from 'react';
import {
  animateLifecycle,
  animateOnSetPose,
  asNodeId,
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

export function AnimationDemo() {
  const scene = useScene<Card>({ items: INITIAL });
  const selection = useSelection();
  const animator = useAnimator();
  const nextId = useRef(1);

  const baseAdapter = useMemo(() => {
    const base = sceneToAdapter(scene, { selection });
    return {
      ...base,
      // animateLifecycle/animateOnSetPose call insertNode with a {id, ...} card
      // shape and read getPose immediately. Scene mutations are synchronous
      // over a mutable store, so scene.get(id) works the next line over.
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
          // Keep flicked cards on the canvas. Bounds are on the card's
          // top-left corner; subtract typical card dimensions (60×60) so
          // the right and bottom edges stop at the visible boundary too.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</button>
        <button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</button>
        <button onClick={addCard}>Add card</button>
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
            drawOne: (_n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: (p as Card).color },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
