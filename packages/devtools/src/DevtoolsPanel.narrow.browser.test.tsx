/** The panel in a narrow box, as draw's right sidebar gives it: every control in reach, the panes stacked. */
import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DevtoolsPanel } from './DevtoolsPanel';
import { createInPagePanelTransport } from './inPageTransport';
import { TestCanvas } from './testing/mountCanvas';
import s from './DevtoolsPanel.browser.module.css';

afterEach(cleanup);

const inside = (inner: DOMRect, outer: DOMRect): boolean =>
  inner.left >= outer.left - 1 && inner.right <= outer.right + 1
  && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;

function mount(hostClass = s.narrow) {
  render(
    <>
      <TestCanvas />
      <div className={hostClass}><DevtoolsPanel transport={createInPagePanelTransport()} /></div>
    </>,
  );
  return screen.getByRole('region', { name: 'Devtools' });
}

test('at 225 px wide, every tab sits inside the panel and takes a click', async () => {
  const panel = mount();
  await screen.findByRole('treeitem', { name: /^solo\b/ });
  const box = panel.getBoundingClientRect();
  expect(box.width).toBeCloseTo(225, 0);
  const tabs = within(panel).getAllByRole('tab');
  expect(tabs.length).toBe(6);
  for (const tab of tabs) {
    const r = tab.getBoundingClientRect();
    expect(inside(r, box), `${tab.textContent} at ${r.left}..${r.right}, ${r.top}..${r.bottom}`).toBe(true);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    expect(hit && tab.contains(hit), `${tab.textContent} is covered`).toBe(true);
    tab.click();
    await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'));
  }
});

test('at 225 px wide, the scene tree sits above the node detail, each the panel\'s width', async () => {
  const panel = mount();
  const solo = await screen.findByRole('treeitem', { name: /^solo\b/ });
  (solo.firstElementChild as HTMLElement).click();
  await screen.findByRole('group', { name: 'Data' });
  const box = panel.getBoundingClientRect();
  const tree = panel.querySelector('[data-pane="tree"]')!.getBoundingClientRect();
  const detail = panel.querySelector('[data-pane="detail"]')!.getBoundingClientRect();
  expect(tree.width).toBeGreaterThan(box.width - 4);
  expect(detail.width).toBeGreaterThan(box.width - 4);
  expect(detail.top).toBeGreaterThanOrEqual(tree.bottom - 1);
  expect(detail.bottom).toBeLessThanOrEqual(box.bottom + 1);
});

test('the canvas picker sits at the left of the header and the version at the right, in one row', async () => {
  const panel = mount(`${s.narrow} ${s.hostile}`);
  await screen.findByRole('treeitem', { name: /^solo\b/ });
  const box = panel.getBoundingClientRect();
  const picker = within(panel).getByRole('button', { name: /board/ }).getBoundingClientRect();
  const version = within(panel).getByText(/^weasel /).getBoundingClientRect();
  expect(picker.left - box.left).toBeLessThan(16);
  expect(box.right - version.right).toBeLessThan(16);
  expect(version.left).toBeGreaterThanOrEqual(picker.right - 1);
  // One row: each one's vertical middle falls within the other's height.
  const mid = (r: DOMRect) => r.top + r.height / 2;
  expect(mid(version)).toBeGreaterThan(picker.top);
  expect(mid(version)).toBeLessThan(picker.bottom);
});

test('a selected tree row looks different from the rest, and the node detail lines its values up', async () => {
  const panel = mount();
  const solo = await screen.findByRole('treeitem', { name: /^solo\b/ });
  const group = screen.getByRole('treeitem', { name: /^group\b/ });
  const before = getComputedStyle(solo.firstElementChild!).backgroundColor;
  (solo.firstElementChild as HTMLElement).click();
  await waitFor(() => expect(solo).toHaveAttribute('aria-selected', 'true'));
  await waitFor(() => expect(getComputedStyle(solo.firstElementChild!).backgroundColor).not.toBe(before));
  expect(getComputedStyle(solo.firstElementChild!).backgroundColor)
    .not.toBe(getComputedStyle(group.firstElementChild!).backgroundColor);

  await screen.findByRole('group', { name: 'Data' });
  const valueOf = (term: string) => {
    const dt = within(panel).getByText(term, { selector: 'dt' });
    return dt.nextElementSibling as HTMLElement;
  };
  const textLeft = (el: HTMLElement): number => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().left;
  };
  expect(Math.abs(textLeft(valueOf('Children')) - textLeft(valueOf('Kind')))).toBeLessThan(2);
});
