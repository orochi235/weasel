import { describe, expect, it, vi } from 'vitest';
import { bitmapSrc, releaseImage } from '@weasel-js/renderer';
import { answerImage } from './workerImages';

describe('answerImage', () => {
  it('answers at once for a bitmap name the page minted and has let go of', () => {
    const src = bitmapSrc({ width: 4, height: 4, close() {} } as ImageBitmap);
    releaseImage(src);
    const reply = vi.fn();
    answerImage({ type: 'image', src }, reply);
    expect(reply).toHaveBeenCalledWith({ type: 'image', src, error: expect.any(String) });
  });
});
