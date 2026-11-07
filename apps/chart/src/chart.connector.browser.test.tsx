/**
 * Chart mode in a real browser: drawing bodies, joining them with the connector, ports, routing,
 * segment slides, delete and undo, driven through the canvas the way a user would.
 */
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { themeEdgeStroke } from '@weasel-js/diagram';
import { at } from './testing/canvasPixels';
import { bodies, chartSession, edges, key, paper } from './testing/chartSession';
import { mountChartApp as mountApp } from './testing/mountChartApp';
import { click, drag } from './testing/pointer';

const { twoBodies, useTool } = chartSession({ page, userEvent });

describe('WeaselChart connectors', () => {
  it('draws bodies, joins them with the connector, deletes one with its edge, and undoes it', async () => {
    const { host, canvas } = await mountApp();
    const [first] = await twoBodies(host, canvas);

    await useTool('Connector');
    await drag(canvas, at(host, 150, 140), at(host, 560, 140));
    await expect.poll(() => edges().length).toBe(1);
    expect(edges()[0]!.data.diagram).toMatchObject({ from: {}, to: {} });
    // The paper theme's ink for a white page, not the kit's dark-ground defaults.
    expect(edges()[0]!.data.stroke).toEqual(themeEdgeStroke(paper));
    expect(bodies()[0]!.data.fill).toEqual({ paint: { color: paper.roles.default!.fill } });

    await useTool('Select');
    await click(canvas, at(host, 130, 115));
    key('Delete');
    await expect.poll(() => bodies().map((b) => b.id)).not.toContain(first);
    expect(edges()).toHaveLength(0);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => bodies().length).toBe(2);
    expect(edges()).toHaveLength(1);
  });

  it('starts a connect from a port with the connector tool, and glues the edge to that port', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    // The first body's east port, the middle of its right edge, onto the second body's west port.
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const { from, to } = edges()[0]!.data.diagram as { from: { port?: string }; to: { port?: string } };
    expect(from.port).toBeDefined();
    expect(to.port).toBeDefined();
  });

  it('slides a connector\'s segment by its bar, resets the route from the Format menu, and undoes the reset', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    // East port to west port: one straight segment along y = 130.
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const waypoints = () => (edges()[0]!.data.diagram as { waypoints?: { x: number; y: number }[] }).waypoints;
    expect(waypoints()).toBeUndefined();

    await useTool('Select');
    await click(canvas, at(host, 300, 130));
    await new Promise((r) => requestAnimationFrame(r));
    // The bar sits in the segment's middle. A connector routed around shapes pins only the dragged segment: its two
    // ends, jogged off the ports, become the waypoints.
    await drag(canvas, at(host, 360, 130), at(host, 360, 200));
    await expect.poll(() => waypoints()?.length).toBe(2);
    const [b, c] = waypoints()!;
    expect(Math.abs(b!.y - 200)).toBeLessThan(2);
    expect(c!.y).toBe(b!.y);

    await userEvent.click(page.getByRole('menuitem', { name: 'Format' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Connector/ }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Reset route/ }));
    await expect.poll(waypoints).toBeUndefined();

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(() => waypoints()?.length).toBe(2);
  });

  it('routes a connector around a shape dragged across it, and undo puts both back', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await drag(canvas, at(host, 300, 300), at(host, 420, 360));
    await expect.poll(() => bodies().length).toBe(3);
    await useTool('Connector');
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const route = () => (edges()[0]!.data.diagram as { route?: { x: number; y: number }[] }).route;
    await expect.poll(route).toEqual([]);

    await useTool('Select');
    await drag(canvas, at(host, 360, 330), at(host, 360, 130));
    await expect.poll(() => route()?.length ?? 0).toBeGreaterThan(0);
    // Every bend keeps clear of the shape now sitting on the old line, from (300, 100) to (420, 160).
    for (const p of route()!) expect(p.y < 100 || p.y > 160 || p.x < 300 || p.x > 420).toBe(true);

    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Undo/ }));
    await expect.poll(route).toEqual([]);
  });
});
