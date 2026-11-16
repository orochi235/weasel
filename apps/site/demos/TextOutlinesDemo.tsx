import { useEffect, useRef, useState } from 'react';
import { SceneCanvas, asNodeId, useScene, solid } from '@weasel-js/core';
import {
  registerCanvasFont, registerFontOutlines, outlineStatus,
} from '@weasel-js/font';
import { OUTLINE_MIN_SCREEN_PX } from '@weasel-js/core/renderer';
import type { RectPose, SceneCanvasApi, Stroke } from '@weasel-js/core';
import type { TextStyle } from '@weasel-js/text';
import { createTextPreset, type TextNodeData } from '@weasel-js/text-tools';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Field } from '@weasel-js/ui/components/Field';
import css from './TextOutlinesDemo.module.css';
import { DemoStage } from './DemoStage';
import { useVisiblePoll } from '../useVisiblePoll';

const W = 600, H = 300;
const TEXT = createTextPreset({ editor: false });

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
 *  SDF tier — can rasterize it, and only then enroll the family in that tier, so
 *  nothing is baked from a stand-in face. Idempotent across HMR re-evaluations. */
let facePromise: Promise<void> | null = null;
function loadDemoFace(): Promise<void> {
  facePromise ??= new FontFace(FAMILY, `url(${INTER_TTF})`).load().then((face) => {
    document.fonts.add(face);
    registerCanvasFont(FAMILY);
  });
  return facePromise;
}

type LayerId = 'default';

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
  id: asNodeId(n.id),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x: 20, y: n.y, width: 560, height: n.h },
  data: { text: n.text, style: style(n.size), fill: { paint: TEXT_FILL } },
}));

export function TextOutlinesDemo() {
  const scene = useScene<TextNodeData, LayerId, RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [outlines, setOutlines] = useState(true);
  const [stroked, setStroked] = useState(false);
  const [filled, setFilled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('loading');

  useEffect(() => { void loadDemoFace(); }, []);

  // Paint is the node's, not the style's. `null` is an explicit no-fill, the
  // same value every other node kind reads.
  useEffect(() => {
    scene.untracked(() => {
      for (const n of NODES) {
        scene.update(n.id, { data: { ...n.data, fill: filled ? n.data.fill : null, stroke: stroked ? DEMO_STROKE : undefined } });
      }
    });
  }, [scene, stroked, filled]);

  useEffect(() => {
    const off = outlines ? registerFontOutlines(FAMILY, VARIANT, INTER_TTF) : undefined;
    canvasRef.current?.requestRedraw();
    return off;
  }, [outlines]);
  // This poll drives only the readout, which has no other reason to re-render.
  useVisiblePoll(() => setStatus(outlines ? outlineStatus(FAMILY, 400, 'normal') ?? 'none' : 'off (canvas SDF)'), 200);

  return (
    <div>
      <div className={css.controls}>
        <Checkbox isSelected={outlines} data-testid="outline-toggle" onChange={setOutlines}>Outline tier</Checkbox>
        <Checkbox isSelected={stroked} data-testid="stroke-toggle" onChange={setStroked}>Stroke</Checkbox>
        <Checkbox isSelected={filled} data-testid="fill-toggle" onChange={setFilled}>Fill</Checkbox>
        <Field orientation="row" label="Zoom" output={`${zoom.toFixed(2)}×`}>
          <InlineRange
            className={css.zoom}
            min={1}
            max={8}
            step={0.25}
            value={zoom}
            aria-label="Zoom"
            data-testid="outline-zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </Field>
        <span data-testid="outline-status" className={css.status}>
          {status} · switches at {OUTLINE_MIN_SCREEN_PX}px on screen
        </span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          ref={canvasRef}
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          features={[TEXT]}
          view={{ x: 0, y: 0, scale: { x: zoom, y: zoom } }}
        />
      </DemoStage>
    </div>
  );
}
