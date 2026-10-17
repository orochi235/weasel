import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AccessLabel } from './AccessLabel';

afterEach(cleanup);

describe('AccessLabel', () => {
  it('wraps the first matching letter, ignoring case, and keeps the text', () => {
    const { container } = render(<AccessLabel label="File" access="f" />);
    expect(container.textContent).toBe('File');
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('F');
  });

  it('wraps the first occurrence only, mid-label', () => {
    const { container } = render(<AccessLabel label="Export" access="x" />);
    expect(container.textContent).toBe('Export');
    expect(container.querySelector('span')!.textContent).toBe('x');
  });

  it('draws the plain label when the letter is absent or none is declared', () => {
    for (const access of ['q', undefined]) {
      const { container, unmount } = render(<AccessLabel label="File" access={access} />);
      expect(container.querySelector('span')).toBeNull();
      expect(container.textContent).toBe('File');
      unmount();
    }
  });
});
