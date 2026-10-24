import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppearance } from './appearance';

describe('useAppearance', () => {
  it('renders nothing for a component given no axis', () => {
    expect(renderHook(() => useAppearance({})).result.current).toEqual({});
  });

  it('marks each axis it is given', () => {
    const { result } = renderHook(() => useAppearance({ stance: 'debug', grade: 'warn', emphasis: 'low' }));
    expect(result.current).toMatchObject({ 'data-stance': 'debug', 'data-grade': 'warn', 'data-emphasis': 'low' });
  });

  it('writes the grade token and the emphasis color as inherited properties', () => {
    const { result } = renderHook(() => useAppearance({ grade: 'danger', emphasis: 'high' }));
    expect(result.current.style).toEqual({
      '--wzl-grade': 'var(--wzl-danger)',
      '--wzl-emphasis-fg': 'var(--wzl-accent-fg)',
    });
  });

  it('resolves a palette index to the tint ref', () => {
    const { result } = renderHook(() => useAppearance({ tint: 2 }));
    expect(result.current['data-tint']).toBe('2');
    expect(result.current.style?.['--wzl-tint' as never]).toBeDefined();
  });
});
