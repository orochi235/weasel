import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLabContext } from './LabContext';

describe('useLabContext', () => {
  it('throws when used outside <Lab>', () => {
    expect(() => renderHook(() => useLabContext())).toThrow(
      /useLabContext must be used inside <Lab>/,
    );
  });
});
