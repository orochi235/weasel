import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isCanvasFont, registerCanvasFont } from '@weasel-js/font';
import { FontFallbackDemo } from '../FontFallbackDemo';

describe('FontFallbackDemo', () => {
  it('keeps a Georgia enrollment another holder made while it was mounted', () => {
    const { unmount } = render(<FontFallbackDemo />);
    const release = registerCanvasFont('Georgia');
    try {
      unmount();
      expect(isCanvasFont('Georgia')).toBe(true);
    } finally {
      release();
    }
    expect(isCanvasFont('Georgia')).toBe(false);
  });
});
