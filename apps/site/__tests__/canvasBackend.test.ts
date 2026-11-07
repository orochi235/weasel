import { describe, expect, it } from 'vitest';
import { backendFromUrl } from '../canvasBackend';

describe('backendFromUrl', () => {
  it('reads the backend ?backend= names', () => {
    expect(backendFromUrl('?backend=webgpu')).toBe('webgpu');
    expect(backendFromUrl('?debug=1&backend=auto')).toBe('auto');
  });

  it('is WebGL 2 with no backend named, or one it does not know', () => {
    expect(backendFromUrl('')).toBe('webgl2');
    expect(backendFromUrl('?backend=metal')).toBe('webgl2');
  });
});
