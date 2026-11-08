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
});
