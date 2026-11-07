/**
 * Chart mode in a real browser: stencils carried from the Shapes panel, snapping to the grid and
 * to neighbors, and the grid itself.
 */
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { chartPrefs } from './prefs';
import { at, readClientPixels } from './testing/canvasPixels';
import { bodies, chartSession, offWhitePixels, poseOf, saved, type SavedNode } from './testing/chartSession';
import { mountChartApp as mountApp } from './testing/mountChartApp';
import { carryStencil, drag } from './testing/pointer';

const { useTool } = chartSession({ page, userEvent });

describe('WeaselChart stencils and the grid', () => {
  it('drops a stencil dragged from the Shapes panel centered on the drop point', async () => {
    const { host } = await mountApp();
    await carryStencil('decision', at(host, 400, 300));
    await expect.poll(() => bodies().length).toBe(1);
    const pose = bodies()[0]!.pose!;
    // A pointer event's client point is whole pixels, about a world unit at this zoom.
    expect(Math.abs(pose.x + pose.width / 2 - 400)).toBeLessThan(2);
    expect(Math.abs(pose.y + pose.height / 2 - 300)).toBeLessThan(2);
  });

  it('carries the stencil itself to the canvas, centered on the pointer, and drops it there', async () => {
    const { host } = await mountApp();
    const to = at(host, 400, 300);
    let ghost: DOMRect | null = null;
    await carryStencil('decision', to, () => {
      ghost = document.querySelector('[data-stencil="decision"]')?.getBoundingClientRect() ?? null;
    });
    expect(ghost).not.toBeNull();
    const { x, y, width, height } = ghost!;
    expect(Math.abs(x + width / 2 - to.x)).toBeLessThan(1);
    expect(Math.abs(y + height / 2 - to.y)).toBeLessThan(1);
    await expect.poll(() => bodies().length).toBe(1);
    // Drawn at the size it lands: the body's box, its stroke around it.
    const pose = bodies()[0]!.pose!;
    expect(width / height).toBeCloseTo((pose.width + 2) / (pose.height + 2), 2);
    expect(document.querySelector('[data-stencil]')).toBeNull();
  });

  it('snaps a moved body to the grid once View › Snap to grid is on', async () => {
    chartPrefs().set('view.alignmentSnap', false);
    chartPrefs().set('view.spacingSnap', false);
    const { host, canvas } = await mountApp();
    await userEvent.click(page.getByRole('toolbar', { name: 'Flowchart' }).getByRole('button', { name: 'Process' }));
    await drag(canvas, at(host, 100, 100), at(host, 220, 160));
    await expect.poll(() => bodies().length).toBe(1);
    const id = bodies()[0]!.id;

    await userEvent.click(page.getByRole('menuitem', { name: 'View' }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: /^Snap to grid/ }));
    expect(chartPrefs().get('view.snapToGrid')).toBe(true);

    await useTool('Select');
    await drag(canvas, at(host, 160, 130), at(host, 177, 139));
    // Unsnapped, the origin would land near (117, 109).
    await expect.poll(() => poseOf(id).x).toBeCloseTo(120);
    expect(poseOf(id).y).toBeCloseTo(108);
  });

  it('drops a stencil with its box on the grid under snap to grid', async () => {
    chartPrefs().set('view.snapToGrid', true);
    const { host } = await mountApp();
    // A Decision is 120 by 80, so its box would sit at (340, 260): every x probe is 4 past a line
    // of the 12 grid, and its center's y, 300, is on one.
    await carryStencil('decision', at(host, 400, 300));
    await expect.poll(() => bodies().length).toBe(1);
    const pose = bodies()[0]!.pose!;
    expect([pose.x, pose.y, pose.width, pose.height].map(Math.round)).toEqual([336, 260, 120, 80]);

    // The label rides the snap: it sits in its body as it does in one dropped with no snapping.
    chartPrefs().set('view.snapToGrid', false);
    chartPrefs().set('view.alignmentSnap', false);
    chartPrefs().set('view.spacingSnap', false);
    await carryStencil('decision', at(host, 700, 500));
    await expect.poll(() => bodies().length).toBe(2);
    // A label is stored in its body's frame.
    const labelOffset = (body: SavedNode) => {
      const label = saved().find((n) => n.parent === body.id)!.pose!;
      return [label.x, label.y].map((v) => Math.round(v * 100) / 100);
    };
    expect(labelOffset(bodies()[0]!)).toEqual(labelOffset(bodies()[1]!));
  });

  it('lines a dropped stencil up with its neighbor the way a move would, in one undo step', async () => {
    chartPrefs().set('view.spacingSnap', false);
    const { host } = await mountApp();
    const drop = (stencil: string, x: number, y: number) => carryStencil(stencil, at(host, x, y));
    // A Decision spanning y 260..340.
    await drop('decision', 400, 300);
    await expect.poll(() => bodies().length).toBe(1);
    // A Process centered at y 312 spans 282..342: its corner is out of reach of every line, its
    // bottom edge 2 from the Decision's. A move lines the bottoms up; a corner-only snap left it at 282.
    await drop('process', 640, 312);
    await expect.poll(() => bodies().length).toBe(2);
    const decision = bodies().find((b) => b.pose!.height === 80)!.pose!;
    const process = bodies().find((b) => b.pose!.height === 60)!.pose!;
    expect(process.y + process.height).toBeCloseTo(decision.y + decision.height);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => bodies().length).toBe(1);
  });

  it('draws the grid on the page while View › Show grid is on', async () => {
    const { host, canvas } = await mountApp();
    const inkOnPage = () => offWhitePixels(canvas, at(host, 300, 300), at(host, 700, 600));
    // A strip of workspace just left of the page, inside the fit's 24px of padding.
    const workspace = () => readClientPixels(canvas, at(host, -15, 300), at(host, -3, 600));
    // Read before the first paint, the canvas is blank and the page reads as ink.
    await expect.poll(inkOnPage).toBe(0);
    const bare = workspace();
    await userEvent.click(page.getByRole('menuitem', { name: 'View' }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: /^Show grid/ }));
    await expect.poll(inkOnPage).toBeGreaterThan(1000);
    expect(workspace()).toEqual(bare);
    await page.screenshot({ element: host, path: '__screenshots__/chart.stencils.browser.test.tsx/grid.png' });
  });
});
