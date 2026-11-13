import { act, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cssColorLiteral } from '@weasel-js/paint';
import { renderWithIcons } from '../../testing/withIcons';
import { EffectList, type EffectKind, type EffectListItem, type EffectListProps } from './EffectList';

const KINDS: Record<string, EffectKind> = {
  match: { label: 'Match', color: cssColorLiteral('#7fd0ff') },
  weld: { label: 'Weld', color: 2 },
};

const START: EffectListItem[] = [
  { id: 'a', kind: 'match', name: 'A', on: true },
  { id: 'b', kind: 'weld', name: 'B', on: true },
  { id: 'c', kind: 'match', name: 'C', on: false },
];

type HeldProps = Partial<EffectListProps<EffectListItem>> & { onItems?: (v: EffectListItem[]) => void };

function Held({ onItems, onSelectionChange, ...rest }: HeldProps) {
  const [items, setItems] = useState(START);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <EffectList
      aria-label="Stages"
      kinds={KINDS}
      items={items}
      selected={selected}
      onSelectionChange={(id) => {
        setSelected(id);
        onSelectionChange?.(id);
      }}
      renderBody={(item) => <p>Settings of {item.name}</p>}
      {...rest}
      onChange={(next) => {
        setItems(next);
        onItems?.(next);
      }}
    />
  );
}

const ids = (v: EffectListItem[]): string[] => v.map((it) => it.id);
const handle = (name: string): HTMLElement => screen.getByRole('button', { name: `Drag to reorder ${name}` });

const ROW_H = 40;

/** Cards are zero-height in jsdom; stamp 40px rows so a drag has somewhere to land. */
function stubRows(): void {
  const list = screen.getByRole('group', { name: 'Stages' });
  Array.from(list.children).forEach((row, i) => {
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: i * ROW_H, top: i * ROW_H, left: 0, right: 300, bottom: (i + 1) * ROW_H, width: 300, height: ROW_H }) as DOMRect,
    });
  });
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
}

describe('EffectList', () => {
  it('moves a card dragged by its number', () => {
    const onItems = vi.fn();
    renderWithIcons(<Held onItems={onItems} />);
    stubRows();
    fireEvent.pointerDown(handle('A'), { pointerId: 1, button: 0, clientX: 10, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 110 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 110 });
    expect(ids(onItems.mock.lastCall![0])).toEqual(['b', 'c', 'a']);
  });

  it('opens a card on a press of its number that does not drag, and closes it on a second', () => {
    const onSelectionChange = vi.fn();
    renderWithIcons(<Held onSelectionChange={onSelectionChange} />);
    stubRows();
    const press = () => {
      fireEvent.pointerDown(handle('B'), { pointerId: 1, button: 0, clientX: 10, clientY: 60 });
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 60 });
    };
    press();
    expect(onSelectionChange).toHaveBeenLastCalledWith('b');
    expect(handle('B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Settings of B')).toBeInTheDocument();
    expect(screen.queryByText('Settings of A')).toBeNull();
    press();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('Settings of B')).toBeNull();
  });

  it('opens a card from the keyboard on its number', () => {
    renderWithIcons(<Held />);
    fireEvent.click(handle('C'));
    expect(screen.getByText('Settings of C')).toBeInTheDocument();
  });

  it('moves a card with Alt+Up and Alt+Down, focus staying where it was', () => {
    const onItems = vi.fn();
    renderWithIcons(<Held onItems={onItems} />);
    const grip = handle('A');
    grip.focus();
    fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true });
    expect(ids(onItems.mock.lastCall![0])).toEqual(['b', 'a', 'c']);
    expect(handle('A')).toHaveFocus();
    const field = screen.getByRole('textbox', { name: 'Name of card 2' });
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowUp', altKey: true });
    expect(ids(onItems.mock.lastCall![0])).toEqual(['a', 'b', 'c']);
    expect(field).toHaveFocus();
  });

  it('does nothing past either end', () => {
    const onItems = vi.fn();
    renderWithIcons(<Held onItems={onItems} />);
    fireEvent.keyDown(handle('A'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(handle('C'), { key: 'ArrowDown', altKey: true });
    expect(onItems).not.toHaveBeenCalled();
  });

  it('switches a card on and off', () => {
    const onItems = vi.fn();
    renderWithIcons(<Held onItems={onItems} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Run C' }));
    expect(onItems.mock.lastCall![0][2]).toMatchObject({ id: 'c', on: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Run A' }));
    expect(onItems.mock.lastCall![0][0]).toMatchObject({ id: 'a', on: false });
  });

  it('renames a card', () => {
    const onItems = vi.fn();
    renderWithIcons(<Held onItems={onItems} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name of card 2' }), { target: { value: 'Bridge' } });
    expect(onItems.mock.lastCall![0][1]).toMatchObject({ id: 'b', name: 'Bridge' });
  });

  it('inserts the copy onDuplicate makes after its card, and has no duplicate button without it', () => {
    const onItems = vi.fn();
    const { unmount } = renderWithIcons(<Held onItems={onItems} onDuplicate={(it) => ({ ...it, id: `${it.id}2`, name: `${it.name} copy` })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate A' }));
    expect(ids(onItems.mock.lastCall![0])).toEqual(['a', 'a2', 'b', 'c']);
    expect(screen.getByRole('textbox', { name: 'Name of card 2' })).toHaveValue('A copy');
    unmount();
    renderWithIcons(<Held />);
    expect(screen.queryByRole('button', { name: /^Duplicate/ })).toBeNull();
  });

  it('removes a card, closing it when it was open', () => {
    const onItems = vi.fn();
    const onSelectionChange = vi.fn();
    renderWithIcons(<Held onItems={onItems} onSelectionChange={onSelectionChange} />);
    fireEvent.click(handle('B'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove B' }));
    expect(ids(onItems.mock.lastCall![0])).toEqual(['a', 'c']);
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it('hands focus to the next card\'s remove button when a card is removed, else the previous one\'s', () => {
    renderWithIcons(<Held />);
    act(() => screen.getByRole('button', { name: 'Remove B' }).focus());
    fireEvent.click(screen.getByRole('button', { name: 'Remove B' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove C' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove A' }));
  });

  it('hands focus to the next card\'s number when a focused card goes and cards have no remove button', () => {
    function Dropping() {
      const [items, setItems] = useState(START);
      return (
        <>
          <EffectList aria-label="Stages" kinds={KINDS} items={items} onChange={setItems} removable={false} />
          <button type="button" onClick={() => setItems((v) => v.filter((it) => it.id !== 'b'))}>Drop B</button>
        </>
      );
    }
    renderWithIcons(<Dropping />);
    const field = screen.getByRole('textbox', { name: 'Name of card 2' });
    act(() => field.focus());
    // A keystroke, not a click, so focus stays in the card as it goes.
    act(() => screen.getByRole('button', { name: 'Drop B' }).click());
    expect(document.activeElement).toBe(handle('C'));
  });

  it('moves only the inner card when one list sits in another\'s open card', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Nested() {
      const [items, setItems] = useState(START);
      return (
        <Held
          onItems={outer}
          renderBody={() => (
            <EffectList aria-label="Inner" kinds={KINDS} items={items} onChange={(next) => { setItems(next); inner(next); }} />
          )}
        />
      );
    }
    renderWithIcons(<Nested />);
    fireEvent.click(handle('B'));
    const innerGrip = within(screen.getByRole('group', { name: 'Inner' })).getByRole('button', { name: 'Drag to reorder A' });
    fireEvent.keyDown(innerGrip, { key: 'ArrowDown', altKey: true });
    expect(ids(inner.mock.lastCall![0])).toEqual(['b', 'a', 'c']);
    expect(outer).not.toHaveBeenCalled();
  });

  it('has no remove buttons when not removable', () => {
    renderWithIcons(<Held removable={false} />);
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('draws each kind by its label, and an unknown kind by its key', () => {
    renderWithIcons(<EffectList items={[...START, { id: 'd', kind: 'other', name: 'D', on: true }]} kinds={KINDS} onChange={() => {}} />);
    // Each card also carries every kind's label unseen, to size the column; those are hidden from assistive tech.
    const seen = (text: string) => screen.getAllByText(text, { ignore: 'script, style, [aria-hidden="true"]' });
    expect(seen('Match')).toHaveLength(2);
    expect(seen('Weld')).toHaveLength(1);
    expect(seen('other')).toHaveLength(1);
    expect(screen.getAllByText('Weld').length).toBeGreaterThan(1);
  });

  it('sizes its kind column from two kinds that share a label without a key clash', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const twins = { ...KINDS, fuse: { label: 'Weld', color: 3 } };
    renderWithIcons(<EffectList items={START} kinds={twins} onChange={() => {}} />);
    expect(error.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
    error.mockRestore();
  });
});
