import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useHeldAriaRef } from './heldItem';

afterEach(cleanup);

function Row({ into }: { into: RefObject<HTMLElement | null> }) {
  return <div ref={useHeldAriaRef(true, 'Why not', into)}>row</div>;
}

describe('useHeldAriaRef', () => {
  it('lets go of a held element once it unmounts', () => {
    const into: RefObject<HTMLElement | null> = { current: null };
    const { unmount } = render(<Row into={into} />);
    expect(into.current).toBeInstanceOf(HTMLElement);
    unmount();
    expect(into.current).toBeNull();
  });

  it('clears its marks when called with null, as React 18 calls an old ref', () => {
    const el = document.createElement('div');
    const { result, rerender } = renderHook(({ held }) => useHeldAriaRef(held, 'Why not'), { initialProps: { held: true } });
    const ref = result.current;
    ref(el);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    rerender({ held: false });
    ref(null);
    result.current(el);
    expect(el.hasAttribute('aria-disabled')).toBe(false);
    expect(el.hasAttribute('data-disabled')).toBe(false);
    expect(el.hasAttribute('aria-description')).toBe(false);
  });
});
