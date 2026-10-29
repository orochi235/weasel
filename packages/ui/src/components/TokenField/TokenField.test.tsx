import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TokenField } from './TokenField';
import { renderWithIcons } from '../../testing/withIcons';

function Controlled({ initial, onChange, reorder }: { initial: string[]; onChange?: (v: string[]) => void; reorder?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <TokenField
      aria-label="Tag"
      reorder={reorder}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const field = () => screen.getByRole('textbox', { name: 'Add to Tag' });
const chip = (name: string) => screen.getByRole('button', { name });

describe('TokenField', () => {
  it('adds a token on Enter and on a comma, trimmed, and clears the field', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={[]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: ' red ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.change(field(), { target: { value: 'blue' } });
    fireEvent.keyDown(field(), { key: ',' });
    expect(onChange).toHaveBeenLastCalledWith(['red', 'blue']);
    expect((field() as HTMLInputElement).value).toBe('');
  });

  it('leaves an input method\'s Enter to it', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={[]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: 'にほ' } });
    for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) fireEvent.keyDown(field(), init);
    expect(onChange).not.toHaveBeenCalled();
    expect((field() as HTMLInputElement).value).toBe('にほ');
  });

  it('keeps its placeholder once it holds tokens', () => {
    renderWithIcons(<TokenField aria-label="Tag" placeholder="Add tag…" value={['red']} onChange={() => {}} />);
    expect(field()).toHaveAttribute('placeholder', 'Add tag…');
  });

  it('adds what is typed when the field loses focus', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a']} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: 'b' } });
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('keeps text that create refuses', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <TokenField<number> aria-label="Tag" value={[]} onChange={onChange} label={String}
        create={(t) => (Number.isFinite(Number(t)) ? Number(t) : undefined)} />,
    );
    fireEvent.change(field(), { target: { value: 'x' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect((field() as HTMLInputElement).value).toBe('x');
  });

  it('removes a token by its remove button', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('moves from the empty field to the last chip on Backspace, and removes it on a second', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(field(), { key: 'Backspace' });
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(chip('b'));
    fireEvent.keyDown(chip('b'), { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['a']);
    expect(document.activeElement).toBe(chip('a'));
  });

  it('moves focus between chips and the field with the arrow keys', () => {
    renderWithIcons(<Controlled initial={['a', 'b']} />);
    act(() => chip('a').focus());
    fireEvent.keyDown(chip('a'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(chip('b'));
    fireEvent.keyDown(chip('b'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(field());
  });

  it('moves a chip with Alt+Arrow when it reorders, and keeps focus on it', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b', 'c']} onChange={onChange} reorder />);
    act(() => chip('a').focus());
    fireEvent.keyDown(chip('a'), { key: 'ArrowRight', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    expect(document.activeElement).toBe(chip('a'));
  });

  it('does not move a chip with Alt+Arrow when it does not reorder', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(chip('a'), { key: 'ArrowRight', altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('edits a token in its popover', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.click(chip('b'));
    const dialog = screen.getByRole('dialog', { name: 'Edit b' });
    fireEvent.change(dialog.querySelector('input')!, { target: { value: 'bee' } });
    expect(onChange).toHaveBeenLastCalledWith(['a', 'bee']);
  });

  it('draws a caller editor, and names a token with a problem by it', () => {
    type Opt = { value: string; label: string };
    const onChange = vi.fn();
    renderWithIcons(
      <TokenField<Opt>
        aria-label="Option"
        value={[{ value: 'a', label: 'Apple' }, { value: 'a', label: 'Avocado' }]}
        onChange={onChange}
        label={(o) => o.label}
        create={(t) => ({ value: t, label: t })}
        problem={(all, i) => (all.findIndex((o) => o.value === all[i]!.value) < i ? 'Repeats an earlier value' : undefined)}
        renderEditor={(o, set) => <input aria-label="Value" value={o.value} onChange={(e) => set({ ...o, value: e.target.value })} />}
      />,
    );
    expect(chip('Avocado, Repeats an earlier value')).toBeTruthy();
    fireEvent.click(chip('Avocado, Repeats an earlier value'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), { target: { value: 'v' } });
    expect(onChange).toHaveBeenLastCalledWith([{ value: 'a', label: 'Apple' }, { value: 'v', label: 'Avocado' }]);
  });

  it('stops removing at minItems and adding at maxItems', () => {
    renderWithIcons(<TokenField aria-label="Tag" value={['a', 'b']} onChange={() => {}} minItems={2} maxItems={2} />);
    expect(screen.queryByRole('button', { name: 'Remove a' })).toBeNull();
    expect((field() as HTMLInputElement).disabled).toBe(true);
  });

  it('opens no editor on a locked token, which can still be removed', () => {
    const onChange = vi.fn();
    renderWithIcons(<TokenField aria-label="Tag" value={['a', 'b']} onChange={onChange} locked={(i) => i === 0} />);
    fireEvent.click(chip('a'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('takes no input when disabled', () => {
    renderWithIcons(<TokenField aria-label="Tag" value={['a']} onChange={() => {}} disabled />);
    expect((field() as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove a' })).toBeNull();
  });
});
