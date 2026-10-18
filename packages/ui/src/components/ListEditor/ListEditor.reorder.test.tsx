import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ListEditor } from './ListEditor';
import { renderWithIcons } from '../../testing/withIcons';

function Held({ initial, onChange }: { initial: string[]; onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ListEditor
      aria-label="Glob"
      reorder
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const ROW_H = 32;

/** Entries are zero-height in jsdom; stamp 32px rows so a drag has somewhere to land. */
function stubRows(): void {
  screen.getAllByRole('listitem').forEach((row, i) => {
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: i * ROW_H, top: i * ROW_H, left: 0, right: 200, bottom: (i + 1) * ROW_H, width: 200, height: ROW_H }) as DOMRect,
    });
  });
  const list = screen.getByRole('list');
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
}

describe('ListEditor reorder', () => {
  it('draws no handles unless asked to reorder', () => {
    renderWithIcons(<ListEditor aria-label="Glob" value={['a', 'b']} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /reorder/i })).toBeNull();
  });

  it('moves an entry with Alt+Up and Alt+Down on its handle, and keeps focus on the moved handle', () => {
    const onChange = vi.fn();
    renderWithIcons(<Held initial={['a', 'b', 'c']} onChange={onChange} />);
    const handle = screen.getByRole('button', { name: 'Drag to reorder Glob 1' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    expect(screen.getByRole('button', { name: 'Drag to reorder Glob 2' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  });

  it('moves an entry with Alt+Up from inside its text field, focus staying in the field', () => {
    const onChange = vi.fn();
    renderWithIcons(<Held initial={['a', 'b']} onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Glob 2' });
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowUp', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['b', 'a']);
    expect(screen.getByRole('textbox', { name: 'Glob 1' })).toHaveFocus();
  });

  it('does nothing past either end', () => {
    const onChange = vi.fn();
    renderWithIcons(<Held initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag to reorder Glob 1' }), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag to reorder Glob 2' }), { key: 'ArrowDown', altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves an entry dragged by its handle', () => {
    const onChange = vi.fn();
    renderWithIcons(<Held initial={['a', 'b', 'c']} onChange={onChange} />);
    stubRows();
    const handle = screen.getByRole('button', { name: 'Drag to reorder Glob 1' });
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 10, clientY: 16 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 90 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 90 });
    expect(onChange).toHaveBeenLastCalledWith(['b', 'c', 'a']);
  });

  it('offers no handle while disabled', () => {
    renderWithIcons(<ListEditor aria-label="Glob" reorder disabled value={['a', 'b']} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Drag to reorder Glob 1' })).toBeDisabled();
  });
});

describe('ListEditor entry kinds', () => {
  it('adds what the chosen kind makes, from a menu of every kind', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <ListEditor<{ kind: string }>
        aria-label="Marks"
        addLabel="Add mark"
        value={[]}
        onChange={onChange}
        newEntry={[
          { label: 'Hit', make: () => ({ kind: 'hit' }) },
          { label: 'Cue', make: () => ({ kind: 'cue' }) },
        ]}
        renderEntry={(entry, _set, name) => <output aria-label={name}>{entry.kind}</output>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add mark' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cue' }));
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'cue' }]);
  });

  it('keeps a plain add button for a single kind', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <ListEditor<number>
        aria-label="Phase"
        value={[1]}
        onChange={onChange}
        newEntry={[{ label: 'Zero', make: () => 0 }]}
        renderEntry={(entry, _set, name) => <output aria-label={name}>{entry}</output>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenLastCalledWith([1, 0]);
  });
});
