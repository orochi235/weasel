import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColorContextTool } from './useColorContextTool';
import { dispatchKeyDown } from '../../testUtils/dispatchKeyDown';
import type { Obj } from '../../poseUpdate';

const noopUpdateSelected = () => {};

describe('useColorContextTool — state cluster', () => {
  it('reset returns fill to white and stroke to black', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#123456ff');
      result.current.api.setStrokeColor('#abcdefff');
      result.current.api.reset();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#000000ff' });
  });

  it('swap exchanges fill and stroke', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#aaaaaaff');
      result.current.api.setStrokeColor('#bbbbbbff');
      result.current.api.swap();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#aaaaaaff' });
  });

  it('swapFocus toggles focused side', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    expect(result.current.api.focused).toBe('fill');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('stroke');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('fill');
  });

  it('toggleFocusedNone flips between solid and none', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'none' });
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });
});

describe('useColorContextTool — scene-write cluster', () => {
  it('applyFillToSelection routes through updateSelected with the "Set fill" label', () => {
    const calls: Array<{ patched: Partial<Obj>; label: string | undefined }> = [];
    const updateSelected = (patch: (o: Obj) => Obj, label?: string) => {
      const fake = { id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ffffffff' } as unknown as Obj;
      calls.push({ patched: patch(fake), label });
    };
    const { result } = renderHook(() => useColorContextTool({ updateSelected }));
    act(() => result.current.api.applyFillToSelection('#ff0000ff'));
    expect(calls).toHaveLength(1);
    expect(calls[0].label).toBe('Set fill');
    expect((calls[0].patched as { fill?: string }).fill).toBe('#ff0000ff');
  });

  it('applyFillToSelection on a text obj writes into style.fill.color', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = {
        id: 't', tool: 'text', x: 0, y: 0, width: 10, height: 10,
        style: { fill: { fill: 'solid' as const, color: '#000000ff' } },
      } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useColorContextTool({ updateSelected }));
    act(() => result.current.api.applyFillToSelection('#00ff00ff'));
    const next = calls[0] as { style?: { fill?: { color?: string } } };
    expect(next.style?.fill?.color).toBe('#00ff00ff');
  });

  it('applyStrokeWidthToSelection writes strokeWidth on non-text', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = { id: 'a', tool: 'rect', strokeWidth: 1 } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useColorContextTool({ updateSelected }));
    act(() => result.current.api.applyStrokeWidthToSelection(5));
    expect((calls[0] as { strokeWidth?: number }).strokeWidth).toBe(5);
  });
});

describe('useColorContextTool — Tool keybindings', () => {
  it("'d' resets fill and stroke", () => {
    const { result } = renderHook(() => useColorContextTool({ updateSelected: noopUpdateSelected }));
    act(() => {
      result.current.api.setFillColor('#123456ff');
    });
    act(() => dispatchKeyDown(result.current.tool, { key: 'd' }));
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });

  it("'x' swaps fill and stroke", () => {
    const { result } = renderHook(() => useColorContextTool({ updateSelected: noopUpdateSelected }));
    act(() => {
      result.current.api.setFillColor('#aaaaaaff');
      result.current.api.setStrokeColor('#bbbbbbff');
    });
    act(() => dispatchKeyDown(result.current.tool, { key: 'x' }));
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
  });

  it("'shift+x' swaps focused side", () => {
    const { result } = renderHook(() => useColorContextTool({ updateSelected: noopUpdateSelected }));
    expect(result.current.api.focused).toBe('fill');
    act(() => dispatchKeyDown(result.current.tool, { key: 'x', shift: true }));
    expect(result.current.api.focused).toBe('stroke');
  });

  it("'/' toggles focused-none", () => {
    const { result } = renderHook(() => useColorContextTool({ updateSelected: noopUpdateSelected }));
    act(() => dispatchKeyDown(result.current.tool, { key: '/' }));
    expect(result.current.api.fill).toEqual({ kind: 'none' });
  });
});
