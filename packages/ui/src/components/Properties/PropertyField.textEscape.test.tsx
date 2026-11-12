import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

function setup(onInput?: (next: string) => void) {
  const onChange = vi.fn();
  render(<PropertyField kind="string" label="Title" value="old" onChange={onChange} onInput={onInput} />);
  return { onChange, input: screen.getByRole('textbox', { name: 'Title' }) };
}

describe('a text field ended with Escape', () => {
  it('commits nothing, and shows the value again', () => {
    const { onChange, input } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('old');
    expect(input).not.toHaveFocus();
  });

  it('takes back what it sent while typing', () => {
    const onInput = vi.fn();
    const { onChange, input } = setup(onInput);
    input.focus();
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onInput.mock.calls).toEqual([['new'], ['old']]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sends nothing on Escape when nothing was typed', () => {
    const onInput = vi.fn();
    const { onChange, input } = setup(onInput);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still commits on Enter', () => {
    const { onChange, input } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange.mock.calls).toEqual([['new']]);
  });

  it('leaves an input method\'s Enter and Escape to it', () => {
    const { onChange, input } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: 'にほ' } });
    for (const init of [...[{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }], { key: 'Escape', isComposing: true }]) fireEvent.keyDown(input, init);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('にほ');
    expect(input).toHaveFocus();
  });
});

describe('a textarea ended with Escape', () => {
  it("leaves an input method's Escape to it", () => {
    const onChange = vi.fn();
    render(<PropertyField kind="string" control="textarea" label="Notes" value="old" onChange={onChange} />);
    const area = screen.getByRole('textbox', { name: 'Notes' });
    area.focus();
    fireEvent.change(area, { target: { value: 'にほ' } });
    fireEvent.keyDown(area, { key: 'Escape', isComposing: true });
    expect(area).toHaveValue('にほ');
    expect(area).toHaveFocus();
  });
});
