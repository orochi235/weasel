import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UiLogicDemo } from '../UiLogicDemo';

afterEach(cleanup);

const measuredWidth = () => Number(/measured ([\d.]+)/.exec(screen.getByRole('img', { name: /^measured/ }).getAttribute('aria-label')!)![1]);

describe('UiLogicDemo', () => {
  it('measures a longer label as a wider button, with a part for each piece', () => {
    const { container } = render(<UiLogicDemo />);
    expect([...container.querySelectorAll('svg text')].map((t) => t.textContent)).toEqual(['leading', 'label']);
    const before = measuredWidth();
    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Export everything' } });
    expect(measuredWidth()).toBeGreaterThan(before);
  });
});
