import { useEffect, useRef } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  useSceneAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@weasel-js/core';
import type { FillStyle, SceneCanvasApi } from '@weasel-js/core';

interface Rect { id: string; x: number; y: number; width: number; height: number; fill: FillStyle }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, fill: { color: '#7fb069' } },
  { id: 'b', x: 150, y: 70,  width: 60, height: 60, fill: { color: '#d4a574' } },
  { id: 'c', x: 250, y: 50,  width: 80, height: 70, fill: { color: '#a48bd4' } },
  { id: 'd', x: 90,  y: 170, width: 60, height: 60, fill: { color: '#7ab8d4' } },
  { id: 'e', x: 220, y: 180, width: 90, height: 60, fill: { color: '#d47a7a' } },
];

function MultiSelectDemoInner() {
  const scene = useScene({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  // sceneToAdapter covers Move/Resize/Rotate AND AreaSelect — the marquee
  // hitTestArea/applyOps and selection get/set are kit-defaulted from the
  // scene + the selection passed in.
  const selectAdapter = useSceneAdapter(scene, { selection });

  // pickEvery / boundsOf default to a rect AABB scan over the adapter —
  // no boilerplate needed for the common rect-pose case.
  const select = useSelectTool(selectAdapter, {
    // Marquee is opt-in at the kit level — restored here because the demo's
    // whole point is multi-selection.
  });
  const tools = useTools({ active: 'select', registry: { select } });

  // Cmd/Ctrl+A is auto-registered by SceneCanvas's default actions.

  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useEffect(() => {
    canvasRef.current?.element?.focus();
  }, []);

  return (
    <SceneCanvas
      ref={canvasRef}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      tools={tools}
    />
  );
}

export function MultiSelectDemo() {
  return <WeaselProvider><MultiSelectDemoInner /></WeaselProvider>;
}
