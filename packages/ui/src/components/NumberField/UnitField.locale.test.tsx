import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from 'react-aria-components';
import { compact, decimal, parseAs, qty, type Display } from '@weasel-js/quantity';
import { PropertyControl, PropertyField } from '../Properties/PropertyField';
import { UnitField, type UnitFieldProps } from './UnitField';

afterEach(cleanup);

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'ar-EG', 'hi-IN-u-nu-deva'];
const VALUES = [-1_234_567.891, 0.5, 1_500, 1.5, -0.25, 40_000];
const DISPLAYS: Display[] = [decimal({ maxPlaces: 20, grouping: false }), decimal(), compact({ places: 1 })];

function field(props: Partial<UnitFieldProps> = {}) {
  const onChange = vi.fn();
  const view = render(<UnitField value={0} onChange={onChange} aria-label="Amount" {...props} />);
  return { onChange, view, input: screen.getByRole('spinbutton', { name: 'Amount' }) as HTMLInputElement };
}

function typeAndLeave(input: HTMLElement, text: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe('UnitField locale', () => {
  it('reads back every value it shows, as the same number, in each locale', () => {
    for (const locale of LOCALES) {
      for (const display of DISPLAYS) {
        for (const value of VALUES) {
          const shown = field({ value, display, locale });
          const text = shown.input.value;
          shown.view.unmount();
          // What the shown text stands for, read independently in en-US.
          const expected = parseAs(qty(value, display, { locale: 'en-US' }).text, display);
          const typed = field({ value: 7, display, locale });
          typeAndLeave(typed.input, text);
          expect(typed.onChange, `${locale} ${display.kind} ${value}: ${text}`).toHaveBeenCalledWith(expected);
          typed.view.unmount();
        }
      }
    }
  });

  it('reads 1.500 in de-DE as the 1500 it would show that way, and 2,5 as two and a half', () => {
    const a = field({ locale: 'de-DE' });
    typeAndLeave(a.input, '1.500');
    expect(a.onChange).toHaveBeenCalledWith(1500);
    a.view.unmount();
    const b = field({ locale: 'de-DE' });
    typeAndLeave(b.input, '2,5');
    expect(b.onChange).toHaveBeenCalledWith(2.5);
  });

  it('shows in the locale, grouped as Intl groups it', () => {
    const { input } = field({ value: 1234.5, display: decimal(), locale: 'fr-FR' });
    expect(input.value).toBe('1\u202f234,5');
    expect(input).toHaveAttribute('aria-valuenow', '1234.5');
  });

  it('reads a typed unit in the locale', () => {
    const { input, onChange } = field({ value: 5, accepts: { mm: 0.1, cm: 1 }, locale: 'de-DE' });
    typeAndLeave(input, '12,5mm');
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it('steps from a draft typed in the locale', () => {
    const { input, onChange } = field({ value: 0, locale: 'de-DE' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2,5' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
  });

  it('takes its locale from an I18nProvider above it, and its own prop over that', () => {
    render(
      <I18nProvider locale="de-DE">
        <UnitField value={2.5} onChange={() => {}} aria-label="From provider" />
        <UnitField value={2.5} onChange={() => {}} aria-label="From prop" locale="en-US" />
      </I18nProvider>,
    );
    expect(screen.getByRole('spinbutton', { name: 'From provider' })).toHaveValue('2,5');
    expect(screen.getByRole('spinbutton', { name: 'From prop' })).toHaveValue('2.5');
  });

  // Every other number field test leans on this default: jsdom's `navigator.language` is `en-US`.
  it("defaults to the browser's language, en-US under jsdom, and follows it when it changes", () => {
    const { input } = field({ value: 2.5 });
    expect(navigator.language).toBe('en-US');
    expect(input.value).toBe('2.5');
    const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE');
    try {
      act(() => {
        window.dispatchEvent(new Event('languagechange'));
      });
      expect(input.value).toBe('2,5');
    } finally {
      language.mockRestore();
      act(() => {
        window.dispatchEvent(new Event('languagechange'));
      });
    }
  });
});

describe('PropertyPanel number controls under a locale', () => {
  it("shows and reads a slider's readout in the provider's locale", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider locale="de-DE">
        <PropertyField kind="number" control="slider" label="Gain" value={2.5} min={0} max={10} step={0.5} onChange={onChange} />
      </I18nProvider>,
    );
    const readout = screen.getAllByRole('spinbutton').find((el) => el.tagName === 'INPUT')!;
    expect(readout).toHaveValue('2,5');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '7,5' } });
    fireEvent.blur(readout);
    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });

  it('writes a read-only number in the same locale its field would', () => {
    render(
      <I18nProvider locale="de-DE">
        <PropertyControl kind="number" name="Width" value={12.5} step={0.5} readOnly onChange={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByRole('status', { name: 'Width' }).textContent).toBe('12,5');
  });
});
