import type { EffectRun } from '../types';

export function previewsOf(run: EffectRun): ImageBitmap[] {
  return Object.values(run.stages).flatMap((s) => Object.values(s.previews ?? {}));
}

export function closeBitmaps(bitmaps: readonly ImageBitmap[]): void {
  for (const b of new Set(bitmaps)) b.close();
}
