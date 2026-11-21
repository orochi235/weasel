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


  it('leaves a neighboring index thumb alone while one is dragged toward it', () => {
    render(<PerceptualColorSlidersDemo />);
    const band = sliders().slice(-11);
    const held = band[6], neighbor = band[7];
    expect([value(held), value(neighbor)]).toEqual([500, 600]);
    const track = held.parentElement!;
    track.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 24, right: 1000, bottom: 24, toJSON: () => ({}) });
    fireEvent.pointerDown(held, { clientX: 500, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 650, clientY: 12, pointerId: 1 });
    expect(value(sliders().slice(-11)[7])).toBe(600);
    fireEvent.pointerUp(document, { clientX: 650, clientY: 12, pointerId: 1 });
  });
});
