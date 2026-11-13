import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Input } from '../Input';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('renders a textarea its label names', () => {
    render(<TextArea label="Description" placeholder="What went wrong?" />);
    const box = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(box).toBeInstanceOf(HTMLTextAreaElement);
    expect(box.placeholder).toBe('What went wrong?');
    expect(box.rows).toBe(4);
  });

  it('fires onChange with the new value, newlines included', () => {
    const onChange = vi.fn();
    render(<TextArea label="Notes" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'one\ntwo' } });
    expect(onChange).toHaveBeenCalledWith('one\ntwo');
  });

  it('shows its description and error', () => {
    render(<TextArea label="Z" description="A hint." isInvalid errorMessage="Required" />);
    expect(screen.getByText('A hint.')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('reads Mixed over its placeholder when mixed', () => {
    render(<TextArea label="Notes" placeholder="None yet" mixed />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('placeholder', 'Mixed');
  });

  it('sets its label beside the box in a row, as Input does', () => {
    const { container: area } = render(<TextArea label="Notes" orientation="row" />);
    const { container: input } = render(<Input label="Name" orientation="row" />);
    expect(area.firstElementChild!.className).toBe(input.firstElementChild!.className);
  });
});
