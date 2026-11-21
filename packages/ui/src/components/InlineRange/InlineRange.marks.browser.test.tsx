import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';

// The background's layers are resolved CSS, which jsdom does not compute.

afterEach(cleanup);

const layers = (el: Element) => getComputedStyle(el).backgroundImage.match(/linear-gradient/g)?.length ?? 0;

describe('InlineRange marks', () => {
  test('sit on top of the filled track rather than replacing it', () => {
    const { container } = render(<InlineRange aria-label="Width" value={40} marks={[0.25, 0.5]} onChange={() => {}} />);
    const el = container.querySelector('input')!;
    expect(layers(el)).toBe(3);
    const sizes = getComputedStyle(el).backgroundSize.split(',').map((v) => v.trim());
    expect(sizes).toEqual(['1px 75%', '1px 75%', 'auto']);
  });

  test('alone on an unfilled track, one layer each', () => {
    const { container } = render(<InlineRange aria-label="Width" value={40} fill={false} marks={[0.5]} onChange={() => {}} />);
    expect(layers(container.querySelector('input')!)).toBe(1);
  });
});
