import { describe, it, expect } from 'vitest';
import { canvasPassThrough } from './canvasPassThrough';
import type { SceneCanvasProps } from './props';

describe('canvasPassThrough', () => {
  it('drops the <Canvas> props SceneCanvas wires itself', () => {
    const wired = {
      gestureSource: {}, previewPoseExtra: () => null, boundsOfPose: () => null, boundsOf: () => null,
      adapter: {}, viewState: {}, getIsVisible: () => true, contentVersion: () => 0,
    };
    const out = canvasPassThrough({ ...wired, backgroundFill: 'red' });
    expect(Object.keys(out)).toEqual(['backgroundFill']);
  });

  it('leaves the dispatcher-backed props off SceneCanvasProps', () => {
    type Props = SceneCanvasProps<unknown, string, unknown>;
    type Leaked = Extract<keyof Props, 'gestureSource' | 'previewPoseExtra' | 'boundsOfPose'>;
    const none: [Leaked] extends [never] ? true : false = true;
    expect(none).toBe(true);
  });
});
