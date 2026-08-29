import { useEffect, useRef, useState } from 'react';
import {
  SceneCanvas, useScene, renderSceneToPixels, defaultDrawOne, textCommand,
  registerCanvasFont,
  solid,
} from '@weasel-js/core';
import type { FillStyle, TextStyle, TextVerticalAlign, SceneViewDrawOne } from '@weasel-js/core';

const W = 480, H = 340;

// Exercise the dynamic canvas-SDF tier end-to-end: Arial has no baked atlas
// here, so it resolves through DynamicGlyphAtlas. (If Arial isn't installed,
// canvas fillText falls back to another face — the test only asserts that
// glyph ink renders, not which face.)
registerCanvasFont('Arial');

// `RECT_FALLBACK_PAINTER` (src/canvas/NodeShape.ts) reads `data.fill` and
// emits it over the pose AABB — no stroke — so that's the shape that
// guarantees a probe-able interior fill color rather than an outline.
//
// `text`/`style`/`verticalAlign` drive a second, box-aligned text node
// (see `drawOne` below). The generic `kit:text` painter forwards pose
// `height` but not `verticalAlign` (no data/style slot for it yet — see
// `NodeShape.ts`), so this demo builds that one node's command directly
// via the public `textCommand()` to exercise the renderer's box vertical
// alignment (`TextDrawCommand.height`/`verticalAlign`) end-to-end.
interface NodeData {
  fill?: FillStyle;
  text?: string;
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
}
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

// Rotation and per-node dimming are applied by the scene walk, not by
// `drawOne` — so the headless render and the on-screen canvas below it get
// them from the same place. `dimmed` is deliberately near-black so the
// multiplier is unmistakable against the white background.
const ALPHA_FOR = (id: string): number => (id === 'dimmed' ? 0.25 : 1);

const drawOne: SceneViewDrawOne<NodeData, LayerId, Pose> = (node, pose, view, ctx) => {
  const d = node.data;
  if (d.text != null) {
    return [textCommand(
      pose.x, pose.y, d.text, d.style, undefined, pose.height, d.verticalAlign,
      { fill: d.fill },
    )];
  }
  return defaultDrawOne(node, pose, view, ctx);
};

export function RenderToPixelsDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default',
        pose: { x: 40, y: 40, width: 120, height: 160 }, data: { fill: solid('#7fb069') } },
      { id: 'b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 180, y: 70, width: 120, height: 100 }, data: { fill: solid('#4a7fb0') } },
      { id: 'c' as never, kind: 'leaf', layer: 'default',
        pose: { x: 330, y: 50, width: 110, height: 140 }, data: { fill: solid('#d4a574') } },
      // Bottom strip, box-aligned text: box is much taller than one line of
      // text, `verticalAlign: 'bottom'` should push the glyphs to the
      // bottom of the box instead of the (legacy default) top.
      { id: 'd' as never, kind: 'leaf', layer: 'default',
        pose: { x: 10, y: 202, width: 460, height: 36 },
        data: { text: 'WWWWWWWWWWWWWWWW', style: { fontSize: 16 }, verticalAlign: 'bottom' } },
      // Dynamic canvas-SDF text (see registerCanvasFont above).
      { id: 'e' as never, kind: 'leaf', layer: 'default',
        pose: { x: 10, y: 4, width: 460, height: 32 },
        data: { text: 'Dynamic SDF 123', style: { fontFamily: 'Arial', fontSize: 22 } } },
      // Bottom band: rotation and per-node alpha, neither of which `drawOne`
      // knows about.
      { id: 'spun' as never, kind: 'leaf', layer: 'default',
        pose: { x: 40, y: 260, width: 60, height: 60, rotation: Math.PI / 4 },
        data: { fill: solid('#b04a7f') } },
      { id: 'dimmed' as never, kind: 'leaf', layer: 'default',
        pose: { x: 200, y: 260, width: 160, height: 60 }, data: { fill: solid('#000000') } },
    ],
  });
  const outRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState('rendering…');

  useEffect(() => {
    // Anisotropic on purpose: 2 px/unit horizontally, 1 px/unit vertically —
    // the label-print shape (full dot pitch across, squeezed vertically).
    const opts = {
      scene,
      sourceRect: { x: 0, y: 0, width: W, height: H },
      scale: { x: 2, y: 1 },
      background: '#ffffff',
      drawOne,
      alphaFor: ALPHA_FOR,
    } as const;
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
  }, [scene]);

  return (
    <div>
      <SceneCanvas
        width={W} height={H} className="ckd-canvas" scene={scene} toolBundle="minimal"
        alphaFor={ALPHA_FOR}
        layers={{ scene: { drawOne } }}
      />
      <p data-testid="rtp-readout">{readout}</p>
      <canvas ref={outRef} className="ckd-canvas" data-testid="rtp-output" />
    </div>
  );
}
