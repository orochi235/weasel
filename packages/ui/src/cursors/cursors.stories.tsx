/**
 * The `@weasel-js/cursor` catalog.
 *
 * Every image here is the shipped asset, not a redrawing of it: the sheets
 * pull the data URI straight back out of `bakeCursor`, and the painted row
 * runs `cursorPaintOps` + `cursorPaintMatrix`, which is what the canvas layer
 * calls. A story that redrew the glyphs would agree with the package right up
 * until it stopped.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  bakeCursor,
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
  CURSOR_ANGLE_STEPS,
  GLYPHS,
  type CursorGlyphName,
} from '@weasel-js/cursor';
import s from './cursors.stories.module.css';

const meta: Meta = { title: 'weasel-ui/cursors/Gallery' };
export default meta;

const NAMES = Object.keys(GLYPHS) as CursorGlyphName[];
/** The two the affordance layer bakes at an angle. */
const ROTATABLE: CursorGlyphName[] = ['resize', 'rotate'];

/** The `url("…")` payload of a baked cursor, for showing the asset as an image. */
function assetOf(name: CursorGlyphName, size: number, angle = 0): string {
  const css = bakeCursor(GLYPHS[name], { size, angle });
  return css.slice(css.indexOf('url("') + 5, css.indexOf('") '));
}

function Sheet({ size, proof }: { size: number; proof?: boolean }) {
  return (
    <div className={proof ? `${s.sheet} ${s.proof}` : s.sheet}>
      {NAMES.map((n) => (
        <figure key={n} className={s.cell}>
          <div className={s.grounds}>
            {(['white', 'dark', 'mid'] as const).map((g) => (
              <div key={g} className={`${s.ground} ${s[g]}`}>
                <img src={assetOf(n, size)} width={size} height={size} alt={`${n} cursor`} />
              </div>
            ))}
          </div>
          <figcaption className={s.caption}>{n}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * The size cursors actually ship at. `bakeCursor` defaults to 24 and nothing
 * in the kit asks for less, which is the size any new glyph has to survive.
 */
export const AtCursorSize: StoryObj = {
  render: () => (
    <div className={s.wrap}>
      <p className={s.note}>
        Each glyph over white paper, dark chrome and mid-tone artwork. The halo is
        not a separate drawing — every ink member is stroked in halo colour
        beneath its own fill, which is what makes one glyph legible on all three.
      </p>
      <Sheet size={24} />
    </div>
  ),
};

/**
 * Geometry check. CLAUDE.md ("Drawing icons") wants a glyph inspected at
 * 10–15× before anyone looks at it small; a join that does not meet is two
 * blurry pixels at cursor size and obvious here.
 */
export const AtProofSize: StoryObj = {
  render: () => (
    <div className={s.wrap}>
      <p className={s.note}>
        Proof size. This is the design surface — but it is not the check that
        decides a glyph. Run <code>npm run proof:pixels</code> for that: a 24px
        image inside a screenshot of this page has been resampled twice before
        you see it.
      </p>
      <Sheet size={96} proof />
    </div>
  ),
};

/**
 * Hotspots. Nothing on a page can show where a cursor points — only the real
 * OS cursor can, so this strip hands it to you and you aim it yourself.
 */
export const Hotspots: StoryObj = {
  render: () => {
    // Baked at runtime, so the value cannot be authored in the stylesheet.
    // One generated rule per glyph rather than an inline style per cell.
    const css = NAMES.map(
      (n) => `.cur-${n} { cursor: ${bakeCursor(GLYPHS[n], { fallback: 'crosshair' })}; }`,
    ).join('\n');
    return (
      <div className={s.wrap}>
        <style>{css}</style>
        <p className={s.note}>
          Hover each cell. The hotspot is the point the tool acts at — the tip of
          the pencil, the centre of the crosshair — and a wrong one is invisible
          everywhere except here.
        </p>
        <div className={s.live}>
          {NAMES.map((n) => (
            <div key={n} className={`${s.liveCell} cur-${n}`}>{n}</div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Every quantization step of the two glyphs the transform handles turn.
 * 22.5° steps: finer snaps visibly against a smoothly rotating selection,
 * coarser gains nothing, and 16 is the whole bake-cache bound.
 */
export const Rotations: StoryObj = {
  render: () => (
    <div className={s.wrap}>
      {ROTATABLE.map((n) => (
        <section key={n}>
          <h3 className={s.heading}>{n}</h3>
          <div className={s.angles}>
            {Array.from({ length: CURSOR_ANGLE_STEPS }, (_, i) => {
              const deg = (i * 360) / CURSOR_ANGLE_STEPS;
              return (
                <div key={i} className={s.angleCell}>
                  <img
                    src={assetOf(n, 48, (deg * Math.PI) / 180)}
                    width={48}
                    height={48}
                    alt={`${n} at ${deg} degrees`}
                  />
                  <span className={s.angleLabel}>{deg}°</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  ),
};

/**
 * The painted tier, drawn the way the canvas layer draws it.
 *
 * `brush` is sized in world units, so no CSS cursor can express it: the ring
 * has to measure the brush at every zoom. Note the line weight — it stays
 * chrome weight as the ring grows, because a ring at a 300px radius drawn with
 * a scaled stroke is a filled blob.
 */
export const PaintedTier: StoryObj = {
  render: () => {
    const glyph = GLYPHS.brush;
    return (
      <div className={s.wrap}>
        <p className={s.note}>
          A world-sized glyph escalates to the painted tier at every zoom level,
          and anything over 128 CSS px escalates too — above that the browser
          drops the image and silently falls back to the keyword. These are the
          same paint ops and the same placement matrix the canvas layer uses.
        </p>
        <div className={s.painted}>
          {[10, 24, 60, 120].map((worldRadius) => {
            const size = cursorWorldSize(glyph, worldRadius, 1);
            const ops = cursorPaintOps(glyph, {
              lineWidthScale: chromeLineWidthScale(glyph, size),
            });
            const side = Math.ceil(size) + 12;
            const m = cursorPaintMatrix(glyph, {
              size,
              at: { x: side / 2, y: side / 2 },
            });
            return (
              <svg key={worldRadius} width={side} height={side} aria-label={`brush at radius ${worldRadius}`}>
                <g transform={`matrix(${m.join(' ')})`}>
                  {ops.map((op, i) => (
                    <path
                      key={i}
                      d={op.d}
                      fill={op.fill ?? 'none'}
                      stroke={op.stroke?.color}
                      strokeWidth={op.stroke?.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              </svg>
            );
          })}
        </div>
      </div>
    );
  },
};
