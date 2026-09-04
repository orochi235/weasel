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

describe('Slider density', () => {
  it('sets no track or thumb var by default', () => {
    const { container } = render(<Slider {...base} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('');
  });

  it('drives both vars and marks itself slim', () => {
    const { container } = render(<Slider {...base} density="slim" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('var(--wzl-slider-track-h)');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('var(--wzl-slider-thumb-size)');
    expect(root.className.split(' ')).toContain(s.slim);
  });

  it('lets an explicit trackHeight win over the density', () => {
    const { container } = render(<Slider {...base} density="slim" trackHeight={20} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('20px');
  });
});
