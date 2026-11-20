import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { useTrialLayers } from './useTrialLayers';

const draw = () => undefined;

function layersOf(
  canvas: string[],
  listed: (string | { id: string; label: string; alwaysOn?: boolean })[],
  layerOrder: string[] | null,
  layerVisibility: Record<string, boolean> = {},
) {
  const instrument = {
    name: 'Probe',
    initialState: () => ({}),
    render: () => null,
    canvas: { layers: canvas.map((id) => ({ id, draw })) },
    layers: { ids: listed },
  } as unknown as Instrument;
  const { result } = renderHook(() =>
    useTrialLayers({
      instrument,
      state: {},
      config: {},
      over: undefined,
      layerVisibility,
      layerOrder,
      clock: undefined,
    }),
  );
  return result.current;
}

describe('useTrialLayers', () => {
  it('reorders the listed layers among their own places and keeps an unlisted one where it was declared', () => {
    const { canvasLayers } = layersOf(
      ['bg', 'grid', 'shapes', 'overlay'],
      ['grid', 'shapes'],
      ['shapes', 'grid'],
    );
    expect(canvasLayers.map((l) => l.id)).toEqual(['bg', 'shapes', 'grid', 'overlay']);
  });

  it('keeps an unlisted layer between listed ones in its place', () => {
    const { canvasLayers } = layersOf(['a', 'hud', 'b'], ['a', 'b'], ['b', 'a']);
    expect(canvasLayers.map((l) => l.id)).toEqual(['b', 'hud', 'a']);
  });

  it('lists the layers in the order the canvas draws them', () => {
    const { layerItems } = layersOf(['a', 'b', 'c'], ['a', 'b', 'c'], ['c', 'a', 'b']);
    expect(layerItems.map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('draws an always-on layer whatever its visibility says, as the list shows it', () => {
    const { canvasLayers, visibleLayers, layerItems } = layersOf(
      ['grid', 'hud'],
      ['grid', { id: 'hud', label: 'HUD', alwaysOn: true }],
      null,
      { grid: false, hud: false },
    );
    expect(canvasLayers.map((l) => [l.id, l.visible])).toEqual([
      ['grid', false],
      ['hud', true],
    ]);
    expect([...visibleLayers]).toEqual(['hud']);
    expect(layerItems.find((l) => l.id === 'hud')?.visible).toBe(true);
  });
});
