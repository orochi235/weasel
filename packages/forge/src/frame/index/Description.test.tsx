import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Description } from './Description';

describe('Description', () => {
  it('draws code spans and emphasis, a paragraph per blank-line break, rejoining wrapped lines', () => {
    const { container } = render(
      <Description
        text={'Sets `size` on the badge,\nwrapped as JSDoc wraps it.\n\nThe *second* paragraph.'}
        className="doc"
      />,
    );
    const paragraphs = [...container.querySelectorAll('p.doc')];
    expect(paragraphs.map((p) => p.textContent)).toEqual([
      'Sets size on the badge, wrapped as JSDoc wraps it.',
      'The second paragraph.',
    ]);
    expect(paragraphs[0]?.querySelector('code')?.textContent).toBe('size');
    expect(paragraphs[1]?.querySelector('em')?.textContent).toBe('second');
  });
});
