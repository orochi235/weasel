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

function mount(hold: Pick<EffectListProps<EffectListItem>, 'disabled' | 'disabledReason' | 'readOnly'>, selected: string | null = null) {
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
    expect(screen.getByRole('button', { name: 'Remove A' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('takes no edit while read-only, and still opens a card', () => {
    const { onChange, onSelectionChange } = mount({ readOnly: true });
    tryEveryEdit();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Drag to reorder B' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith('b');
  });
});
