/** The panel's layout in a real browser: jsdom lays nothing out, so a collapsed pane passes every test there. */
import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DevtoolsPanel } from './DevtoolsPanel';
import { createInPagePanelTransport } from './inPageTransport';
import { TestCanvas } from './testing/mountCanvas';
import s from './DevtoolsPanel.browser.module.css';

afterEach(cleanup);

test('fills its container, with the tree and the detail pane each given room', async () => {
  const transport = createInPagePanelTransport();
  const { container } = render(
    <>
      <TestCanvas />
      <div className={s.host}><DevtoolsPanel transport={transport} /></div>
    </>,
  );
  const host = container.querySelector(`.${s.host}`)!;
  const panel = screen.getByRole('region', { name: 'Devtools' });
  const solo = await screen.findByRole('treeitem', { name: /^solo\b/ });
  (solo.firstElementChild as HTMLElement).click();
  await screen.findByRole('group', { name: 'Data' });

  const hostBox = host.getBoundingClientRect();
  const panelBox = panel.getBoundingClientRect();
  expect(panelBox.width).toBeCloseTo(hostBox.width, 0);
  expect(panelBox.height).toBeCloseTo(hostBox.height, 0);

  const box = (pane: string) => panel.querySelector(`[data-pane="${pane}"]`)!.getBoundingClientRect();
  await waitFor(() => {
    expect(box('tree').width).toBeGreaterThan(100);
    expect(box('tree').height).toBeGreaterThan(100);
    expect(box('detail').width).toBeGreaterThan(100);
    expect(box('detail').height).toBeGreaterThan(100);
  });
  const tree = box('tree');
  const detail = box('detail');
  // The panes sit side by side inside the panel, neither spilling past its bottom edge.
  expect(tree.bottom).toBeLessThanOrEqual(panelBox.bottom + 1);
  expect(detail.left).toBeGreaterThanOrEqual(tree.right - 1);
});
