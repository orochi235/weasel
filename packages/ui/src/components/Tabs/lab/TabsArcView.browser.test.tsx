import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { arcShape, trackRun, type Point, type TrackRun } from '@weasel-js/geom';
import { arcInBox } from '../../Along/arcInBox';
import { TABS_ARC_DEFAULTS, tabArcs, TabsArcView, type TabsArcConfig } from './TabsArcView';

afterEach(cleanup);

const frame = () => new Promise((r) => requestAnimationFrame(r));
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...document.querySelectorAll('[style], path')].map((el) => el.getAttribute('style') ?? el.getAttribute('d')).join('|');
    if (now === last) return;
    last = now;
  }
}

async function mount(over: Partial<TabsArcConfig> = {}) {
  await page.viewport(1400, 900);
  const config = { ...TABS_ARC_DEFAULTS, ...over };
  render(<TabsArcView config={config} />);
  await document.fonts.ready;
  await settle();
  const arcs = tabArcs(config);
  const runOf = (which: 'top' | 'bottom') => trackRun(arcShape(arcInBox(arcs[which], { width: config.size, height: config.size })));
  return { config, runOf };
}

const boxOf = (name: 'tabs' | 'pages') => document.querySelector<HTMLElement>(`[data-lab-box="${name}"]`)!;
/** An element's center in its lab box's px, the box unturned. */
const centerIn = (box: HTMLElement, el: Element): Point => {
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - b.left - box.clientLeft, y: r.top + r.height / 2 - b.top - box.clientTop };
};
const along = (run: TrackRun, p: Point) => run.nearest(p, { open: true }).f * run.length;
const ruleOf = (box: HTMLElement) => box.querySelector<SVGPathElement>('[data-tab-rule]')!;
const markerOf = (box: HTMLElement) => box.querySelector<SVGPathElement>('[data-tab-marker]')!;
const midOf = (path: SVGPathElement): Point => path.getPointAtLength(path.getTotalLength() / 2);

test('the tabs sit on the top arc in reading order, upright, the rule half a tab inside them and the marker under the lit tab', async () => {
  const { config, runOf } = await mount();
  const run = runOf('top');
  const box = boxOf('tabs');
  const tabs = within(box).getAllByRole('tab');
  const centers = tabs.map((t) => centerIn(box, t));
  for (const c of centers) expect(run.nearest(c).dist).toBeLessThanOrEqual(1);
  const ds = centers.map((c) => along(run, c));
  for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]!);
  // Upright: a tab's text runs left to right across the top.
  const text = (t: Element) => t.firstChild as Text;
  for (const t of tabs) {
    const range = document.createRange();
    range.selectNodeContents(text(t));
    const rects = [...range.getClientRects()];
    expect(rects.at(-1)!.right).toBeGreaterThan(rects[0]!.left);
  }

  const center = { x: config.size / 2, y: config.size / 2 };
  const radius = Math.hypot(run.at(0).point.x - center.x, run.at(0).point.y - center.y);
  const half = tabs[0]!.offsetHeight / 2;
  const rule = ruleOf(box);
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const p = rule.getPointAtLength(rule.getTotalLength() * f);
    expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(radius - half, 0);
  }
  const lit = tabs.find((t) => t.getAttribute('aria-selected') === 'true')!;
  expect(along(run, midOf(markerOf(box)))).toBeCloseTo(along(run, centerIn(box, lit)), 0);
});

test('the arrow keys move along the arc in reading order, and the marker follows', async () => {
  const { runOf } = await mount();
  const run = runOf('top');
  const box = boxOf('tabs');
  const tabs = within(box).getAllByRole('tab');
  await userEvent.click(tabs[0]!);
  await userEvent.keyboard('{ArrowRight}');
  await settle();
  expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('The layers settings.')).toBeVisible();
  expect(along(run, midOf(markerOf(box)))).toBeCloseTo(along(run, centerIn(box, tabs[1]!)), 0);
});

test('on the bottom arc the page tabs read left to right, + last, the rule inside them toward the page', async () => {
  const { config, runOf } = await mount();
  const run = runOf('bottom');
  const box = boxOf('pages');
  const parts = [...within(box).getAllByRole('tab'), within(box).getByRole('button', { name: 'Add page' })];
  const centers = parts.map((el) => centerIn(box, el));
  for (const c of centers) expect(run.nearest(c).dist).toBeLessThanOrEqual(1);
  for (let i = 1; i < centers.length; i++) expect(centers[i]!.x).toBeGreaterThan(centers[i - 1]!.x);
  const center = { x: config.size / 2, y: config.size / 2 };
  const radius = Math.hypot(run.at(0).point.x - center.x, run.at(0).point.y - center.y);
  const mid = midOf(ruleOf(box));
  expect(Math.hypot(mid.x - center.x, mid.y - center.y)).toBeCloseTo(radius - parts[0]!.offsetHeight / 2, 0);
  expect(mid.y).toBeLessThan(centers[1]!.y);
});

test('a page tab dragged along the arc past another lands after it, through a turned box', async () => {
  const { runOf } = await mount({ turn: 25 });
  const run = runOf('bottom');
  const box = boxOf('pages');
  const tab = (name: string) => within(box).getByRole('tab', { name });
  // The box is turned, so a point along the run reaches the screen through the rule's own matrix.
  const ctm = ruleOf(box).getScreenCTM()!;
  const client = (d: number) => {
    const { point } = run.at(d / run.length, { open: true });
    const p = new DOMPoint(point.x, point.y).matrixTransform(ctm);
    return { clientX: p.x, clientY: p.y };
  };
  const placed = (el: HTMLElement) => along(run, { x: Number.parseFloat(el.style.getPropertyValue('--at-x')), y: Number.parseFloat(el.style.getPropertyValue('--at-y')) });
  const fire = (el: Element, type: string, at: { clientX: number; clientY: number }) =>
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...at }));
  const from = placed(tab('Cover'));
  const to = placed(tab('Back')) + tab('Back').offsetWidth * 0.4;
  fire(tab('Cover'), 'pointerdown', client(from));
  for (let i = 1; i <= 10; i++) {
    fire(document.documentElement, 'pointermove', client(from + ((to - from) * i) / 10));
    await frame();
  }
  expect(box.querySelector('[data-tab-drop]')).not.toBeNull();
  fire(document.documentElement, 'pointerup', client(to));
  await settle();
  expect(within(box).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Body', 'Back', 'Cover']);
});
