import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { BandEditor } from './BandEditor';

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 40, width: 400, height: 40, toJSON: () => {} } as DOMRect;
  };
});

describe('an empty value', () => {
  it('draws an empty strip rather than throwing', () => {
    const { container } = render(
      <BandEditor<string> value={[]} min={0} max={100} scale="linear" onChange={vi.fn()} onRangeChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-band-index]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-range-edge]')).toHaveLength(2);
  });
});
