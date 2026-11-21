import { act, fireEvent, screen } from '@testing-library/react';
import { cssColorLiteral } from '@weasel-js/paint';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { Switch } from '../Switch';
import { EffectList, type EffectListItem, type EffectListProps } from './EffectList';

const KINDS = { match: { label: 'Match', color: cssColorLiteral('#7fd0ff') } };
const ITEMS: EffectListItem[] = [
  { id: 'a', kind: 'match', name: 'A', on: true },
  { id: 'b', kind: 'match', name: 'B', on: true },
];

function mount(hold: Pick<EffectListProps<EffectListItem>, 'disabled' | 'disabledReason' | 'readOnly' | 'readOnlyReason'>, selected: string | null = null) {
  const onChange = vi.fn();
  const onSelectionChange = vi.fn();
  renderWithIcons(
    <EffectList
      aria-label="Stages"
      kinds={KINDS}
      items={ITEMS}
      selected={selected}
      onSelectionChange={onSelectionChange}
      onChange={onChange}
      onDuplicate={(item) => ({ ...item, id: `${item.id}2` })}
      renderBody={(item) => <Switch aria-label={`Body of ${item.name}`} isSelected={false} />}
      {...hold}
    />,
  );
  return { onChange, onSelectionChange };
}

/** Every edit a card offers, tried on card A. */
function tryEveryEdit() {
  act(() => {
    fireEvent.click(screen.getByRole('switch', { name: 'Run A' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name of card 1' }), { target: { value: 'Z' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove A' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name of card 1' }), { key: 'ArrowDown', altKey: true });
  });
}

describe('<EffectList> held', () => {
  it('takes no edit while disabled, and disables the open card\'s body with it', () => {
    const { onChange } = mount({ disabled: true }, 'a');
    tryEveryEdit();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Body of A' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove A' })).toBeDisabled();
  });

  it('keeps its buttons focusable to tell a disabled reason, and still takes no edit', () => {
    const { onChange } = mount({ disabled: true, disabledReason: 'Locked' });
    tryEveryEdit();
    expect(onChange).not.toHaveBeenCalled();
    for (const el of [
      screen.getByRole('button', { name: 'Remove A' }),
      screen.getByRole('button', { name: 'Duplicate A' }),
      screen.getByRole('textbox', { name: 'Name of card 1' }),
    ]) {
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el).toHaveAccessibleDescription('Locked');
    }
  });

  it('tells a read-only reason on its name field and marks its buttons held', () => {
    mount({ readOnly: true, readOnlyReason: 'Shared' });
    expect(screen.getByRole('textbox', { name: 'Name of card 1' })).toHaveAccessibleDescription('Shared');
    const remove = screen.getByRole('button', { name: 'Remove A' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).toHaveAccessibleDescription('Shared');
  });

  it('takes no edit while read-only, and still opens a card', () => {
    const { onChange, onSelectionChange } = mount({ readOnly: true });
    tryEveryEdit();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Drag to reorder B' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith('b');
  });
});
