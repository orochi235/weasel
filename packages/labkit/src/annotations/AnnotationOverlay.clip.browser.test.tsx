import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './AnnotationOverlay.clip.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { useAnnotations } from './AnnotationsContext';

// A target's marks are drawn into the lab's shared buffer and take input from
// a box the lab mounts, neither inside the element that clips the target. So
// whether a mark stops where its target is cut off is the scissor's and the
// hit-test's to answer, and only a browser has either.

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(1000, 700);
});

const CONTENT = { w: 300, h: 120 };
const pane: { current: HTMLDivElement | null } = { current: null };

function Count() {
  const marks = useAnnotations().query();
  return (
    <output data-testid="count" data-frac={JSON.stringify(marks[0]?.frac ?? null)}>
      {marks.length}
    </output>
  );
}

/** Where the first mark is stored, in fractions of its target's content box. */
const storedFrac = (): { x: number; y: number; w: number; h: number } =>
  JSON.parse(screen.getByTestId('count').dataset.frac ?? 'null');

const Clipped = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Clipped',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => (
    <>
      <div className="lk-clip-lab-row">
        <div className="lk-clip-lab-beside" />
        <div className="lk-clip-lab-window">
          <div className="lk-clip-lab-pane" ref={pane} />
        </div>
      </div>
      <Count />
    </>
  ),
  annotations: { targets: () => [{ id: 'pane', ref: pane, content: CONTENT }] },
});

type Pixel = [number, number, number];

/** A screenshot's pixels along a line, in viewport px. */
async function line(x0: number, y0: number, x1: number, y1: number): Promise<Pixel[]> {
  // With `save: false` the call resolves to the base64 string alone.
  const base64 = (await page.screenshot({ base64: true, save: false })) as unknown as string;
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  const scale = img.width / window.innerWidth;
  const out: Pixel[] = [];
  const steps = Math.round(Math.max(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round((x0 + ((x1 - x0) * i) / steps) * scale);
    const y = Math.round((y0 + ((y1 - y0) * i) / steps) * scale);
    const d = g.getImageData(x, y, 1, 1).data;
    out.push([d[0] ?? 0, d[1] ?? 0, d[2] ?? 0]);
  }
  return out;
}

/** A mouse drag over `input` in eight steps, one a frame, in viewport px. */
async function drag(input: HTMLElement, [x0, y0]: [number, number], [x1, y1]: [number, number]): Promise<void> {
  const fire = (type: string, x: number, y: number, buttons: number): void => {
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
        clientX: x,
        clientY: y,
      }),
    );
  };
  fire('pointerdown', x0, y0, 1);
  for (let i = 1; i <= 8; i++) {
    fire('pointermove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8, 1);
    await new Promise((r) => requestAnimationFrame(r));
  }
  fire('pointerup', x1, y1, 0);
}

const BLUE = '0,0,255';
const GREEN = '0,255,0';
const not = (color: string, pixels: Pixel[]): number =>
  pixels.filter((p) => p.join() !== color).length;

test('a mark is cut where its target is, and takes no press past it', async () => {
  renderWithIcons(
    <div className="lk-clip-lab-host">
      <Lab instruments={[Clipped]} defaultInstrument="Clipped" />
    </div>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
  await waitFor(() => expect(document.querySelector('.lk-annotate__input')).not.toBeNull());
  const input = document.querySelector('.lk-annotate__input') as HTMLElement;
  const el = pane.current as HTMLElement;
  const whole = el.getBoundingClientRect();
  const shown = (el.parentElement as HTMLElement).getBoundingClientRect();
  expect(shown.left - whole.left).toBeCloseTo(100, 0);

  // The box that takes input covers the part of the target that shows.
  await waitFor(() => {
    const r = input.getBoundingClientRect();
    expect(r.left).toBeCloseTo(shown.left, 0);
    expect(r.width).toBeCloseTo(shown.width, 0);
  });
  const mid = whole.top + whole.height / 2;
  expect(document.elementFromPoint(shown.left + 50, mid)).toBe(input);
  expect(document.elementFromPoint(whole.left + 50, mid)).not.toBe(input);

  // A rectangle from the visible corner out past the cut: 20px inside the
  // whole target on every side, so its left 80px lie under the neighbor.
  const x0 = whole.right - 20;
  const y0 = whole.bottom - 20;
  const x1 = whole.left + 20;
  const y1 = whole.top + 20;
  await drag(input, [x0, y0], [x1, y1]);
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  input.blur();
  // Stored against the whole target, the part cut off included.
  const clipped = storedFrac();
  expect(clipped.x).toBeCloseTo(20 / CONTENT.w, 1);
  expect(clipped.x + clipped.w).toBeCloseTo(280 / CONTENT.w, 1);

  await waitFor(
    async () => {
      // Drawn where it was dragged: its right edge crosses the middle row 20px
      // in from the target's right, and its top edge runs along the visible part.
      expect(not(BLUE, await line(x0 - 8, mid, x0 + 8, mid))).toBeGreaterThan(0);
      const top = await line(shown.left + 40, y1 - 8, shown.left + 40, y1 + 8);
      expect(not(BLUE, top)).toBeGreaterThan(0);
      // And nothing of it over what sits beside the target.
      const along = await line(whole.left + 2, y1, shown.left - 2, y1);
      expect(not(GREEN, along)).toBe(0);
      const across = await line(x1, whole.top + 2, x1, whole.bottom - 2);
      expect(not(GREEN, across)).toBe(0);
    },
    { timeout: 5000 },
  );
});

const scroller: { current: HTMLDivElement | null } = { current: null };

// The target is the scroller's own box; its marks live in the content it scrolls.
const Scrolling = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Scrolling',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => (
    <>
      <div className="lk-clip-lab-scroller" ref={scroller}>
        <div className="lk-clip-lab-tall" />
      </div>
      <Count />
    </>
  ),
  annotations: {
    targets: () => {
      const el = scroller.current;
      const w = el?.offsetWidth || 1;
      const h = el?.offsetHeight || 1;
      return [
        {
          id: 'scroller',
          ref: scroller,
          content: { w: Math.max(w, el?.scrollWidth ?? 0), h: Math.max(h, el?.scrollHeight ?? 0) },
          shown: { x: el?.scrollLeft ?? 0, y: el?.scrollTop ?? 0, w, h },
        },
      ];
    },
  },
});

test('a mark on scrolled content moves with it as its target scrolls', async () => {
  renderWithIcons(
    <div className="lk-clip-lab-host">
      <Lab instruments={[Scrolling]} defaultInstrument="Scrolling" />
    </div>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
  await waitFor(() => expect(document.querySelector('.lk-annotate__input')).not.toBeNull());
  const input = document.querySelector('.lk-annotate__input') as HTMLElement;
  const el = scroller.current as HTMLElement;
  const box = el.getBoundingClientRect();
  await waitFor(() => expect(input.getBoundingClientRect().height).toBeCloseTo(box.height, 0));

  el.scrollTop = 30;
  // Edges 40px and 140px down the box: 70px and 170px down the content.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await drag(input, [box.left + 40, box.top + 40], [box.left + 200, box.top + 140]);
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  input.blur();
  const stored = storedFrac();
  expect(stored.y * el.scrollHeight).toBeCloseTo(70, -1);
  expect((stored.y + stored.h) * el.scrollHeight).toBeCloseTo(170, -1);

  const x = box.left + 120;
  const across = (y: number) => line(x, box.top + y - 6, x, box.top + y + 6);
  await waitFor(async () => expect(not(BLUE, await across(140))).toBeGreaterThan(0), { timeout: 5000 });

  el.scrollTop = 90;
  expect(el.scrollTop).toBe(90);
  // The bottom edge has risen by the scroll, and nothing is left where it was.
  await waitFor(
    async () => {
      expect(not(BLUE, await across(80))).toBeGreaterThan(0);
      expect(not(BLUE, await across(140))).toBe(0);
    },
    { timeout: 5000 },
  );
});
