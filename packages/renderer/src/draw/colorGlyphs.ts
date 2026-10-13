import { isSolidPaint, resolveColor } from '@weasel-js/paint';
import { colorPageTextureId, syncColorPageTexture } from '@weasel-js/font';
import type { LaidOutGroup } from '@weasel-js/text';
import type { ClipRect } from '../batchClip';
import type { DrawContext } from './drawContext';
import { enterUncut, leaveUncut } from './clip';
import { flushBatch } from './flushBatch';
import { stageColorGlyphs } from './batch';

/**
 * Stage one group of color glyphs: emoji, each a quad off a page of the
 * dynamic atlas that holds its own colors. They are sampled as an image is and
 * take nothing from the text's fill but its opacity, the way a browser paints
 * them.
 */
export function drawColorGlyphs(ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number): void {
  const fill = group.fill?.paint;
  if (fill === undefined || group.quads.length === 0) return;
  if (!syncColorPageTexture(ctx.textureCache, group.page)) return;
  const opacity = isSolidPaint(fill) ? resolveColor(fill.color)[3] : 1;
  const atlasId = colorPageTextureId(group.page);

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  let { staged, slot } = stageColorGlyphs(ctx, atlasId);
  // Group alpha rides the vertices only in a run that folded it: see `drawImage`.
  let alpha = opacity * (staged.foldsAlpha ? ctx.state.alpha : 1);
  const restage = (): void => {
    ({ staged, slot } = stageColorGlyphs(ctx, atlasId));
    alpha = opacity * (staged.foldsAlpha ? ctx.state.alpha : 1);
  };

  for (const q of group.quads) {
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      restage();
    }
    let cut: ClipRect | null | undefined;
    while (!batch.pushQuad(
      q.x0 + dx, q.y0 + dy, q.x1 - q.x0, q.y1 - q.y0, m,
      q.u0, q.v0, q.u1, q.v1, alpha, slot,
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
