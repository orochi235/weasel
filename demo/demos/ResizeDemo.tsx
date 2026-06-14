import { asNodeId, SceneCanvas, useScene } from '@weasel-js/core';

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
      // This demo is solely about resize handles. Keybinds and click-to-deselect
      // only muddy the story, so drop both: no hotkey routing, and the rect
      // stays selected (clearSelection unregistered).
      enableKeybindings={false}
      actions={{ clearSelection: null }}
    />
  );
}
