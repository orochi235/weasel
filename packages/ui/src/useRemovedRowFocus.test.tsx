import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRemovedRowFocus, type FocusRow } from './useRemovedRowFocus';

function Tree({ rows }: { rows: readonly FocusRow[] }) {
  const kept = useRemovedRowFocus<HTMLLIElement>(rows, (id, els) => els.get(id)?.focus());
  const under = (parent: string) => rows.filter((r) => r.parentId === parent).map((r) => (
    <li key={r.id} ref={kept.rowRef(r.id)} tabIndex={-1}>{r.id}</li>
  ));
  return (
    <ul>
      {rows.filter((r) => r.parentId == null).map((r) => (
        <li key={r.id} ref={kept.rowRef(r.id)} tabIndex={-1}>{r.id}<ul>{under(r.id)}</ul></li>
      ))}
    </ul>
  );
}

it('gives focus back to a focused row drawn again on a new element, as when it moves to another branch', () => {
  const before = [{ id: 'p' }, { id: 'a', parentId: 'p' }, { id: 'b', parentId: 'p' }, { id: 'q' }];
  const view = render(<Tree rows={before} />);
  screen.getByText('b').focus();
  const after = [{ id: 'p' }, { id: 'a', parentId: 'p' }, { id: 'q' }, { id: 'b', parentId: 'q' }];
  view.rerender(<Tree rows={after} />);
  expect(document.activeElement).toBe(screen.getByText('b'));
});

it('leaves focus where it is when the focused row keeps its element', () => {
  const rows = [{ id: 'p' }, { id: 'a', parentId: 'p' }, { id: 'b', parentId: 'p' }];
  const view = render(<Tree rows={rows} />);
  const b = screen.getByText('b');
  b.focus();
  view.rerender(<Tree rows={[...rows]} />);
  expect(document.activeElement).toBe(b);
});
