import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
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
});
