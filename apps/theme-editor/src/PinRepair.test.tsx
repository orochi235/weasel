import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

  it('takes a decimal, a sign, or a font stack typed one key at a time', async () => {
    const start = { name: 'probe', pins: { gap: 4, font: ['Inter'] }, } as unknown as ThemeDefinition;
    let latest = start;
    function Live() {
      const [d, setD] = useState(start);
      return <PinRepair draft={d} error="unknown token nope" onChange={(next) => setD((latest = next))} />;
    }
    render(<Live />);
    const gap = screen.getByRole('textbox', { name: 'gap' });
    await userEvent.clear(gap);
    await userEvent.type(gap, '-0.5');
    expect(gap).toHaveValue('-0.5');
    expect(latest.pins!.gap).toBe(-0.5);
    const font = screen.getByRole('textbox', { name: 'font' });
    await userEvent.type(font, ', Open Sans');
    expect(font).toHaveValue('Inter, Open Sans');
    expect(latest.pins!.font).toEqual(['Inter', 'Open Sans']);
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

  it('flags a pin only when the error names its reference whole, not inside a longer name', () => {
    const refs = { name: 'probe', pins: { near: '{accent}', far: '{accent-fgx}' } } as unknown as ThemeDefinition;
    render(<PinRepair draft={refs} error="semantics.accent-fg: unknown reference {accent-fgx}." onChange={vi.fn()} />);
    expect(screen.getAllByText('named in the error')).toHaveLength(1);
    expect(screen.getByText('far').closest('li')).toHaveAttribute('data-suspect');
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
