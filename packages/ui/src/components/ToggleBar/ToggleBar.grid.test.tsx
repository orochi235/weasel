import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { ToggleBar } from './ToggleBar';
import type { LastRow } from '@weasel-js/ui-input';

const cells = (n: number) => Array.from({ length: n }, (_, i) => ({ value: String(i), label: String(i) }));

function Grid({ count, lastRow }: { count: number; lastRow?: LastRow }) {
  const [value, setValue] = useState<string[]>([]);
  return <ToggleBar mode="multiple" columns={3} lastRow={lastRow} items={cells(count)} value={value} onChange={setValue} aria-label="grid" />;
}

describe('ToggleBar columns', () => {
  it('lays the segments out as a grid in one well, naming the corners it rounds', () => {
    const { getByRole, getAllByRole } = render(<Grid count={5} lastRow="fill" />);
    expect(getByRole('group').style.getPropertyValue('--tracks')).toBe('6');
    expect(getAllByRole('button').map((b) => b.getAttribute('data-tile-corners') ?? ''))
      .toEqual(['ss', '', 'se', 'es', 'ee']);
    expect(getAllByRole('button').map((b) => b.hasAttribute('data-row-fill'))).toEqual([false, false, false, true, true]);
  });

  it('moves focus a row with Up and Down', () => {
    const { getAllByRole } = render(<Grid count={6} />);
    const buttons = getAllByRole('button');
    buttons[1]!.focus();
    fireEvent.keyDown(buttons[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[4]);
    fireEvent.keyDown(buttons[4]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('stays one line without columns', () => {
    const { getByRole } = render(<ToggleBar mode="multiple" items={cells(4)} value={[]} onChange={() => {}} aria-label="row" />);
    expect(getByRole('group').style.getPropertyValue('--tracks')).toBe('');
  });
});
