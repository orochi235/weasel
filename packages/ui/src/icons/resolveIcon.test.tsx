import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { namedGlyph } from './namedGlyph';

it('draws a name the icon set holds, at the size asked for', () => {
  const { container } = render(<>{namedGlyph('bold', 16)}</>);
  expect(container.querySelector('svg')).toHaveAttribute('width', '16');
});

it('draws nothing for a name the set lacks, a name from Object.prototype among them', () => {
  expect(namedGlyph(undefined)).toBeUndefined();
  expect(namedGlyph('no-such-glyph')).toBeUndefined();
  expect(namedGlyph('toString')).toBeUndefined();
});
