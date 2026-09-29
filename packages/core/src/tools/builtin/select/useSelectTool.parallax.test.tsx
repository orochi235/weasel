/**
 * The default pick over a bare adapter crosses into a parallax plane when the
 * tool is told the camera it picks for.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import { useSceneAdapter } from 'canvas/sceneAdapter';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';
import { asNodeId } from 'core/scene/types';
import type { Action, ActionDeps } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';

type Pose = { x: number; y: number; width: number; height: number };

// Camera at 2x over a plane that does not zoom: plane = 2 * camera, so `sun`
// paints over camera 20..30.
const CAMERA: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };

function pressAt(x: number, y: number): readonly string[] {
  const { result } = renderHook(() => {
    const scene = useScene<unknown, 'sky', Pose>({
      systemLayers: [{ id: 'sky', parallax: { pan: 1, zoom: 0 } }],
      initial: [{ id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 40, y: 40, width: 20, height: 20 }, data: {} }],
    });
    const sel = useSelection({ mode: 'single' });
    const adapter = useSceneAdapter(scene, { selection: sel });
    return { tool: useSelectTool(adapter, { getView: () => CAMERA }), sel };
  });
  const tool = result.current.tool as { actions?: readonly Action[] };
  const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
  if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
  act(() => {
    invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
      worldX: x, worldY: y, mods: { alt: false, ctrl: false, meta: false, shift: false },
    });
  });
  return result.current.sel.current;
}

describe('useSelectTool over a bare adapter — parallax layers', () => {
  it('picks a plane node where the camera draws it', () => {
    expect(pressAt(25, 25)).toEqual([asNodeId('sun')]);
  });

  it('does not pick it where its pose sits in the camera world', () => {
    expect(pressAt(50, 50)).toEqual([]);
  });
});
