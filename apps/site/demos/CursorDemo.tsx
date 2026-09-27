import { useMemo, useState } from 'react';
import { SceneCanvas, defineTool, useScene } from '@weasel-js/core';
import {
  CURSOR_MAX_CSS_PX,
  GLYPHS,
  cursorFor,
  resolveCursorTier,
  type CursorGlyphName,
} from '@weasel-js/cursor';
import s from './CursorDemo.module.css';

const W = 620, H = 300;
const NAMES = Object.keys(GLYPHS) as CursorGlyphName[];
const FALLBACK = 'crosshair';

/** The data URI inside a baked cursor value, to show the shipped asset as an image. */
const assetOf = (css: string) => css.slice(css.indexOf('url("') + 5, css.indexOf('") '));

function Tile({ name, selected, onSelect }: {
  name: CursorGlyphName;
  selected: boolean;
  onSelect: (name: CursorGlyphName) => void;
}) {
  const glyph = GLYPHS[name];
  const css = cursorFor(name, { fallback: FALLBACK });
  const [hx, hy] = glyph.hotspot;
  return (
    <button
      type="button"
      className={selected ? `${s.tile} ${s.selected}` : s.tile}
      // The value is a data URI baked at runtime; no stylesheet can hold it.
      style={{ cursor: css }}
      aria-pressed={selected}
      onClick={() => onSelect(name)}
    >
      <svg className={s.glyph} viewBox={`0 0 ${glyph.box} ${glyph.box}`} aria-hidden>
        <image href={assetOf(css)} width={glyph.box} height={glyph.box} />
        <circle className={s.hotspot} cx={hx} cy={hy} r={0.9} />
      </svg>
      <span className={s.name}>{name}</span>
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
  const [glyph, setGlyph] = useState<CursorGlyphName>('pencil');
  const [size, setSize] = useState(48);

  const scene = useScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  const tool = useMemo(
    () => defineTool<null>({ id: 'cursor', cursor: { glyph, size, fallback: FALLBACK } }),
    [glyph, size],
  );
  const tier = resolveCursorTier({ glyph, size }).kind;

  return (
    <div className={s.demo}>
      <div className={s.gallery}>
        {NAMES.map((n) => (
          <Tile key={n} name={n} selected={n === glyph} onSelect={setGlyph} />
        ))}
      </div>

      <div className={s.controls}>
        <label className={s.control}>
          Size
          <input
            type="range" min={16} max={256} step={1} value={size}
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

      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        backgroundFill={{ color: '#ffffff' }}
        scene={scene}
        tools={{ cursor: tool }}
        initialActiveTool="cursor"
      />
    </div>
  );
}
