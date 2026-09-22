import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ListEditor } from './ListEditor';

function Controlled({ initial, onChange }: { initial: string[]; onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ListEditor
      aria-label="Glob"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('ListEditor', () => {
  it('edits one entry and writes the whole list', () => {
    const onChange = vi.fn();
    render(<ListEditor aria-label="Glob" value={['a', 'b']} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Glob 2' }), { target: { value: 'c' } });
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('removes an entry', () => {
    const onChange = vi.fn();
    render(<ListEditor aria-label="Glob" value={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Glob 1' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('adds an empty entry at the end and focuses it', () => {
    render(<Controlled initial={['a']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const added = screen.getByRole('textbox', { name: 'Glob 2' });
    expect((added as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(added);
  });

  it('Enter inserts after the entry, Backspace in an empty one removes it', () => {
    const onChange = vi.fn();
    render(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Glob 1' }), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['a', '', 'b']);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Glob 2' }), { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('says so when empty', () => {
    render(<ListEditor value={[]} onChange={vi.fn()} empty="No globs" />);
    expect(screen.getByText('No globs')).toBeTruthy();
  });
});
