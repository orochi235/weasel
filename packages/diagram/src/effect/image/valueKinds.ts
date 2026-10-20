import type { EffectValueKind, EffectValueKinds } from '../runner/types';

/** Device pixels per preview unit, so a preview stays sharp on a 2× display. */
const PREVIEW_DENSITY = 2;

const bitmapKind: EffectValueKind = {
  show: (value) => `${(value as ImageBitmap).width}×${(value as ImageBitmap).height}`,
  preview(value, size) {
    const width = Math.max(1, Math.round(size.width * PREVIEW_DENSITY));
    const height = Math.max(1, Math.round(size.height * PREVIEW_DENSITY));
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')!.drawImage(value as ImageBitmap, 0, 0, width, height);
    return canvas.transferToImageBitmap();
  },
  dispose: (value) => (value as ImageBitmap).close(),
};

/** Value kinds for `IMAGE_STAGE_TYPES`: an image or mask shows as its size and
 *  previews as a copy scaled to the slot; a number shows to three places. */
export const imageValueKinds: EffectValueKinds = {
  image: bitmapKind,
  mask: bitmapKind,
  number: { show: (value) => (value as number).toFixed(3) },
};
