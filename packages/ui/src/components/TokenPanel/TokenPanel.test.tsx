import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { toHex } from './color';
import { TokenPanel } from './TokenPanel';
import type { TokenEntry } from './tokenTypes';

vi.mock('./color', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./color')>();
  return { ...actual, toHex: vi.fn(actual.toHex) };
});

const tokens: TokenEntry[] = [
  { name: '--wzl-gray-50', type: 'color', group: 'gray', value: '#f5f5f6' },
  { name: '--wzl-gray-100', type: 'color', group: 'gray', value: '#e6e7e9' },
  { name: '--wzl-gray-200', type: 'color', group: 'gray', value: '#c9cbcf' },
  { name: '--wzl-focus-ring', type: 'color', group: 'focus', value: '#5841b8' },
  { name: '--wzl-space-sm', type: 'dimension', group: 'space', value: '8px' },
  { name: '--wzl-font-size', type: 'dimension', group: 'font', value: '13px' },
  { name: '--wzl-z-modal', type: 'number', group: 'z', value: '300' },
  { name: '--wzl-motion-fast', type: 'duration', group: 'motion', value: '120ms' },
  { name: '--wzl-ease-out-cubic', type: 'cubicBezier', group: 'ease', value: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  { name: '--wzl-font-ui', type: 'fontFamily', group: 'font', value: 'Oswald, sans-serif' },
  { name: '--wzl-font-weight-bold', type: 'fontWeight', group: 'font', value: '400' },
  { name: '--gap', type: 'string', group: 'gap', value: 'auto' },
];

const section = (name: string) => within(screen.getByRole('region', { name }));

describe('TokenPanel', () => {
  it('sorts tokens into sections by category, each of which collapses', () => {
    render(<TokenPanel tokens={tokens} onChange={() => {}} />);
    expect(section('Color').getByRole('group', { name: '--wzl-focus-ring' })).toBeInTheDocument();
    expect(section('Type').getByRole('group', { name: '--wzl-font-size' })).toBeInTheDocument();
    expect(section('Type').getByRole('group', { name: '--wzl-font-ui' })).toBeInTheDocument();
    expect(section('Size').getByRole('group', { name: '--wzl-space-sm' })).toBeInTheDocument();
    expect(section('Motion').getByRole('group', { name: '--wzl-ease-out-cubic' })).toBeInTheDocument();
    expect(section('Depth').getByRole('group', { name: '--wzl-z-modal' })).toBeInTheDocument();
    expect(section('Other').getByRole('group', { name: '--gap' })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Size' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: '--wzl-space-sm' })).toBeNull();
  });

  it('reports a collapse to a consumer that holds the state', () => {
    const onCollapsedChange = vi.fn();
    render(
      <TokenPanel tokens={tokens} onChange={() => {}} collapsed={{ motion: true }} onCollapsedChange={onCollapsedChange} />,
    );
    expect(screen.queryByRole('group', { name: '--wzl-motion-fast' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Motion' }));
    expect(onCollapsedChange).toHaveBeenCalledWith('motion', false);
  });

  it('draws a color family of three or more as one row of swatches, and edits the one picked', () => {
    const onChange = vi.fn();
    render(<TokenPanel tokens={tokens} onChange={onChange} />);
    const family = within(screen.getByRole('group', { name: 'gray' }));
    expect(family.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('textbox', { name: '--wzl-gray-100 value' })).toBeNull();

    fireEvent.click(family.getByRole('button', { name: '--wzl-gray-100' }));
    expect(family.getByRole('button', { name: '--wzl-gray-100' })).toHaveAttribute('aria-pressed', 'true');
    const field = screen.getByRole('textbox', { name: '--wzl-gray-100 value' });
    expect(field).toHaveValue('#e6e7e9');
    fireEvent.change(field, { target: { value: '#000000' } });
    expect(onChange).toHaveBeenCalledWith('--wzl-gray-100', '#000000');
  });

  it('gives a lone color a swatch and a value field', () => {
    const onChange = vi.fn();
    render(<TokenPanel tokens={tokens} onChange={onChange} />);
    const row = within(screen.getByRole('group', { name: '--wzl-focus-ring' }));
    expect(row.getByLabelText('--wzl-focus-ring color')).toHaveValue('#5841b8');
    fireEvent.change(row.getByRole('textbox'), { target: { value: 'red' } });
    expect(onChange).toHaveBeenCalledWith('--wzl-focus-ring', 'red');
  });

  it('edits a dimension as a number, keeping its unit', () => {
    const onChange = vi.fn();
    render(<TokenPanel tokens={tokens} onChange={onChange} />);
    const row = within(screen.getByRole('group', { name: '--wzl-space-sm' }));
    const number = row.getByRole('textbox', { name: '--wzl-space-sm value' });
    expect(number).toHaveValue('8');
    expect(row.getByText('px')).toBeInTheDocument();
    act(() => {
      fireEvent.change(number, { target: { value: '12' } });
      fireEvent.blur(number);
    });
    expect(onChange).toHaveBeenCalledWith('--wzl-space-sm', '12px');
  });

  it('edits a duration as a number of its unit', () => {
    render(<TokenPanel tokens={tokens} onChange={() => {}} />);
    const row = within(screen.getByRole('group', { name: '--wzl-motion-fast' }));
    expect(row.getByRole('textbox', { name: '--wzl-motion-fast value' })).toHaveValue('120');
    expect(row.getByText('ms')).toBeInTheDocument();
  });

  it('picks a font weight from the nine CSS weights', () => {
    render(<TokenPanel tokens={tokens} onChange={() => {}} />);
    const row = within(screen.getByRole('group', { name: '--wzl-font-weight-bold' }));
    expect(row.getByRole('button', { name: /--wzl-font-weight-bold/ })).toHaveTextContent('400');
  });

  it('draws an easing’s curve beside its value', () => {
    render(<TokenPanel tokens={tokens} onChange={() => {}} />);
    const row = within(screen.getByRole('group', { name: '--wzl-ease-out-cubic' }));
    expect(row.getByRole('img', { name: '--wzl-ease-out-cubic curve' })).toBeInTheDocument();
    expect(row.getByRole('textbox')).toHaveValue('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('offers Reset on an overridden token, and reports it as a null value', () => {
    const onChange = vi.fn();
    render(
      <TokenPanel
        tokens={tokens.map((t) => (t.name === '--gap' ? { ...t, overridden: true } : t))}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Reset / })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset --gap' }));
    expect(onChange).toHaveBeenCalledWith('--gap', null);
  });

  it('redraws only the row whose token changed when a consumer rebuilds its entries', () => {
    const onChange = () => {};
    const { rerender } = render(<TokenPanel tokens={tokens} onChange={onChange} />);
    vi.mocked(toHex).mockClear();
    rerender(
      <TokenPanel
        tokens={tokens.map((t) => (t.name === '--wzl-focus-ring' ? { ...t, value: '#123456' } : { ...t }))}
        onChange={onChange}
      />,
    );
    expect(vi.mocked(toHex).mock.calls.map(([value]) => value)).toEqual(['#123456']);
  });

  // A proxy: jsdom resolves no CSS, and the module proxy answers to any key, so this
  // shows the prop reaches the class list — not that a rule lays the row out. The
  // layout is checked by measuring a row in a browser.
  it('asks for the tight layout when density says so', () => {
    const { container, rerender } = render(<TokenPanel tokens={tokens} onChange={() => {}} />);
    expect(container.firstElementChild?.className).not.toMatch(/tight/);
    rerender(<TokenPanel tokens={tokens} onChange={() => {}} density="tight" />);
    expect(container.firstElementChild?.className).toMatch(/tight/);
  });
});
