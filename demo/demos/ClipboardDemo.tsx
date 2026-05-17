import { useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useClipboard,
  useScene,
  useSceneAdapter,
  useSelection,
} from '@orochi235/weasel';
import type { ClipboardSnapshot, SceneNode } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
type RectNode = SceneNode<Rect, 'default', Rect>;

const W = 480, H = 320;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 160, y: 130, width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 280, y: 60,  width: 80, height: 60, color: '#8aa6c1' },
];

export function ClipboardDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection();
  const nextId = useRef(0);
  const dropPointRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Scene-backed adapter for the canvas (move/resize/area-select). The
  // clipboard adapter below extends it with cut/copy/paste plumbing — the
  // same adapter identity is fine for both because `useClipboard` only
  // touches snapshotSelection / commitPaste / insertNode / removeNode.
  const sceneAdapter = useSceneAdapter(scene, { selection });

  const clipboardAdapter = useMemo(() => ({
    ...sceneAdapter,
    snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
      items: ids
        .map((id) => scene.get(asNodeId(id)))
        .filter((n): n is RectNode => n != null)
        .map((n) => n.data),
    }),
    // commitPaste rebuilds a fresh leaf Node per clipped Rect, bumping ids
    // (deterministic `clip-N`) and translating by `offset` so each cascade is
    // visible. Returned nodes are handed to `scene.add` via `insertNode`.
    commitPaste: (
      clip: ClipboardSnapshot,
      offset: { dx: number; dy: number },
    ): RectNode[] => {
      const items = clip.items as Rect[];
      return items.map((src) => {
        const id = `clip-${nextId.current++}`;
        const pose: Rect = { ...src, id, x: src.x + offset.dx, y: src.y + offset.dy };
        return {
          kind: 'leaf',
          layer: 'default',
          id: asNodeId(id),
          pose,
          data: pose,
          parent: null,
        };
      });
    },
    getNode: (id: string) => scene.get(asNodeId(id)) ?? undefined,
    getNodeIndex: (id: string) => [...scene.renderOrder()].indexOf(asNodeId(id)),
    // 16 px cascade so each paste lands clearly offset from the previous.
    getPasteOffset: () => ({ dx: 16, dy: 16 }),
  }), [sceneAdapter, scene]);

  useClipboard<RectNode>(clipboardAdapter, {
    getSelection: () => selection.current.map((id) => asNodeId(id)),
    getDropPoint: () => dropPointRef.current,
  });

  const onMouseMove = (e: React.MouseEvent) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dropPointRef.current = {
      worldX: e.clientX - rect.left,
      worldY: e.clientY - rect.top,
    };
  };
  const onMouseLeave = () => { dropPointRef.current = null; };

  return (
    <div ref={wrapperRef} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        defaultTools={['select']}
      />
    </div>
  );
}
