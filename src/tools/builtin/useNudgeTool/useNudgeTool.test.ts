import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNudgeTool } from './useNudgeTool';
import type { ToolCtx } from '../../types';

function makeCtx(): ToolCtx<undefined> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'] } as any,
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
  };
}

function keyEvent(key: string, shiftKey = false): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, shiftKey });
  return e;
}

type XYPose = { x: number; y: number };
const translateXY = (p: XYPose, dx: number, dy: number): XYPose => ({ x: p.x + dx, y: p.y + dy });

const noopAdapter = {
  getSelection: () => ['a'],
  getPose: (): XYPose => ({ x: 0, y: 0 }),
  applyOps: vi.fn(),
} as any;

describe('useNudgeTool', () => {
  it('declares id "nudge" and no switch keybinding (handles arrow keys via the keyboard channel)', () => {
    const { result } = renderHook(() =>
      useNudgeTool<XYPose>(noopAdapter, { translatePose: translateXY }),
    );
    expect(result.current.id).toBe('nudge');
    expect(result.current.keybinding).toBeUndefined();
  });

  it('claims arrow keys; passes others', () => {
    const { result } = renderHook(() =>
      useNudgeTool<XYPose>(noopAdapter, { translatePose: translateXY }),
    );
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(result.current.keyboard!.onDown!(keyEvent(k), makeCtx())).toBe('claim');
    }
    expect(result.current.keyboard!.onDown!(keyEvent('a'), makeCtx())).toBe('pass');
  });

  it('translates by step on plain arrow; by shiftStep on shift+arrow', () => {
    const applyOps = vi.fn();
    const adapter = {
      getSelection: () => ['a'],
      getPose: (): XYPose => ({ x: 10, y: 10 }),
      applyOps,
    } as any;
    const { result } = renderHook(() =>
      useNudgeTool<XYPose>(adapter, {
        step: 1,
        shiftStep: 10,
        translatePose: translateXY,
      }),
    );
    result.current.keyboard!.onDown!(keyEvent('ArrowRight'), makeCtx());
    result.current.keyboard!.onDown!(keyEvent('ArrowRight', true), makeCtx());
    expect(applyOps).toHaveBeenCalledTimes(2);
    // Both calls should produce one op for the single selected item
    expect(applyOps.mock.calls[0][0]).toHaveLength(1);
    expect(applyOps.mock.calls[1][0]).toHaveLength(1);
    // Labels default to 'Nudge'
    expect(applyOps.mock.calls[0][1]).toBe('Nudge');
    expect(applyOps.mock.calls[1][1]).toBe('Nudge');
  });
});
