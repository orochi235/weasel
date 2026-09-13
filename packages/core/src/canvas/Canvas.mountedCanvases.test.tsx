/**
 * A mounted `<Canvas>` is findable from the DOM, which is how chrome handed
 * only a container element (the text-edit overlay) reaches its camera.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import { findMountedCanvas } from './mountedCanvases';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

describe('Canvas — mounted canvas lookup', () => {
  it('registers its element and live view until it unmounts', () => {
    const view = { x: 5, y: 6, scale: { x: 3, y: 3 } };
    const { container, unmount } = render(
      <Canvas width={100} height={100} layers={{}} defaultView={view} />,
    );
    const found = findMountedCanvas(container);
    expect(found?.element).toBe(container.querySelector('canvas'));
    expect(found?.getView()).toEqual(view);

    unmount();
    expect(findMountedCanvas(document.body)).toBeNull();
  });
});
