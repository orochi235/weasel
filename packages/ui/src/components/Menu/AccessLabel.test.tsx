import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AccessLabel } from './AccessLabel';

afterEach(cleanup);

describe('AccessLabel', () => {
  it('wraps the first matching letter, ignoring case, and keeps the text', () => {
    const { container } = render(<AccessLabel label="File" access="f" />);
    expect(container.textContent).toBe('File');
    const spans = container.querySelectorAll('span span');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('F');
  });

  it('wraps the first occurrence only, mid-label', () => {
    const { container } = render(<AccessLabel label="Export" access="x" />);
    expect(container.textContent).toBe('Export');
    expect(container.querySelector('span span')!.textContent).toBe('x');
  });

  it('underlines only the first character of a longer declaration', () => {
    const { container } = render(<AccessLabel label="Edit" access="ex" />);
    expect(container.querySelector('span span')!.textContent).toBe('E');
  });

  it('finds the letter by cluster, so a capital whose lowercase is longer does not shift it', () => {
    const { container } = render(<AccessLabel label="İstanbul" access="s" />);
    expect(container.querySelector('span span')!.textContent).toBe('s');
  });

  it('matches a letter written decomposed, and not the bare base of an accented letter', () => {
    const decomposed = 'Cafe\u0301';
    const accented = render(<AccessLabel label={decomposed} access="é" />);
    expect(accented.container.querySelector('span span')!.textContent).toBe('e\u0301');
    accented.unmount();
    const { container } = render(<AccessLabel label={`${decomposed} e`} access="e" />);
    expect(container.querySelector('span span')!.previousSibling!.textContent).toBe(`${decomposed} `);
  });

  it('draws the plain label when the letter is absent or none is declared', () => {
    for (const access of ['q', undefined]) {
      const { container, unmount } = render(<AccessLabel label="File" access={access} />);
      expect(container.querySelector('span span')).toBeNull();
      expect(container.textContent).toBe('File');
      unmount();
    }
  });
});
