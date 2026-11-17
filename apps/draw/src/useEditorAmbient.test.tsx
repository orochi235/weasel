import { act, renderHook } from '@testing-library/react';
import { asNodeId, createScene, pathFromD, type NodeId, type SelectionApi } from '@weasel-js/core';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AppCommands } from './appCommands';
import { DRAW_REGISTRY, type DrawScene } from './drawDocument';
import { ColorContextProvider } from './tools/colorContext';
import { useEditorAmbient } from './useEditorAmbient';


function setup() {
  const scene: DrawScene = createScene({ systemLayers: [{ id: 'default' }], registry: DRAW_REGISTRY });
  const id = asNodeId('p');
  scene.add({
    kind: 'mark', layer: 'default', id,
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { path: pathFromD('M0 0 H10 V10 Z') },
  } as never);
  const selection = { current: [id] as readonly NodeId[], get: () => [id], set: vi.fn() } as unknown as SelectionApi;
  const wrapper = ({ children }: { children: ReactNode }) => <ColorContextProvider>{children}</ColorContextProvider>;
  const { result } = renderHook(() => useEditorAmbient({
    scene, selection, modes: [],
    grid: {} as never, rulers: {} as never, bounds: {} as never,
    pathOverlays: { id: 'overlays', eligibility: { always: true } },
    symmetry: { contribution: { id: 'symmetry', eligibility: { always: true } }, commands: { symmetryOn: false, toggleSymmetry: vi.fn() } },
    view: { x: 0, y: 0, zoom: 1 } as never, setView: vi.fn(), openPalette: vi.fn(),
  }), { wrapper });
  const commands = (): AppCommands => {
    const app = result.current.find((c) => c.id === 'draw.app')!;
    return (app.deps as { appCommands: () => AppCommands }).appCommands();
  };
  return { scene, id, commands };
}

describe('useEditorAmbient', () => {
  it('enables Release compound path when an edit gives the selected path a second subpath', () => {
    const { scene, id, commands } = setup();
    expect(commands().canReleaseCompound).toBe(false);
    act(() => { scene.update(id, { data: { path: pathFromD('M0 0 H10 V10 Z M50 0 H60 V10 Z') } } as never); });
    expect(commands().canReleaseCompound).toBe(true);
  });
});
