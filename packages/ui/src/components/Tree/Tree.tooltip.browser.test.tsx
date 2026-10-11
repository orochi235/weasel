import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tree, type TreeNode } from './Tree';

afterEach(cleanup);

const NODES: readonly TreeNode[] = [
  { id: 'grid', label: 'Show grid', tooltip: 'Draw the grid.' },
  { id: 'snap', label: 'Snap', tooltip: 'Snap to the grid.' },
];

// The row is handed to the tooltip by ref, not as its trigger, so only layout shows the tooltip points at it.
test('a row\'s tooltip opens beside that row', async () => {
  render(<div style={{ width: 240, margin: 40 }}><Tree aria-label="Prefs" nodes={NODES} /></div>);
  const row = screen.getByRole('treeitem', { name: 'Snap' }).firstElementChild!;
  row.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
  expect(tip.textContent).toBe('Snap to the grid.');
  const [r, t] = [row.getBoundingClientRect(), tip.getBoundingClientRect()];
  expect(t.left).toBeGreaterThanOrEqual(r.right);
  expect(t.left - r.right).toBeLessThan(24);
  expect(Math.abs((t.top + t.bottom) / 2 - (r.top + r.bottom) / 2)).toBeLessThan(4);
});
