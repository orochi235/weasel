import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePathEditMode } from './usePathEditMode';

describe('usePathEditMode', () => {
  it('starts in path edit on the path it is given, and keeps one setup across renders', () => {
    const { result, rerender } = renderHook(() => usePathEditMode({ id: 'a' }));
    const first = result.current;
    expect(first.modes.current().id).toBe('path-edit');
    expect(first.pathEdit.editingId()).toBe('a');
    rerender();
    expect(result.current.modes).toBe(first.modes);
    expect(result.current.pathEdit).toBe(first.pathEdit);
  });

  it('starts in the exit mode with no path, and closing the open one goes back there', () => {
    const { result } = renderHook(() => usePathEditMode());
    expect(result.current.modes.current().id).toBe('normal');
    act(() => result.current.pathEdit.setEditingId('a'));
    expect(result.current.modes.current().id).toBe('path-edit');
    act(() => result.current.pathEdit.setEditingId(null));
    expect(result.current.modes.current().id).toBe('normal');
  });

  it('reads the latest `editable`', () => {
    const { result, rerender } = renderHook(
      ({ allowed }: { allowed: boolean }) => usePathEditMode({ id: 'a', editable: allowed ? () => true : () => false }),
      { initialProps: { allowed: false } },
    );
    expect(result.current.pathEdit.editingId()).toBeNull();
    rerender({ allowed: true });
    expect(result.current.pathEdit.editingId()).toBe('a');
  });
});
