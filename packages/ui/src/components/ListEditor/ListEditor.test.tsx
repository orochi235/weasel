import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ListEditor } from './ListEditor';
import { renderWithIcons } from '../../testing/withIcons';

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
    renderWithIcons(<ListEditor aria-label="Glob" value={['a', 'b']} onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Glob 2' });
    fireEvent.change(field, { target: { value: 'c' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('removes an entry', () => {
    const onChange = vi.fn();
    renderWithIcons(<ListEditor aria-label="Glob" value={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Glob 1' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('adds an empty entry at the end and focuses it', () => {
    renderWithIcons(<Controlled initial={['a']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const added = screen.getByRole('textbox', { name: 'Glob 2' });
    expect((added as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(added);
  });

  it('Enter inserts after the entry, Backspace in an empty one removes it', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Glob 1' }), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['a', '', 'b']);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Glob 2' }), { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('leaves an input method\'s Enter to it', () => {
    const onChange = vi.fn();
    renderWithIcons(<Controlled initial={['a', 'b']} onChange={onChange} />);
    for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) fireEvent.keyDown(screen.getByRole('textbox', { name: 'Glob 1' }), init);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so when empty', () => {
    renderWithIcons(<ListEditor value={[]} onChange={vi.fn()} empty="No globs" />);
    expect(screen.getByText('No globs')).toBeTruthy();
  });

  it('draws entries that are not strings through renderEntry, and adds what newEntry makes', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <ListEditor<number>
        aria-label="Phase"
        value={[1, 2]}
        onChange={onChange}
        newEntry={() => 0}
        renderEntry={(entry, set, name) => <button onClick={() => set(entry + 10)}>{`${name}: ${entry}`}</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Phase 2: 2' }));
    expect(onChange).toHaveBeenLastCalledWith([1, 12]);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenLastCalledWith([1, 2, 0]);
  });

  it('disables add at maxItems and remove at minItems', () => {
    renderWithIcons(<ListEditor aria-label="Glob" value={['a']} onChange={() => {}} minItems={1} maxItems={1} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Glob 1' })).toBeDisabled();
  });

  function Numbers({ initial }: { initial: number[] }) {
    const [value, setValue] = useState(initial);
    return (
      <ListEditor<number>
        aria-label="Phase"
        value={value}
        onChange={setValue}
        newEntry={() => 0}
        renderEntry={(entry, _set, name) => <output aria-label={name}>{entry}</output>}
      />
    );
  }

  const press = (name: string): void => {
    const button = screen.getByRole('button', { name });
    button.focus();
    fireEvent.click(button);
  };

  it('moves focus to the entry before one removed from a list that draws its own entries', () => {
    renderWithIcons(<Numbers initial={[1, 2]} />);
    press('Remove Phase 2');
    expect(screen.getByRole('button', { name: 'Remove Phase 1' })).toHaveFocus();
  });

  it('moves focus to the add button when the last entry is removed', () => {
    renderWithIcons(<Controlled initial={['a']} />);
    press('Remove Glob 1');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
  });

  it('leaves focus on the add button after adding to a list that draws its own entries', () => {
    renderWithIcons(<Numbers initial={[1]} />);
    press('Add');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
  });
});
