import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { asset, Live } from './AssetEditor.fixture';
import { renderWithIcons } from '../../testing/withIcons';

// A width set on a pane says nothing about the box it gets: that is the shelf's flex row, and jsdom lays nothing out.

afterEach(cleanup);

const width = (el: Element): number => el.getBoundingClientRect().width;

test('stepping a shelf list\'s handle widens the list and takes the width from the export', async () => {
  await page.viewport(1500, 720);
  renderWithIcons(
    <div style={{ width: 1480, height: 700 }}>
      <Live />
    </div>,
  );
  fireEvent.click(asset('Code'));
  const handle = screen.getByRole('separator', { name: 'Resize settings' });
  const pane = handle.previousElementSibling!;
  const exported = screen.getByRole('region', { name: 'Export' });
  const before = { pane: width(pane), exported: width(exported) };
  expect(before.pane).toBe(240);

  fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
  expect(width(pane)).toBe(250);
  expect(width(exported)).toBe(before.exported - 10);
  // The handle stands between the two, the full height of the shelf.
  const seam = handle.getBoundingClientRect();
  expect(seam.left).toBeGreaterThanOrEqual(pane.getBoundingClientRect().right);
  expect(seam.right).toBeLessThanOrEqual(exported.getBoundingClientRect().left);
  expect(seam.height).toBeGreaterThan(100);
});
