import { useEffect, useRef, useState } from 'react';
import { SceneCanvas, useScene, defaultDrawOne, textCommand, solid } from '@weasel-js/core';
import {
  registerCanvasFont, registerFontOutlines, unregisterFontOutlines, outlineStatus,
} from '@weasel-js/font';
import { OUTLINE_MIN_SCREEN_PX } from '@weasel-js/core/renderer';
import type { SceneCanvasApi, SceneViewDrawOne, Stroke, TextStyle, Fill } from '@weasel-js/core';
import { DemoStage } from './DemoStage';

const W = 600, H = 300;

/**
 * The subset Inter that ships beside the baked atlas. Loaded twice, deliberately: once as a CSS
 * `FontFace` under a name of its own, and once as outline bytes for that same name, so both tiers
 * serve the identical typeface — the dynamic canvas-SDF tier rasterizes through `fillText`, so it
 * renders whatever the browser has under that family name.
 */
const INTER_TTF = `${import.meta.env.BASE_URL}inter/inter.ttf`;
const FAMILY = 'Weasel Outline Demo';
const VARIANT = { weight: 400, style: 'normal' } as const;

/** Load the face into the document so canvas 2D — and therefore the dynamic
 *  SDF tier — can rasterize it. Idempotent across HMR re-evaluations. */
let facePromise: Promise<void> | null = null;
function loadDemoFace(): Promise<void> {
  facePromise ??= new FontFace(FAMILY, `url(${INTER_TTF})`).load().then((face) => {
    document.fonts.add(face);
    registerCanvasFont(FAMILY);
  });
  return facePromise;
}

interface NodeData { text: string; style: TextStyle; fill: Fill }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const style = (fontSize: number): TextStyle => ({ fontSize, fontFamily: FAMILY });

const TEXT_FILL = solid('#1a1a1a');

/**
 * Round joins because a glyph's outline has corners sharper than any miter limit flatters. 2
 * world units is a hairline on the 96px line and a heavy slab on the 13px one: stroke width is a
 * world measure and does not scale with the type.
 */
const DEMO_STROKE: Stroke = {
  paint: solid('#c0392b'),
  width: 2,
  join: 'round',
  cap: 'round',
};

const NODES = [
  { id: 'a', text: 'Ramble 96', size: 96, y: 24, h: 130 },
  { id: 'b', text: 'Handgloves at 28', size: 28, y: 170, h: 44 },
  { id: 'c', text: 'Handgloves at 13', size: 13, y: 228, h: 24 },
].map((n) => ({
  id: n.id as never,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 20, y: n.y, width: 560, height: n.h },
  data: { text: n.text, style: style(n.size), fill: { paint: TEXT_FILL } },
}));

const makeDrawOne = (
  ready: boolean,
  stroked: boolean,
  filled: boolean,
): SceneViewDrawOne<NodeData, LayerId, Pose> =>
  (node, pose, view, ctx) => {
    if (!ready) return [];
    if (!node.data.text) return defaultDrawOne(node, pose, view, ctx);
    // Paint is the node's, not the style's. `null` is an explicit no-fill, the same value
    // every other node kind reads.
    return [textCommand(
      pose.x, pose.y, node.data.text, node.data.style,
      undefined, undefined, undefined,
      { fill: filled ? node.data.fill : null, stroke: stroked ? DEMO_STROKE : undefined },
    )];
  };

/**
 * The outline text tier against the distance field it replaces.
 *
 * Both sides of the toggle draw the same face at the same size in the same place. Unchecked,
 * glyphs come from the dynamic canvas-SDF tier: a single-channel field baked at 48px, accurate
 * near the bake size and increasingly not above it. Checked, the same glyphs are real outlines
 * tessellated in em space, which has no size to be near.
 *
 * The line positions do not move while you toggle, because the tier decides how a glyph is
 * painted and never where it sits — advances, kerning, and line breaking still come from the SDF
 * tier either way. That invariant is what lets the threshold depend on zoom without text
 * reflowing under the cursor.
 */
export function TextOutlinesDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [outlines, setOutlines] = useState(true);
  const [stroked, setStroked] = useState(false);
  const [filled, setFilled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('loading');
  // Nothing is drawn until the face is in the document. Not cosmetic: the
  // canvas-SDF tier bakes from `fillText`, so a glyph requested before the
  // face resolves would be rasterized from whatever the browser substituted
  // and then cached under this family's name for the rest of the session.
  const [faceReady, setFaceReady] = useState(false);

  useEffect(() => {
    let live = true;
    void loadDemoFace().then(() => {
      if (!live) return;
      setFaceReady(true);
      canvasRef.current?.requestRedraw();
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (outlines) registerFontOutlines(FAMILY, VARIANT, INTER_TTF);
    else unregisterFontOutlines(FAMILY, VARIANT);
    canvasRef.current?.requestRedraw();
    // This poll drives only the readout, which has no other reason to re-render.
    const id = setInterval(() => {
      setStatus(outlines ? outlineStatus(FAMILY, 400, 'normal') ?? 'none' : 'off (canvas SDF)');
    }, 200);
    return () => clearInterval(id);
  }, [outlines]);

  return (
    <div style={{ position: 'relative', width: 'min-content' }}>
      <label style={{ display: 'block', marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={outlines}
          data-testid="outline-toggle"
          onChange={(e) => setOutlines(e.target.checked)}
        />
        {' '}Outline tier
        <span data-testid="outline-status" style={{ marginLeft: 12, opacity: 0.6 }}>
          {status} · switches at {OUTLINE_MIN_SCREEN_PX}px on screen
        </span>
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={stroked}
          data-testid="stroke-toggle"
          onChange={(e) => setStroked(e.target.checked)}
        />
        {' '}Stroke
        <span style={{ marginLeft: 12, opacity: 0.6 }}>
          only glyphs on the outline tier can be stroked — a distance field has
          no geometry to stroke, so the small line stays bare until you zoom it
          past the threshold
        </span>
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={filled}
          data-testid="fill-toggle"
          onChange={(e) => setFilled(e.target.checked)}
        />
        {' '}Fill
        <span style={{ marginLeft: 12, opacity: 0.6 }}>
          off is `data.fill: null` — the same explicit no-fill every other node
          kind reads. Turn it off with the stroke on for outline-only display
          type; with both off the glyphs have no paint at all and nothing draws
        </span>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Zoom{' '}
        <input
          type="range"
          min={1}
          max={8}
          step={0.25}
          value={zoom}
          data-testid="outline-zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ verticalAlign: 'middle', width: 200 }}
        />
        <span style={{ marginLeft: 8, opacity: 0.6 }}>{zoom.toFixed(2)}×</span>
      </label>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          ref={canvasRef}
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          view={{ x: 0, y: 0, scale: { x: zoom, y: zoom } }}
          layers={{ scene: { drawOne: makeDrawOne(faceReady, stroked, filled) } }}
        />
      </DemoStage>
    </div>
  );
}
