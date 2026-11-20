import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeDefinition } from '@weasel-js/theme';
import { PinRepair } from './PinRepair';

const draft = { name: 'probe', pins: { 'radius-md': { value: 4, type: 'dimension' }, gap: 8, fg: '{nope}' } } as unknown as ThemeDefinition;

describe('<PinRepair>', () => {
  afterEach(cleanup);

  it('keeps a numeric pin a number, bare or under value', () => {
    const onChange = vi.fn();
    render(<PinRepair draft={draft} error="unknown token nope" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'radius-md' }), { target: { value: '6' } });
    expect(onChange.mock.calls[0]![0].pins['radius-md']).toEqual({ value: 6, type: 'dimension' });
    fireEvent.change(screen.getByRole('textbox', { name: 'gap' }), { target: { value: '12' } });
    expect(onChange.mock.calls[1]![0].pins.gap).toBe(12);
  });

  it('keeps a string pin a string', () => {
    const onChange = vi.fn();
    render(<PinRepair draft={draft} error="unknown token nope" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'fg' }), { target: { value: '{bg}' } });
    expect(onChange.mock.calls[0]![0].pins.fg).toBe('{bg}');
  });

  it('edits an easing or a font stack pin as text and writes it back as a list', () => {
    const lists = {
      name: 'probe',
      pins: { ease: { value: [0.4, 0, 0.2, 1], type: 'cubicBezier' }, font: ['Inter', 'sans-serif'] },
    } as unknown as ThemeDefinition;
    const onChange = vi.fn();
    render(<PinRepair draft={lists} error="unknown token nope" onChange={onChange} />);
    expect(screen.queryByText('varies by axis')).toBeNull();
    const ease = screen.getByRole('textbox', { name: 'ease' });
    expect(ease).toHaveValue('cubic-bezier(0.4, 0, 0.2, 1)');
    fireEvent.change(ease, { target: { value: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)' } });
    expect(onChange.mock.calls[0]![0].pins.ease).toEqual({ value: [0.1, 0.2, 0.3, 0.4], type: 'cubicBezier' });
    fireEvent.change(screen.getByRole('textbox', { name: 'font' }), { target: { value: 'Oswald, serif' } });
    expect(onChange.mock.calls[1]![0].pins.font).toEqual(['Oswald', 'serif']);
  });

  it('says a pin varies by axis only when it does', () => {
    const odd = {
      name: 'probe',
      pins: { fg: { by: 'mode', dark: '#000' }, bg: { value: { nope: 1 } } },
    } as unknown as ThemeDefinition;
    render(<PinRepair draft={odd} error="unknown token nope" onChange={vi.fn()} />);
    expect(screen.getAllByText('varies by axis')).toHaveLength(1);
    expect(screen.getByText('not editable here')).toBeInTheDocument();
  });
});
