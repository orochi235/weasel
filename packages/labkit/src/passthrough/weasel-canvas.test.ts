import { describe, expect, it } from 'vitest';
import {
  FALLBACK_FIT_VIEW,
  MinimapCanvas,
  SceneViewCanvas,
  buildSceneViewCommands,
  computeFitView,
  computeIndicatorCommand,
  renderSceneToCanvas,
} from './weasel-canvas';

describe('weasel-canvas passthrough', () => {
  it('re-exports detached-view components', () => {
    for (const C of [SceneViewCanvas, MinimapCanvas]) {
      expect(C).toBeDefined();
      expect(['function', 'object']).toContain(typeof C);
    }
  });

  it('re-exports scene-render helpers', () => {
    expect(typeof buildSceneViewCommands).toBe('function');
    expect(typeof renderSceneToCanvas).toBe('function');
  });

  it('re-exports minimap math helpers and the fit-view fallback', () => {
    expect(typeof computeFitView).toBe('function');
    expect(typeof computeIndicatorCommand).toBe('function');
    expect(FALLBACK_FIT_VIEW).toBeDefined();
  });
});
