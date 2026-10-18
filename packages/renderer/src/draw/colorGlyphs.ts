import { isSolidPaint } from '@weasel-js/paint';
import {
  colorPageTextureId, sharpColorPageTextureId, sharperColorGlyph, syncColorPageTexture, syncSharpColorPageTexture,
  DYNAMIC_PAGE_SIZE as PAGE_SIZE,
} from '@weasel-js/font';
import type { LaidOutGroup, LaidOutQuad } from '@weasel-js/text';
import type { ClipRect } from '../batchClip';
import type { DrawContext } from './drawContext';
import { enterUncut, leaveUncut } from './clip';
import { flushBatch } from './flushBatch';
import { solidColor, stageColorGlyphs } from './batch';
import { modelScale } from './modelScale';

/**
 * Stage one group of color glyphs: emoji, each a quad off a page of the
 * dynamic atlas that holds its own colors. They are sampled as an image is and
 * take nothing from the text's fill but its opacity, the way a browser paints
 * them. One drawn larger than its bake samples a sharper one where it has
 * landed (`sharperColorGlyph`), over the same box.
 */
export function drawColorGlyphs(ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number): void {
  const fill = group.fill?.paint;
  if (fill === undefined || group.quads.length === 0) return;
  if (!syncColorPageTexture(ctx.textureCache, group.page)) return;
  const opacity = isSolidPaint(fill) ? solidColor(fill)[3] : 1;
  const baseId = colorPageTextureId(group.page);

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  // Device px per world unit; the bake is measured against device pixels.
  const devicePerCss = ctx.deviceWidth && ctx.widthCss ? ctx.deviceWidth / ctx.widthCss : 1;
  const toDevice = modelScale(m) * devicePerCss;
  let atlasId = baseId;
  let { slot, tint } = stageColorGlyphs(ctx, atlasId);
  const restage = (): void => {
    ({ slot, tint } = stageColorGlyphs(ctx, atlasId));
  };

  for (const base of group.quads) {
    const sharp = sharper(ctx, base, toDevice);
    const q = sharp?.quad ?? base;
    const id = sharp?.atlasId ?? baseId;
    if (id !== atlasId) {
      atlasId = id;
      restage();
    }
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      restage();
    }
    let cut: ClipRect | null | undefined;
    while (!batch.pushQuad(
      q.x0 + dx, q.y0 + dy, q.x1 - q.x0, q.y1 - q.y0, m,
      q.u0, q.v0, q.u1, q.v1, opacity * tint[3], slot, tint[0], tint[1], tint[2],
    )) {
      cut = enterUncut(ctx);
      restage();
    }
    if (cut !== undefined) {
      leaveUncut(ctx, cut);
      restage();
    }
  }
}

/**
 * `q` resampled from a sharper bake of its glyph, when it is drawn at
 * `toDevice` device px a world unit and one has landed; else null.
 */
function sharper(
  ctx: DrawContext, q: LaidOutQuad, toDevice: number,
): { quad: LaidOutQuad; atlasId: string } | null {
  const char = q.colorGlyph;
  if (!char || char.width === 0) return null;
  /** World units a base texel covers. */
  const texel = (q.x1 - q.x0) / char.width;
  const sharp = sharperColorGlyph(char, texel * toDevice);
  if (!sharp || !syncSharpColorPageTexture(ctx.textureCache, sharp.glyph.page)) return null;
  const g = sharp.glyph;
  const k = 2 ** sharp.level;
  const x0 = q.x0 + (g.xoffset - char.xoffset) * texel;
  const y0 = q.y0 + (g.yoffset - char.yoffset) * texel;
  return {
    quad: {
      x0, y0, x1: x0 + (g.width / k) * texel, y1: y0 + (g.height / k) * texel,
      u0: g.x / PAGE_SIZE, v0: g.y / PAGE_SIZE,
      u1: (g.x + g.width) / PAGE_SIZE, v1: (g.y + g.height) / PAGE_SIZE,
      baselineY: q.baselineY,
    },
    atlasId: sharpColorPageTextureId(g.page),
  };
}
