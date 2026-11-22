import { describe, expect, it } from 'vitest';
import { createGLRecorder } from '../../testing/glRecorder';
import { openWebGL } from './openWebGL';

describe('openWebGL', () => {
  it('opens a canvas context that keeps its drawing buffer, so the canvas reads back after the frame', () => {
    const asked: unknown[] = [];
    const { gl } = createGLRecorder();
    const canvas = { getContext: (_: string, attrs: unknown) => (asked.push(attrs), gl) } as unknown as HTMLCanvasElement;
    openWebGL({ canvas });
    expect(asked).toEqual([{ preserveDrawingBuffer: true, stencil: true }]);
  });
});
