import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RangePicker } from './RangePicker';

describe('RangePicker rendering', () => {
  it('renders one thumb per item with left% mapped from value', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        onChange={() => {}}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.left).toBe('0%');
    expect(thumbs[1].style.left).toBe('50%');
    expect(thumbs[2].style.left).toBe('100%');
  });
});
