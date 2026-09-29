import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sameList, useStableByContent } from './useStableByContent';

describe('useStableByContent', () => {
  it('keeps the committed identity while the content is equal', () => {
    const seen: (readonly number[])[] = [];
    function Probe({ list }: { list: readonly number[] }): null {
      seen.push(useStableByContent(list, sameList));
      return null;
    }
    const first = [1, 2];
    const { rerender } = render(<Probe list={first} />);
    rerender(<Probe list={[1, 2]} />);
    expect(seen[1]).toBe(first);
    const changed = [1, 3];
    rerender(<Probe list={changed} />);
    expect(seen[2]).toBe(changed);
  });
});
