import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PerceptualColorSlidersDemo } from '../PerceptualColorSlidersDemo';

const sliders = () => screen.getAllByRole('slider');
const value = (el: Element) => Number(el.getAttribute('aria-valuenow'));

describe('PerceptualColorSlidersDemo', () => {
  it('keeps the L range ordered when a tighter bounds mode clamps it', () => {
    render(<PerceptualColorSlidersDemo />);
    fireEvent.click(screen.getByText('unconstrained'));
    const [, dark, light] = sliders();
    fireEvent.keyDown(dark, { key: 'Home' });
    fireEvent.keyDown(light, { key: 'Home' });
    fireEvent.click(screen.getByText('conservative'));
    const [, d, l] = sliders();
    expect(value(d)).toBeLessThanOrEqual(value(l));
  });

});
