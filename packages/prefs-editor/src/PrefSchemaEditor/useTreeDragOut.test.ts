import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { useTreeDragOut } from './useTreeDragOut';
import type { DropOutside } from './StructurePane';

const ROOT: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Grid', description: '', default: false } } } },
};

function setUp(lands = true) {
  const outside: DropOutside = { over: vi.fn(() => true), target: vi.fn(() => null), end: vi.fn() };
  const rules = { canLand: () => lands, landing: () => [] };
  const place = { move: vi.fn(), copy: vi.fn(), link: vi.fn() };
  const { result } = renderHook(() => useTreeDragOut(ROOT, false, false, rules, outside, place));
  const list = document.createElement('div');
  list.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100 }) as DOMRect;
  result.current.unplacedArea.current = list;
  return { result, outside };
}

describe('useTreeDragOut', () => {
  it('ends the drop drawn outside once the drag moves onto the unplaced list', () => {
    const { result, outside } = setUp();
    act(() => { result.current.onDragOutside(['view/grid'], { x: 500, y: 500 }, 'move'); });
    expect(outside.over).toHaveBeenCalledTimes(1);
    let taken = false;
    act(() => { taken = result.current.onDragOutside(['view/grid'], { x: 50, y: 50 }, 'move'); });
    expect(taken).toBe(true);
    expect(outside.end).toHaveBeenCalledTimes(1);
  });

  it('ends the drop drawn outside once what is dragged can no longer land', () => {
    const { result, outside } = setUp(false);
    let taken = true;
    act(() => { taken = result.current.onDragOutside(['view/grid'], { x: 500, y: 500 }, 'link'); });
    expect(taken).toBe(false);
    expect(outside.over).not.toHaveBeenCalled();
    expect(outside.end).toHaveBeenCalledTimes(1);
  });
});
