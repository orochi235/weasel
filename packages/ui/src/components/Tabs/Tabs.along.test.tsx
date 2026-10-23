import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { Along, arcInBox, type AlongArc } from '../Along';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';
import alongStyles from '../Along/Along.module.css';

// jsdom lays nothing out: an Along is 200 by 200, every other element 40 wide and 20 tall, every box at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
const isAlong = (el: HTMLElement) => el.classList.contains(alongStyles.along!);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 40; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 20; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  for (const [k, d] of realOffset) Object.defineProperty(HTMLElement.prototype, k, d);
});
afterEach(cleanup);

const TOP: AlongArc = { start: 300, end: 60 };
const BOTTOM: AlongArc = { start: 240, end: 120, direction: 'ccw' };
const runOf = (arc: AlongArc) => trackRun(arcShape(arcInBox(arc, { width: 200, height: 200 })));

function Sample({ arc }: { arc?: AlongArc }) {
  const tabs = (
    <Tabs>
      <TabList aria-label="Sections">
        <Tab id="a">A</Tab>
        <Tab id="b">B</Tab>
        <Tab id="c">C</Tab>
      </TabList>
      <TabPanel id="a">panel-a</TabPanel>
      <TabPanel id="b">panel-b</TabPanel>
      <TabPanel id="c">panel-c</TabPanel>
    </Tabs>
  );
  return arc ? <Along arc={arc}>{tabs}</Along> : tabs;
}

const at = (el: Element): Point => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')) };
};
const tabs = () => screen.getAllByRole('tab');
const pathPoints = (d: string): Point[] => [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const rule = () => document.querySelector('[data-tab-rule]')!;
const marker = () => document.querySelector('[data-tab-marker]');

describe('TabList along a curve', () => {
  test('lays its tabs along the run in reading order, a gap apart', () => {
    render(<Sample arc={TOP} />);
    const run = runOf(TOP);
    const along = tabs().map((tab) => run.nearest(at(tab)).f * run.length);
    expect(along.every((d, i) => i === 0 || d > along[i - 1]!)).toBe(true);
    // 40 wide each and no gap from the stylesheet jsdom cannot read: 40 apart, centered on the run.
    expect(along[1]! - along[0]!).toBeCloseTo(40, 0);
    expect(along[1]).toBeCloseTo(run.length / 2, 0);
    expect(tabs().map((tab) => tab.getAttribute('data-run-slot'))).toEqual(['a', 'b', 'c']);
  });

  test('an Along wrapping only the tab list lays the tabs along it too', () => {
    render(
      <Tabs>
        <Along arc={TOP}>
          <TabList aria-label="Sections">
            <Tab id="a">A</Tab>
            <Tab id="b">B</Tab>
          </TabList>
        </Along>
        <TabPanel id="a">panel-a</TabPanel>
        <TabPanel id="b">panel-b</TabPanel>
      </Tabs>,
    );
    const xs = tabs().map((tab) => at(tab).x);
    expect(xs[1]! - xs[0]!).toBeGreaterThan(30);
    expect(rule()).not.toBeNull();
  });

  test('outside an Along it renders as a straight list', () => {
    render(<Sample />);
    expect(tabs()[0]!.style.getPropertyValue('--at-x')).toBe('');
    expect(tabs()[0]).not.toHaveAttribute('data-run-slot');
    expect(rule()).toBeNull();
  });

  test("draws its rule inside the bend, half the tabs' height off the run, on a top arc and a bottom arc", () => {
    for (const arc of [TOP, BOTTOM]) {
      const { unmount } = render(<Sample arc={arc} />);
      const center = { x: 100, y: 100 };
      const radius = runOf(arc).shape.at(0).point;
      const r = Math.hypot(radius.x - center.x, radius.y - center.y);
      for (const p of pathPoints(rule().getAttribute('d')!)) expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(r - 10, 1);
      expect(tabs()[0]).toHaveAttribute('data-inside', arc === TOP ? 'bottom' : 'top');
      unmount();
    }
  });

  test("lays the lit tab's marker along the rule across that tab, and moves it with the selection", () => {
    render(<Sample arc={TOP} />);
    const run = runOf(TOP);
    const span = () => pathPoints(marker()!.getAttribute('d')!).map((p) => run.nearest(p).f * run.length);
    const centerOf = (tab: Element) => run.nearest(at(tab)).f * run.length;
    let s = span();
    expect(s[0]).toBeCloseTo(centerOf(tabs()[0]!) - 20, 0);
    expect(s.at(-1)).toBeCloseTo(centerOf(tabs()[0]!) + 20, 0);
    fireEvent.click(screen.getByText('C'));
    expect(screen.getByText('panel-c')).toBeInTheDocument();
    s = span();
    expect((s[0]! + s.at(-1)!) / 2).toBeCloseTo(centerOf(tabs()[2]!), 0);
  });

  test('the arrow keys move along the tabs in reading order', () => {
    render(<Sample arc={TOP} />);
    act(() => tabs()[0]!.focus());
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs()[1]);
    expect(screen.getByText('panel-b')).toBeInTheDocument();
  });
});
