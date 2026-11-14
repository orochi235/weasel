import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Checkbox } from '../Checkbox';
import { Disabled, ReadOnly } from '../Disabled';
import { Tree, type TreeNode, type TreeProps } from './Tree';

const NODES: readonly TreeNode[] = [
  { id: 'a', label: 'Alpha', children: [{ id: 'a1', label: 'Inner' }] },
  { id: 'b', label: 'Beta' },
];
const WITH_CONTROLS: readonly TreeNode[] = NODES.map((n) => ({ ...n, controls: <Checkbox aria-label={`Show ${n.label}`} /> }));

function renderTree(wrap: (node: ReactNode) => ReactNode, props: Partial<TreeProps> = {}) {
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  const onMove = vi.fn();
  const onExpandedChange = vi.fn();
  render(
    <>
      {wrap(
        <Tree
          aria-label="Files" nodes={NODES} selectionMode="multiple"
          onAction={onAction} onSelectionChange={onSelectionChange} onMove={onMove} onExpandedChange={onExpandedChange}
          {...props}
        />,
      )}
    </>,
  );
  return { onAction, onSelectionChange, onMove, onExpandedChange };
}

const rows = () => screen.getAllByRole('treeitem');
const row = (name: string) => screen.getByRole('treeitem', { name });

/** A click, a fold by key, and a keyboard move: each a change a held tree may refuse. */
function tryEverything() {
  fireEvent.click(screen.getByText('Beta'));
  act(() => row('Alpha').focus());
  fireEvent.keyDown(row('Alpha'), { key: 'ArrowRight' });
  fireEvent.keyDown(row('Beta'), { key: 'ArrowUp', altKey: true });
}

describe('Tree held', () => {
  it('unheld, takes every press, fold, and move', () => {
    const calls = renderTree((n) => n);
    tryEverything();
    expect(calls.onAction).toHaveBeenCalled();
    expect(calls.onSelectionChange).toHaveBeenCalled();
    expect(calls.onExpandedChange).toHaveBeenCalled();
    expect(calls.onMove).toHaveBeenCalled();
    expect(row('Alpha').hasAttribute('aria-disabled')).toBe(false);
  });

  it('disabled with no reason refuses everything and leaves the tab order', () => {
    const calls = renderTree((n) => n, { disabled: true });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    for (const r of rows()) {
      expect(r.getAttribute('tabindex')).toBe('-1');
      expect(r.getAttribute('aria-disabled')).toBe('true');
    }
    expect(screen.getByRole('tree').getAttribute('data-held')).toBe('disabled');
  });

  it('disabled for a reason refuses everything, keeps a tab stop, and says why', () => {
    const calls = renderTree((n) => n, { disabled: true, disabledReason: 'Locked' });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(rows().filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(row('Alpha')).toHaveAccessibleDescription('Locked');
    expect(screen.getByRole('tooltip').textContent).toBe('Locked');
  });

  it('disabled, focus still moves between rows', () => {
    renderTree((n) => n, { disabled: true, disabledReason: 'Locked' });
    act(() => row('Alpha').focus());
    fireEvent.keyDown(row('Alpha'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Beta'));
  });

  it('read-only still selects, activates, and folds, and moves nothing', () => {
    const calls = renderTree((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    tryEverything();
    expect(calls.onAction).toHaveBeenCalled();
    expect(calls.onSelectionChange).toHaveBeenCalled();
    expect(calls.onExpandedChange).toHaveBeenCalled();
    expect(calls.onMove).not.toHaveBeenCalled();
    expect(row('Alpha')).toHaveAccessibleDescription('Shared');
  });

  it('read-only, a treegrid is aria-readonly and holds its rows\' controls', () => {
    const onChange = vi.fn();
    render(
      <ReadOnly reason="Shared">
        <Tree aria-label="Files" nodes={NODES.map((n) => ({ ...n, controls: <Checkbox aria-label={`Show ${n.label}`} onChange={onChange} /> }))} />
      </ReadOnly>,
    );
    expect(screen.getByRole('treegrid').getAttribute('aria-readonly')).toBe('true');
    const box = screen.getByRole('checkbox', { name: 'Show Beta' });
    expect(box.getAttribute('aria-readonly')).toBe('true');
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
    // The tree tells the reason, so its controls do not repeat it.
    expect(box).not.toHaveAccessibleDescription('Shared');
  });

  it('its own disabled holds its rows\' controls', () => {
    render(<Tree aria-label="Files" nodes={WITH_CONTROLS} disabled />);
    expect(screen.getByRole('checkbox', { name: 'Show Beta' })).toBeDisabled();
  });

  it('nested scopes: the nearest reason wins, disabled={false} adds nothing, and disabled beats read-only', () => {
    const calls = renderTree(
      (n) => <ReadOnly><Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled></ReadOnly>,
      { disabled: false },
    );
    tryEverything();
    expect(calls.onAction).not.toHaveBeenCalled();
    expect(row('Alpha')).toHaveAccessibleDescription('Busy');
    expect(row('Alpha').getAttribute('aria-disabled')).toBe('true');
  });

  it('an empty tree carries the hold on its empty state', () => {
    const { container } = render(<Tree aria-label="Files" nodes={[]} readOnly />);
    expect(container.querySelector('[data-held]')?.getAttribute('data-held')).toBe('readOnly');
  });
});
