import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Slider } from './Slider';
import s from './Slider.module.css';

const base = {
  min: 0,
  max: 10,
  thumbs: [{ value: 5 }],
  onInput: () => {},
};

const rootOf = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('Slider metrics', () => {
  it('sets no track or thumb var by default, and draws a tab thumb', () => {
    const { container, getByRole } = render(<Slider {...base} />);
    const root = rootOf(container);
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('');
    expect(getByRole('slider').className.split(' ')).not.toContain(s.dot);
  });

  it('writes a number as px and a string as given', () => {
    const root = rootOf(render(<Slider {...base} trackHeight={20} thumbSize="var(--wzl-slider-thumb-size)" />).container);
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('20px');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('var(--wzl-slider-thumb-size)');
  });

  it("draws every thumb that names no shape in the slider's, and a thumb's own shape over it", () => {
    const { getAllByRole } = render(<Slider {...base} thumbs={[{ value: 2 }, { value: 8, shape: 'notched' }]} thumbShape="dot" />);
    const [plain, notched] = getAllByRole('slider').map((t) => t.className.split(' '));
    expect(plain).toContain(s.dot);
    expect(notched).toContain(s.notched);
    expect(notched).not.toContain(s.dot);
  });
});
