import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { serialize } from '../protocol';
import { ValueView } from './ValueView';

/** The text of the row a key names, at any depth. */
function rowOf(key: string): string {
  const found = screen.getAllByText(key).find((el) => el.closest('[class]') !== null);
  return found!.parentElement!.textContent ?? '';
}

describe('ValueView', () => {
  it('shows a user string, a user $type and a real cycle each as what they are', () => {
    const data: Record<string, unknown> = { note: '[cycle]', shape: { $type: 'circle', r: 5 } };
    data.self = data;
    render(<ValueView value={serialize(data)} label="Data" />);
    const view = screen.getByRole('group', { name: 'Data' });
    expect(rowOf('note')).toContain('"[cycle]"');
    expect(rowOf('self')).toContain('[cycle]');
    expect(rowOf('self')).not.toContain('"[cycle]"');
    expect(rowOf('shape')).toContain('{…}');
    expect(within(view).getByText('$type')).toBeTruthy();
    expect(rowOf('$type')).toContain('"circle"');
    expect(rowOf('r')).toContain('5');
  });

  it('shows NaN, a bigint, a symbol and a function as values, not strings', () => {
    render(<ValueView value={serialize({ n: NaN, big: 10n, sym: Symbol('id'), draw() {}, s: 'NaN' })} label="Data" />);
    expect(rowOf('n')).toMatch(/n\s*:?\s*NaN$/);
    expect(rowOf('big')).toContain('10n');
    expect(rowOf('sym')).toContain('Symbol(id)');
    expect(rowOf('draw')).toContain('ƒ draw');
    expect(rowOf('s')).toContain('"NaN"');
  });

  it('notes how many entries were cut', () => {
    render(<ValueView value={serialize({ a: 1, b: 2, c: 3 }, { items: 1 })} label="Data" />);
    expect(screen.getByRole('group', { name: 'Data' }).textContent).toContain('… 2 more');
  });

  it("gives a cut object's own … key a row apart from the cut's", () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<ValueView value={serialize({ '…': 1, a: 2, b: 3 }, { items: 1 })} label="Data" />);
      expect(warn.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
      expect(screen.getAllByText('…')).toHaveLength(2);
    } finally {
      warn.mockRestore();
    }
  });
});
