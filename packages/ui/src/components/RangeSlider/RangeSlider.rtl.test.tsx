import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { I18nProvider } from 'react-aria-components';
import { RangeSlider } from './RangeSlider';
import { Slider } from '../Slider/Slider';

function mount(dir: 'ltr' | 'rtl', locale = 'en-US') {
  const onChange = vi.fn();
  const onInput = vi.fn();
  const { container } = render(
    <I18nProvider locale={locale}>
      <div dir={dir}>
        <div data-which="range">
          <RangeSlider label="R" defaultValue={25} minValue={0} maxValue={100} onChange={onChange} />
        </div>
        <div data-which="slider">
          <Slider min={0} max={100} step={1} thumbs={[{ value: 25 }]} onInput={onInput} />
        </div>
      </div>
    </I18nProvider>,
  );
  const rangeThumb = container.querySelector<HTMLElement>('[data-which="range"] [data-rac].' + 'x') ?? container.querySelector<HTMLElement>('[data-which="range"] input')!.closest<HTMLElement>('[style*="left"]')!;
  const rangeInput = container.querySelector<HTMLInputElement>('[data-which="range"] input')!;
  const sliderThumb = container.querySelector<HTMLElement>('[data-which="slider"] [role="slider"]')!;
  const fill = container.querySelector<HTMLElement>('[data-which="range"] [data-range-fill]')!;
  return { rangeThumb, rangeInput, sliderThumb, fill, onChange, onInput };
}

describe('RangeSlider beside Slider under a computed direction', () => {
  it('lays its minimum at the right end in a right-to-left page with a left-to-right locale, as Slider does', () => {
    const { rangeThumb, sliderThumb } = mount('rtl');
    expect(sliderThumb.style.left).toBe('75%');
    expect(rangeThumb.style.left).toBe('75%');
  });

  it('steps down on ArrowRight there, as Slider does', () => {
    const { rangeInput, sliderThumb, onChange, onInput } = mount('rtl');
    act(() => { rangeInput.focus(); });
    fireEvent.keyDown(rangeInput, { key: 'ArrowRight' });
    fireEvent.keyDown(sliderThumb, { key: 'ArrowRight' });
    expect(onInput.mock.calls.at(-1)![0][0].value).toBe(24);
    expect(onChange).toHaveBeenLastCalledWith(24);
  });

  it('fills from the right end to the thumb there', () => {
    const { fill } = mount('rtl');
    expect(fill.style.insetInlineStart).toBe('0%');
    expect(fill.style.insetInlineEnd).toBe('75%');
  });

  it('lays its minimum at the left end in a left-to-right page with a right-to-left locale', () => {
    const { rangeThumb, sliderThumb } = mount('ltr', 'ar-EG');
    expect(sliderThumb.style.left).toBe('25%');
    expect(rangeThumb.style.left).toBe('25%');
  });

  it('keeps the locale\'s digits when it forces the direction', () => {
    const { rangeInput } = mount('ltr', 'ar-EG');
    expect(rangeInput.getAttribute('aria-valuetext')).toBe(new Intl.NumberFormat('ar-EG').format(25));
  });
});
