import { useMemo, useState } from 'react';
import { IDENTITY_POSE_COMPOSITION, SceneCanvas, defineTool, useScene } from '@weasel-js/core';
import {
  CURSOR_MAX_CSS_PX,
  cursorFor,
  cursorGlyph,
  cursorVariants,
  resolveCursorTier,
  type CursorVariant,
} from '@weasel-js/cursor';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import s from './CursorDemo.module.css';
import { DemoStage } from './DemoStage';

const W = 620, H = 300;
const VARIANTS = cursorVariants();
const FALLBACK = 'crosshair';

/** The data URI inside a baked cursor value, to show the shipped asset as an image. */
const assetOf = (css: string) => css.slice(css.indexOf('url("') + 5, css.indexOf('") '));

function Tile({ variant, selected, onSelect }: {
  variant: CursorVariant;
  selected: boolean;
  onSelect: (variant: CursorVariant) => void;
}) {
  const glyph = cursorGlyph(variant.glyph, { mark: variant.mark });
  const css = cursorFor(variant.glyph, { ...(variant.mark ? { mark: variant.mark } : {}), fallback: FALLBACK });
  const [hx, hy] = glyph.hotspot;
  return (
    <button
      type="button"
      className={selected ? `${s.tile} ${s.selected}` : s.tile}
      // The value is a data URI baked at runtime; no stylesheet can hold it.
      style={{ cursor: css }}
      aria-pressed={selected}
      onClick={() => onSelect(variant)}
    >
      <svg className={s.glyph} viewBox={`0 0 ${glyph.box} ${glyph.box}`} aria-hidden>
        <image href={assetOf(css)} width={glyph.box} height={glyph.box} />
        <circle className={s.hotspot} cx={hx} cy={hy} r={0.9} />
      </svg>
      <span className={s.name}>{variant.key}</span>
      <span className={s.coords}>{hx}, {hy}</span>
    </button>
  );
}

/**
 * The same glyph declared as a tool cursor at any size. Below the cap the
 * canvas gets a CSS `url()` cursor; above it `resolveCursorTier` answers
 * `painted`, the canvas's cursor goes to `none`, and the painted-cursor layer
 * draws the glyph under the pointer instead.
 */
export function CursorDemo() {
  const [variant, setVariant] = useState<CursorVariant>(VARIANTS.find((v) => v.key === 'pencil')!);
  const { glyph, mark } = variant;
  const [size, setSize] = useState(48);

  const scene = useScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  const tool = useMemo(
    () => defineTool({ id: 'cursor', cursor: { glyph, ...(mark ? { mark } : {}), size, fallback: FALLBACK } }),
    [glyph, mark, size],
  );
  const tier = resolveCursorTier({ glyph, size }).kind;

  return (
    <div className={s.demo}>
      <div className={s.gallery}>
        {VARIANTS.map((v) => (
          <Tile key={v.key} variant={v} selected={v.key === variant.key} onSelect={setVariant} />
        ))}
      </div>

      <div className={s.controls}>
        <label className={s.control}>
          Size
          <InlineRange
            min={16} max={256} step={1} value={size}
            className={s.slider}
            data-testid="size"
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className={s.readout}>{String(size).padStart(3, ' ')} px</span>
        </label>
        <span className={tier === 'css' ? s.tierCss : s.tierPainted}>
          {tier === 'css' ? 'CSS url() cursor' : `painted — past the ${CURSOR_MAX_CSS_PX}px cap`}
        </span>
      </div>

      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          tools={{ cursor: tool }}
          initialActiveTool="cursor"
        />
      </DemoStage>
    </div>
  );
}
