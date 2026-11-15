import { useEffect, useRef, useState } from 'react';
import {
  asNodeId,
  SceneCanvas, useScene, renderSceneToPixels,
  registerCanvasFont, warmRender,
  solid,
} from '@weasel-js/core';
import type { TextStyle, TextVerticalAlign, Fill } from '@weasel-js/core';

const W = 480, H = 340;

// Arial has no baked atlas, so its text draws through the dynamic canvas-SDF tier.
registerCanvasFont('Arial');

interface NodeData {
  fill?: Fill;
  text?: string;
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
}
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

// The scene walk applies alpha and rotation, not the painter, so both renders get them from one place.
const ALPHA_FOR = (id: string): number => (id === 'dimmed' ? 0.25 : 1);

export function RenderToPixelsDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: asNodeId('a'), kind: 'mark', layer: 'default',
        pose: { x: 40, y: 40, width: 120, height: 160 }, data: { fill: { paint: solid('#7fb069') } } },
      { id: asNodeId('b'), kind: 'mark', layer: 'default',
        pose: { x: 180, y: 70, width: 120, height: 100 }, data: { fill: { paint: solid('#4a7fb0') } } },
      { id: asNodeId('c'), kind: 'mark', layer: 'default',
        pose: { x: 330, y: 50, width: 110, height: 140 }, data: { fill: { paint: solid('#d4a574') } } },
      { id: asNodeId('d'), kind: 'mark', layer: 'default',
        pose: { x: 10, y: 202, width: 460, height: 36 },
        data: { text: 'WWWWWWWWWWWWWWWW', style: { fontSize: 16 }, verticalAlign: 'bottom', fill: { paint: solid('#000') } } },
      { id: asNodeId('e'), kind: 'mark', layer: 'default',
        pose: { x: 10, y: 4, width: 460, height: 32 },
        data: { text: 'Dynamic SDF 123', style: { fontFamily: 'Arial', fontSize: 22 }, fill: { paint: solid('#000') } } },
      { id: asNodeId('spun'), kind: 'mark', layer: 'default',
        pose: { x: 40, y: 260, width: 60, height: 60, rotation: Math.PI / 4 },
        data: { fill: { paint: solid('#b04a7f') } } },
      { id: asNodeId('dimmed'), kind: 'mark', layer: 'default',
        pose: { x: 200, y: 260, width: 160, height: 60 }, data: { fill: { paint: solid('#000000') } } },
    ],
  });
  const outRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState('rendering…');

  useEffect(() => {
    // Anisotropic on purpose: the shape of a label printer's dot pitch.
    const opts = {
      scene,
      sourceRect: { x: 0, y: 0, width: W, height: H },
      scale: { x: 2, y: 1 },
      background: '#ffffff',
      alphaFor: ALPHA_FOR,
    } as const;
    let live = true;
    // The render is synchronous, so a font or paint kind still loading would draw nothing.
    void warmRender({ render: opts }).catch(() => {}).then(() => {
      if (!live) return;
      const first = renderSceneToPixels(opts);
      const second = renderSceneToPixels(opts);
      const identical =
        first.data.length === second.data.length &&
        first.data.every((v, i) => v === second.data[i]);

      const out = outRef.current;
      if (out) {
        out.width = first.width;
        out.height = first.height;
        out.getContext('2d')?.putImageData(
          new ImageData(Uint8ClampedArray.from(first.data), first.width, first.height), 0, 0);
      }
      setReadout(`headless ${first.width}×${first.height} px · identical: ${identical ? 'yes' : 'no'}`);
    });
    return () => { live = false; };
  }, [scene]);

  return (
    <div>
      <SceneCanvas
        width={W} height={H} className="ckd-canvas" scene={scene}
        alphaFor={ALPHA_FOR}
      />
      <p data-testid="rtp-readout">{readout}</p>
      <canvas ref={outRef} className="ckd-canvas" data-testid="rtp-output" />
    </div>
  );
}
