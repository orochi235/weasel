import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createGLRecorder } from './glRecorder';
import { disposeAfterEach, paint } from './trimClip';

let lost = 0;
const loseContext = (): void => { lost++; };

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const { gl } = createGLRecorder();
    return new Proxy(gl, {
      get: (target, prop) => (prop === 'getExtension'
        ? (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null)
        : Reflect.get(target, prop)),
    }) as never;
  });
});
afterAll(() => { vi.restoreAllMocks(); });

disposeAfterEach();

it('paints on a context of its own', () => {
  paint([], false, false);
  paint([], false, true);
  expect(lost).toBe(0);
});

it('lets go of each context once the test that painted on it ends', () => {
  expect(lost).toBe(2);
});
