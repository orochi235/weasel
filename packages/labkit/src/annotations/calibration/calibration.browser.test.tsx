import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../styles.less';
import './calibration.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { Lab } from '@weasel-js/labkit';
import { setToolOption, type ToolOptionValues } from '@weasel-js/routing';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { MARK_LINE_OPTIONS } from '../options';
import { MARK_COLOR, MARK_WIDTH } from '../paint';
import { useLabToolOptionValues } from '../useLabToolOptions';
import { calibrationInstrument } from './calibrationInstrument';
import { type CalibrationConfig, DEFAULT_CONDITION, pxPerUnit, zoomWindow } from './condition';
import { EXERCISES, type Exercise, type Pt } from './exercises';

// Whether a mark lands where the pointer went is a question of layout, scroll and the shared buffer's placement,
// so only a browser can answer it. Every exercise is drawn along its own guide exactly; anything the score then
// reports is the pipeline's error, not a hand's.

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(1800, 1200);
});

const TOLERANCE_PX = 0.5;
const TOOL_LABEL: Record<string, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  stroke: 'Freehand',
  text: 'Text',
};

const held: { values: ToolOptionValues | null } = { values: null };
function HoldToolOptions() {
  held.values = useLabToolOptionValues();
  return null;
}

function setStyle(tool: string, key: 'width' | 'color', value: unknown): void {
  if (!held.values) throw new Error('the lab never published its tool option values');
  setToolOption(tool, MARK_LINE_OPTIONS, held.values, key, value);
}

const frames = (n = 2) =>
  new Promise<void>((done) => {
    const step = (left: number) =>
      left === 0 ? done() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

function fire(input: Element, type: string, p: Pt, buttons: number): void {
  input.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons,
      clientX: p.x,
      clientY: p.y,
    }),
  );
}

/** A drag through `path`, in viewport px, one point a frame. */
async function drag(path: readonly Pt[]): Promise<void> {
  const first = path[0] as Pt;
  const input = document.elementFromPoint(first.x, first.y);
  expect(input?.classList.contains('lk-annotate__input'), 'the press lands on the target').toBe(
    true,
  );
  const el = input as Element;
  fire(el, 'pointerdown', first, 1);
  for (const p of path.slice(1)) {
    fire(el, 'pointermove', p, 1);
    await frames(1);
  }
  fire(el, 'pointerup', path[path.length - 1] as Pt, 0);
}

/** Eight steps from `a` to `b`. */
function straight(a: Pt, b: Pt): Pt[] {
  return Array.from({ length: 9 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / 8,
    y: a.y + ((b.y - a.y) * i) / 8,
  }));
}

/** The content-unit path that draws `ex` exactly. */
function contentPath(ex: Exercise): Pt[] {
  const g = ex.guide;
  if (g.kind === 'segment') return straight(g.a, g.b);
  if (g.kind === 'curve')
    return g.points.filter((_, i) => i % 8 === 0 || i === g.points.length - 1);
  const { x, y, w, h } = g.box;
  if (ex.expect === 'text') return straight({ x, y }, { x: x + 60, y: y + 20 });
  return straight({ x, y }, { x: x + w, y: y + h });
}

const picture = () => screen.getByTestId('calibration-picture');

/** Content units to viewport px, through the picture element as it now sits. */
function toScreen(config: CalibrationConfig, p: Pt): Pt {
  const r = picture().getBoundingClientRect();
  const k = pxPerUnit(config);
  const win = zoomWindow(config);
  return { x: r.left + (p.x - win.x) * k, y: r.top + (p.y - win.y) * k };
}

/** Scrolls a scrolled pane so the whole of `ex`'s cell shows. */
async function bringIntoView(config: CalibrationConfig, ex: Exercise): Promise<void> {
  if (!config.scrolled) return;
  const frame = screen.getByTestId('calibration-frame');
  frame.scrollTop = ex.area.y * pxPerUnit(config) - 8;
  await frames(2);
}

async function draw(config: CalibrationConfig, ex: Exercise): Promise<void> {
  await bringIntoView(config, ex);
  await userEvent.click(screen.getByRole('button', { name: TOOL_LABEL[ex.expect] as string }));
  const tool = ex.expect;
  if (ex.width !== undefined) setStyle(tool, 'width', ex.width);
  if (ex.color !== undefined) setStyle(tool, 'color', ex.color);
  await frames(2);
  await drag(contentPath(ex).map((p) => toScreen(config, p)));
  await waitFor(() => expect(row(ex).dataset.status).not.toBe('missing'));
  if (ex.width !== undefined) setStyle(tool, 'width', MARK_WIDTH);
  if (ex.color !== undefined) setStyle(tool, 'color', MARK_COLOR);
}

function row(ex: Exercise): HTMLElement {
  const el = document.querySelector(`.lk-cal__row[data-exercise="${ex.id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no results row for ${ex.id}`);
  return el;
}

function expectScored(ex: Exercise): void {
  const r = row(ex);
  const [error, max] = [...r.querySelectorAll('.lk-cal__num')].map((c) =>
    Number.parseFloat(c.textContent ?? ''),
  );
  expect(r.dataset.status, `${ex.id}: ${r.querySelector('th')?.title ?? ''}`).toBe('pass');
  expect(error, `${ex.id} error px`).toBeLessThan(TOLERANCE_PX);
  if (ex.guide.kind === 'curve') expect(max, `${ex.id} max px`).toBeLessThan(TOLERANCE_PX);
}

async function mount(config: CalibrationConfig): Promise<void> {
  renderWithIcons(
    <div className="lk-cal-test-host">
      <Lab instruments={[calibrationInstrument(config)]}>
        <HoldToolOptions />
      </Lab>
    </div>,
  );
  const picture = await screen.findByTestId('calibration-picture');
  // The pointer starts where the last case left it, often on a toolbar button whose tooltip covers this one.
  await userEvent.hover(picture);
  await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull());
  await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
  await waitFor(() => expect(document.querySelector('.lk-annotate__input')).not.toBeNull());
  await frames(2);
}

// Text last: inserting one can leave a text editor holding focus.
const ORDER = [...EXERCISES].sort(
  (a, b) => Number(a.expect === 'text') - Number(b.expect === 'text'),
);

const WHOLE_SHEET: readonly [string, Partial<CalibrationConfig>][] = [
  ['at 1×', {}],
  ['at 0.5×', { scale: '0.5' }],
  ['at 2×', { scale: '2' }],
  ['in a scrolled pane', { scrolled: true }],
  ['in a scrolled pane at 2×', { scrolled: true, scale: '2' }],
];

test.each(WHOLE_SHEET)('every exercise scores under half a pixel %s', async (_name, start) => {
  const config = { ...DEFAULT_CONDITION, ...start };
  await mount(config);
  for (const ex of ORDER) await draw(config, ex);
  for (const ex of EXERCISES) expectScored(ex);
});

// A zoom shows one exercise's neighborhood, so each is drawn in a lab zoomed onto it.
const ZOOMED = (['1.5', '3'] as const).flatMap((zoom) =>
  EXERCISES.map((ex) => [zoom, ex.id] as const),
);

test.each(ZOOMED)(
  'zoomed %s× onto %s, the exercise scores under half a pixel',
  async (zoom, id) => {
    const ex = EXERCISES.find((e) => e.id === id) as Exercise;
    const config: CalibrationConfig = { ...DEFAULT_CONDITION, zoom, focus: id };
    await mount(config);
    await draw(config, ex);
    expectScored(ex);
  },
);
