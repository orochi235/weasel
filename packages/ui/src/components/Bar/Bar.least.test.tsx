import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Bar } from './Bar';
import { DockBarContext } from '../ToolbarDock/dockContext';

// jsdom lays nothing out: each cell is 30 px long, a spacer 0, and the bar 500 px, so its line holds every cell.
const realRect = Element.prototype.getBoundingClientRect;
const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const width = this.matches('[data-bar-item]:not([aria-hidden])') ? 30 : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 20, width, height: 20, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', realWidth);
});
afterEach(cleanup);

it('keeps room for its first cell, not a spacer ahead of it, as the least it can be', () => {
  const reported: (number | undefined)[] = [];
  render(
    <DockBarContext.Provider value={{ barId: 'b', label: 'B', movable: false, onLeast: (px) => { reported.push(px); } }}>
      <Bar label="Tools" overflow="menu">
        <Bar.Spacer />
        <button type="button">a</button>
        <button type="button">b</button>
      </Bar>
    </DockBarContext.Provider>,
  );
  expect(reported.at(-1)).toBe(30);
});
