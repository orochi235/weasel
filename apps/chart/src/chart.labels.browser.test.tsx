/**
 * Chart mode in a real browser: edge labels and body text, typed in on the canvas and painted.
 */
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { at } from './testing/canvasPixels';
import { bodies, chartSession, darkPixels, edges, editor, paper, saved } from './testing/chartSession';
import { mountChartApp as mountApp } from './testing/mountChartApp';
import { doubleClick, drag } from './testing/pointer';

const { twoBodies, useTool } = chartSession({ page, userEvent });

describe('WeaselChart labels', () => {
  it('adds and edits an edge label on a double-click of the edge', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await useTool('Connector');
    await drag(canvas, at(host, 150, 130), at(host, 560, 130));
    await expect.poll(() => edges().length).toBe(1);
    const edgeId = edges()[0]!.id;

    await useTool('Select');
    doubleClick(canvas, at(host, 360, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('yes');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(editor).toBeNull();
    await expect.poll(() => saved().find((n) => n.id === `${edgeId}/label`)?.data.text).toBe('yes');
    expect(saved().find((n) => n.id === `${edgeId}/label`)!.data.fill).toEqual({ paint: { color: paper.label.fill } });
  });

  it('moves an edge label off a shape dropped on it, on release', async () => {
    const { host, canvas } = await mountApp();
    await twoBodies(host, canvas);
    await drag(canvas, at(host, 300, 300), at(host, 420, 360));
    await expect.poll(() => bodies().length).toBe(3);
    await useTool('Connector');
    await drag(canvas, at(host, 220, 130), at(host, 500, 130));
    await expect.poll(() => edges().length).toBe(1);
    const labelId = `${edges()[0]!.id}/label`;
    await useTool('Select');
    doubleClick(canvas, at(host, 360, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('label');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(() => saved().find((n) => n.id === labelId)?.data.text).toBe('label');

    // Onto (330, 58)–(450, 118): over the label above the line, clear of the line's own clearance.
    await drag(canvas, at(host, 360, 330), at(host, 390, 88));
    const placed = () => (saved().find((n) => n.id === labelId)?.data.diagram as { label?: { placed?: unknown } }).label?.placed;
    await expect.poll(placed).toBeDefined();
    // The shape's lower interior, where the label stood, clear of its selection handles and its stroke.
    await expect.poll(() => darkPixels(canvas, at(host, 340, 100), at(host, 440, 116))).toBe(0);
  });

  it("types into a body's label and paints its text", async () => {
    const { host, canvas } = await mountApp();
    const [first] = await twoBodies(host, canvas);
    await useTool('Select');
    // The body's middle, clear of its stroke and of the selection handles on its edges.
    const inkInBody = () => darkPixels(canvas, at(host, 110, 115), at(host, 210, 145));
    const blank = inkInBody();
    doubleClick(canvas, at(host, 160, 130));
    await expect.poll(editor).not.toBeNull();
    await userEvent.keyboard('MMMM');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(editor).toBeNull();
    await expect.poll(() => saved().find((n) => n.parent === first)?.data.text).toBe('MMMM');
    await expect.poll(inkInBody).toBeGreaterThan(blank + 20);
  });
});
