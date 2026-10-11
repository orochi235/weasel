import { screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { describe, expect, it, vi } from 'vitest';
import type { RegionContribution, TrialChromeContext } from '../types';
import { SidebarPanes } from './SidebarPanes';

const ctx = {
  collapsedSections: {},
  setSectionCollapsed: () => {},
} as unknown as TrialChromeContext;

const contributions: RegionContribution<TrialChromeContext>[] = [
  { id: 'a', region: 'sidebar', item: { title: 'Vars', body: 'vars body', fill: true } },
  { id: 'b', region: 'sidebar', item: { title: 'Checks', body: 'checks body' } },
  { id: 'c', region: 'sidebar', item: { title: 'Notes', body: 'notes body' } },
];
const VIEWPORT = { w: 300, h: 600 };

/** Each section's pane height, read from the box windease lays it out in. */
function paneHeights(container: HTMLElement): number[] {
  return [...container.querySelectorAll<HTMLElement>('.windease-panel')].map((panel) =>
    Number.parseFloat((panel.parentElement as HTMLElement).style.height),
  );
}

describe('<SidebarPanes>', () => {
  it('draws every section with a seam after each but the last', async () => {
    const { container } = await renderSettled(
      <SidebarPanes contributions={contributions} ctx={ctx} viewport={VIEWPORT} />,
    );
    expect(screen.getByText('vars body')).toBeTruthy();
    expect(screen.getByText('notes body')).toBeTruthy();
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2);
  });

  it('gives a section the height it was dragged to, and the last open one what is left', async () => {
    const { container } = await renderSettled(
      <SidebarPanes
        contributions={contributions}
        ctx={ctx}
        viewport={VIEWPORT}
        heights={{ a: 200, b: 150, c: 999 }}
      />,
    );
    const [a, b, c] = paneHeights(container);
    expect([a, b]).toEqual([200, 150]);
    expect(c).toBeGreaterThan(200);
    expect(c).toBeLessThan(260);
  });

  it('holds a folded section to its bar and hands its height to the open ones', async () => {
    const folded = { ...ctx, collapsedSections: { c: true } } as TrialChromeContext;
    const { container } = await renderSettled(
      <SidebarPanes
        contributions={contributions}
        ctx={folded}
        viewport={VIEWPORT}
        heights={{ a: 200 }}
      />,
    );
    const [a, b, c] = paneHeights(container);
    expect(a).toBe(200);
    expect(c).toBe(32);
    expect(b).toBeGreaterThan(300);
    expect(screen.queryByText('notes body')).toBeNull();
  });

  it('reports a seam’s move as that section’s height', async () => {
    const onHeightsChange = vi.fn();
    const { container } = await renderSettled(
      <SidebarPanes
        contributions={contributions}
        ctx={ctx}
        viewport={VIEWPORT}
        heights={{ a: 200 }}
        onHeightsChange={onHeightsChange}
      />,
    );
    const seam = container.querySelector('[role="separator"]') as HTMLElement;
    seam.focus();
    seam.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onHeightsChange).toHaveBeenCalledWith({ a: 208 });
  });
});
