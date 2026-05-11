import { asNodeId, SceneCanvas, useScene } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;

const INITIAL: Rect = { id: 'r', x: 100, y: 80, width: 180, height: 130, color: '#7fb069' };

export function ResizeDemo() {
  const scene = useScene({ items: [INITIAL] });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectionOptions={{ initial: [asNodeId(INITIAL.id)] }}
    />
  );
}
