import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { useBakedScene } from './useBakedScene';

describe('useBakedScene', () => {
  it('keeps the live scene, with a warning, when the prop turns to serialized JSON', () => {
    const live = createScene({ systemLayers: [{ id: 'main' }] });
    const json = createScene({ systemLayers: [{ id: 'main' }] }).toJSON();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result, rerender } = renderHook(({ scene }) => useBakedScene(scene as never), { initialProps: { scene: live as unknown } });
    rerender({ scene: json });
    expect(result.current).toBe(live);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('follows one live scene swapped for another', () => {
    const a = createScene({ systemLayers: [{ id: 'main' }] });
    const b = createScene({ systemLayers: [{ id: 'main' }] });
    const { result, rerender } = renderHook(({ scene }) => useBakedScene(scene as never), { initialProps: { scene: a } });
    rerender({ scene: b });
    expect(result.current).toBe(b);
  });
});
