import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { trigger, pick } from './testing/selectRow';

describe('rows with no value', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('select field shows a placeholder, not the first option, and choosing the first option fires', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="enum" label="Mode" value={undefined} options={options} onChange={onChange} />);
    expect(trigger('Mode')).toHaveTextContent('Choose option…');
    pick('Mode', options[0]!.label as string);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('select field shows the placeholder for a value that is not an option', () => {
    render(<PropertyField kind="enum" label="Mode" value="z" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent('Choose option…');
  });

  it('select field renders a present value with no placeholder', () => {
    render(<PropertyField kind="enum" label="Mode" value="b" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent(options[1]!.label as string);
    expect(trigger('Mode')).not.toHaveTextContent('Choose option…');
  });

  it('select field names its placeholder', () => {
    render(<PropertyField kind="enum" label="Mode" value={undefined} options={options} placeholder="Pick one" onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent('Pick one');
  });

  // React warns about a controlled/uncontrolled switch once per module, so these assert the DOM instead.
  it('checkbox field clears when its value goes away, and checks when one arrives', () => {
    const { rerender } = render(<PropertyField kind="boolean" label="On" value onChange={() => {}} />);
    const box = () => screen.getByRole<HTMLInputElement>('checkbox');
    expect(box().checked).toBe(true);
    rerender(<PropertyField kind="boolean" label="On" value={undefined} onChange={() => {}} />);
    expect(box().checked).toBe(false);
    rerender(<PropertyField kind="boolean" label="On" value onChange={() => {}} />);
    expect(box().checked).toBe(true);
  });

  it('text field clears when its value goes away, and shows one that arrives', () => {
    const { rerender } = render(<PropertyField kind="string" label="Name" value="foo" onChange={() => {}} />);
    const field = () => screen.getByRole<HTMLInputElement>('textbox');
    rerender(<PropertyField kind="string" label="Name" value={undefined} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<PropertyField kind="string" label="Name" value="bar" onChange={() => {}} />);
    rerender(<PropertyField kind="string" label="Name" value={null} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<PropertyField kind="string" label="Name" value="baz" onChange={() => {}} />);
    expect(field().value).toBe('baz');
  });

  it('number field clears when its value goes away, and shows one that arrives', () => {
    const { rerender } = render(<PropertyField kind="number" label="N" value={5} onChange={() => {}} />);
    const field = () => screen.getByRole<HTMLInputElement>('spinbutton');
    rerender(<PropertyField kind="number" label="N" value={undefined} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<PropertyField kind="number" label="N" value={6} onChange={() => {}} />);
    rerender(<PropertyField kind="number" label="N" value={null} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<PropertyField kind="number" label="N" value={0} onChange={() => {}} />);
    expect(field().value).toBe('0');
  });
});
