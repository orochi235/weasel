import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import { useMagnificationCheck } from './useMagnificationCheck';

const IN = { system: { base: 'in', units: { in: 1 } } };
const BOX = { x: 0, y: 0, width: 48, height: 48 };

function boardScene() {
  return createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: asNodeId('board'), kind: 'group', layer: 'main', pose: { ...BOX }, data: {}, units: IN },
      { id: asNodeId('inset'), kind: 'mark', layer: 'main', parent: asNodeId('board'), pose: { ...BOX }, data: {} },
      { id: asNodeId('cabinet'), kind: 'mark', layer: 'main', parent: asNodeId('inset'), pose: { ...BOX }, data: {} },
    ],
  });
}

describe('useMagnificationCheck', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('warns once a transform scales a container no scope declares, and only once', () => {
    const scene = boardScene();
    renderHook(() => useMagnificationCheck(scene as unknown as Scene<unknown, string, unknown>));
    expect(warn).not.toHaveBeenCalled();
    act(() => scene.setPose(asNodeId('inset'), { ...BOX, transform: [1.5, 0, 0, 1.5] }));
    act(() => vi.advanceTimersByTime(300));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/node "inset" draws its children at 1\.5×, but its unit scopes declare 1×/);
    act(() => scene.setPose(asNodeId('cabinet'), { ...BOX, x: 1 }));
    act(() => vi.advanceTimersByTime(300));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the scale is declared', () => {
    const scene = boardScene();
    scene.setUnits(asNodeId('inset'), { ...IN, drawnAt: 1.5 });
    scene.setPose(asNodeId('inset'), { ...BOX, transform: [1.5, 0, 0, 1.5] });
    renderHook(() => useMagnificationCheck(scene as unknown as Scene<unknown, string, unknown>));
    act(() => scene.setPose(asNodeId('cabinet'), { ...BOX, x: 1 }));
    act(() => vi.advanceTimersByTime(300));
    expect(warn).not.toHaveBeenCalled();
  });
});
