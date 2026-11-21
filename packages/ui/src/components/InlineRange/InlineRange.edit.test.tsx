import { describe, it, expect, vi } from 'vitest';
import { act, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Disabled } from '../Disabled';
import { InlineRange } from './InlineRange';

// The edit protocol, docs/conventions.md "Edit callbacks", as InlineRange keeps it under its value-named callbacks.

const range = () => screen.getByLabelText<HTMLInputElement>('Width');
const press = () => fireEvent.pointerDown(range(), { pointerId: 1, button: 0 });
const slide = (v: number) => fireEvent.input(range(), { target: { value: String(v) } });
const settle = () => fireEvent.change(range(), { target: { value: range().value } });
const release = () => fireEvent.pointerUp(range(), { pointerId: 1 });

function Previewing(props: { onChange: (n: number) => void; onCancel?: () => void; onInput?: (n: number) => void }) {
  const [v, setV] = useState(5);
  return (
    <InlineRange
      aria-label="Width" min={0} max={20} value={v}
      onValueInput={(n) => { props.onInput?.(n); setV(n); }}
      onValueChange={props.onChange}
      onValueCancel={props.onCancel}
    />
  );
}

describe('InlineRange edit protocol', () => {
  it('previews every move of a drag and commits once at its end', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Previewing onInput={onInput} onChange={onChange} />);
    press();
    slide(7);
    slide(9);
    expect(onInput.mock.calls.map((c) => c[0])).toEqual([7, 9]);
    expect(onChange).not.toHaveBeenCalled();
    settle();
    release();
    expect(onChange.mock.calls).toEqual([[9]]);
  });

  it('commits at the release when the change comes after it, and once', () => {
    const onChange = vi.fn();
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onValueChange={onChange} />);
    press();
    slide(9);
    release();
    fireEvent.change(range(), { target: { value: '9' } });
    expect(onChange.mock.calls).toEqual([[9]]);
  });

  it('a key step is one edit: its preview and its commit', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Previewing onInput={onInput} onChange={onChange} />);
    fireEvent.input(range(), { target: { value: '6' } });
    settle();
    fireEvent.input(range(), { target: { value: '7' } });
    settle();
    expect(onInput.mock.calls.map((c) => c[0])).toEqual([6, 7]);
    expect(onChange.mock.calls).toEqual([[6], [7]]);
  });

  it('a change with no input before it is a whole edit', () => {
    const onChange = vi.fn();
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onValueChange={onChange} />);
    fireEvent.change(range(), { target: { value: '12' } });
    expect(onChange.mock.calls).toEqual([[12]]);
  });

  it('a canceled pointer cancels the drag: back to where it began, and no commit', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(<Previewing onInput={onInput} onChange={onChange} onCancel={onCancel} />);
    press();
    slide(9);
    fireEvent.pointerCancel(range(), { pointerId: 1 });
    fireEvent.change(range(), { target: { value: '9' } });
    expect(onInput.mock.calls.map((c) => c[0])).toEqual([9, 5]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    press();
    slide(12);
    release();
    settle();
    expect(onChange.mock.calls).toEqual([[12]]);
  });

  it('commits nothing for a drag that ends where it began', () => {
    const onChange = vi.fn();
    render(<Previewing onChange={onChange} />);
    press();
    slide(8);
    slide(5);
    release();
    settle();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a commit-only caller sees the drag, and the draft goes at the commit', () => {
    const onChange = vi.fn();
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onValueChange={onChange} />);
    press();
    slide(10);
    expect(range().style.getPropertyValue('--slider-fill')).toBe('50%');
    settle();
    expect(onChange.mock.calls).toEqual([[10]]);
    expect(range().style.getPropertyValue('--slider-fill')).toBe('25%');
  });

  it('Escape cancels a drag: the start value goes back to onValueInput, onValueCancel fires, nothing commits', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(<Previewing onInput={onInput} onChange={onChange} onCancel={onCancel} />);
    press();
    slide(9);
    fireEvent.keyDown(range(), { key: 'Escape' });
    expect(onInput.mock.calls.at(-1)).toEqual([5]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    slide(12);
    settle();
    release();
    expect(onChange).not.toHaveBeenCalled();
    expect(onInput.mock.calls.at(-1)).toEqual([5]);
  });

  it('keeps the Escape that cancels a drag from the dialog or popover around it', () => {
    const outer = vi.fn();
    const onWindow = vi.fn();
    const onCancel = vi.fn();
    render(
      <div onKeyDown={(e) => outer(e.key)}>
        <InlineRange aria-label="Width" min={0} max={20} value={5} onValueChange={() => {}} onValueCancel={onCancel} />
      </div>,
    );
    window.addEventListener('keydown', onWindow);
    press();
    slide(9);
    fireEvent.keyDown(range(), { key: 'Escape' });
    release();
    fireEvent.keyDown(range(), { key: 'Escape' });
    window.removeEventListener('keydown', onWindow);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(outer.mock.calls).toEqual([['Escape']]);
    expect(onWindow).toHaveBeenCalledTimes(1);
  });

  it('unmounting mid-drag cancels the edit', () => {
    const onCancel = vi.fn();
    const onChange = vi.fn();
    const { unmount } = render(<Previewing onChange={onChange} onCancel={onCancel} />);
    press();
    slide(9);
    unmount();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the native handlers beside the value callbacks', () => {
    const native = vi.fn();
    const onChange = vi.fn();
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onChange={native} onValueChange={onChange} />);
    fireEvent.change(range(), { target: { value: '8' } });
    expect(native).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls).toEqual([[8]]);
  });

  it('a range given only native handlers draws its value through a drag', () => {
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onChange={() => {}} />);
    slide(10);
    expect(range().style.getPropertyValue('--slider-fill')).toBe('25%');
  });

  it('a held range reports no edit', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(
      <Disabled reason="Locked">
        <InlineRange aria-label="Width" min={0} max={20} value={5} onValueInput={onInput} onValueChange={onChange} />
      </Disabled>,
    );
    slide(9);
    settle();
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ['a release', () => { press(); slide(9); }, release],
    ['a blur', () => slide(9), () => fireEvent.blur(range())],
  ])('cancels, not commits, an edit the range is held during, ended by %s', (_, begin, end) => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    let hold: () => void = () => {};
    function Host() {
      const [held, setHeld] = useState(false);
      hold = () => setHeld(true);
      return <InlineRange aria-label="Width" min={0} max={20} value={5} readOnly={held} onValueChange={onChange} onValueCancel={onCancel} />;
    }
    render(<Host />);
    begin();
    act(() => hold());
    end();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
