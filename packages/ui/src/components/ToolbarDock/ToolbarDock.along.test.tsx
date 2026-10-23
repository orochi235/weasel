import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { arcShape, trackRun } from '@weasel-js/geom';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';

// jsdom lays nothing out: every element is 40 wide and every box is 200 by 200 at (0, 0), so the arc below overflows.
const realRect = Element.prototype.getBoundingClientRect;
const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 40 });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realWidth);
});
afterEach(cleanup);

const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
const run = trackRun(shape);
const number = (name: string) => ({ kind: 'number', name, description: '', default: 4 }) as PrefLeaf;
const fields: PrefGroup = { name: 'Tools', children: Object.fromEntries(['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((n) => [n, number(n)])) };
const values = Object.fromEntries(Object.keys(fields.children).map((n) => [n, 4]));

const docks: DockSpec[] = [{ id: 'top', edge: 'top' }];
const bars: DockBar[] = [{ id: 'tools', label: 'Tools', docks: ['top'], render: () => <Bar schema={fields} values={values} shape={shape} label="Tools" /> }];
const layout: ToolbarLayout = { docks: { top: [['tools']] }, floating: {} };

const at = (g: number) => {
  const { point } = run.at(g);
  return { pointerId: 1, button: 0, pointerType: 'mouse', pressure: 0.5, clientX: point.x, clientY: point.y };
};
const drag = (from: Element) => {
  fireEvent.pointerDown(from, { ...at(0.5), buttons: 1 });
  fireEvent.pointerMove(document, { ...at(0.3), buttons: 1 });
  fireEvent.pointerUp(document, { ...at(0.3), buttons: 0 });
};
/** How much of each thing on the run shows, lead first: what a scroll changes. */
const clips = () => Array.from(screen.getByRole('toolbar', { name: 'Tools' }).querySelectorAll(':scope > [data-clipped]'), (el) => el.getAttribute('data-clipped'));

describe('a curved bar in a dock', () => {
  it('does not scroll its run on a drag from the dock handle, and still does from an item', () => {
    render(<ToolbarDock docks={docks} bars={bars} layout={layout} movable />);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toHaveAttribute('data-shape', 'arc');
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toHaveAttribute('data-scrolls');
    const before = clips();
    expect(before[0]).toBe('none');
    drag(screen.getByRole('button', { name: 'Move Tools toolbar' }));
    expect(clips()).toEqual(before);
    drag(screen.getByRole('button', { name: 'n2' }));
    expect(clips()).not.toEqual(before);
  });
});
