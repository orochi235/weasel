import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePathEditState } from './usePathEdit';

describe('usePathEditState opening', () => {
  it('starts with the opening path in edit and its anchors selected, and reads it only once', () => {
    let opening = { id: 'p', anchors: [1, 2] };
    const extensions: never[] = [];
    const { result, rerender } = renderHook(() => usePathEditState({
      host: undefined, isAllowed: undefined, isSelectedNode: () => true, extensions, opening,
    }));
    expect(result.current.getEditingId()).toBe('p');
    expect([...result.current.getSelectedAnchors()]).toEqual([1, 2]);
    opening = { id: 'q', anchors: [] };
    rerender();
    expect(result.current.getEditingId()).toBe('p');
  });
});
