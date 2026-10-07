import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { assignRef } from './assignRef';

describe('assignRef', () => {
  it('calls a callback ref with the value', () => {
    const ref = vi.fn();
    assignRef(ref, 'el');
    expect(ref).toHaveBeenCalledWith('el');
  });

  it('sets an object ref', () => {
    const ref = createRef<string>();
    assignRef(ref, 'el');
    expect(ref.current).toBe('el');
    assignRef(ref, null);
    expect(ref.current).toBeNull();
  });

  it('ignores a missing ref', () => {
    expect(() => assignRef<string>(undefined, 'el')).not.toThrow();
    expect(() => assignRef<string>(null, 'el')).not.toThrow();
  });
});
