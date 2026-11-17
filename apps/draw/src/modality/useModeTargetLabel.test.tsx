/** The breadcrumb's name for the node the open mode is on. */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asNodeId, createScene } from '@weasel-js/core';
import { DEFAULT_MODES } from '@weasel-js/modes';
import type { DrawScene } from '../drawDocument';
import { createModeMachine } from './machine';
import { useModeTargetLabel } from './useCanvasModes';

function setup() {
  const scene = createScene({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: asNodeId('t'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 80, height: 20 }, data: { text: 'Hello' } },
    ],
  } as never) as unknown as DrawScene;
  const history = {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    entries: () => ({ undo: [], redo: [] }),
  };
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
  const hook = renderHook(() => useModeTargetLabel(machine, scene));
  return { scene, machine, hook };
}

describe('useModeTargetLabel', () => {
  it('names nothing in normal mode, and the target once a mode opens on it', () => {
    const { machine, hook } = setup();
    expect(hook.result.current).toBeNull();
    act(() => machine.enterMode('text-edit', { targetId: 't' }));
    expect(hook.result.current).toBe('Hello');
  });

  it('follows the target\'s text and label as they change during the mode', () => {
    const { scene, machine, hook } = setup();
    act(() => machine.enterMode('text-edit', { targetId: 't' }));
    act(() => { scene.update(asNodeId('t'), { data: { text: 'Hello world' } as never }); });
    expect(hook.result.current).toBe('Hello world');
    act(() => { scene.update(asNodeId('t'), { data: { label: 'Greeting' } as never }); });
    expect(hook.result.current).toBe('Greeting');
  });
});
