import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './LabLightbox.browser.test.less';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { useAnnotations } from '../annotations/AnnotationsContext';
import { defineInstrument } from '../instrument/defineInstrument';
import { toDeviceRect } from '../surface/deviceRect';
import { useSurface, useSurfaceCanvas, useSurfaceTile, useTileId } from '../surface/useSurfaceTile';
import { Lab } from './Lab';

// Annotation marks are drawn into the lab's shared buffer and take input from
// a box the lab mounts, neither inside the trial. Whether they come along when
// the trial is expanded is stacking and hit-testing — a browser's to answer.

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(1000, 700);
});

const CONTENT = { w: 200, h: 100 };
const panes = new Map<string, { current: HTMLDivElement | null }>();
const paneFor = (id: string) => {
  let ref = panes.get(id);
  if (!ref) {
    ref = { current: null };
    panes.set(id, ref);
  }
  return ref;
};

function Count() {
  return <output data-testid="count">{useAnnotations().query().length}</output>;
}

/** Stands in for a 3D view: paints its rect green in the shared buffer
 *  under the trials, through the surface, as a three.js tenant would. */
function Solid() {
  const attach = useSurfaceTile('solid');
  const id = useTileId('solid');
  const surface = useSurface();
  const canvas = useSurfaceCanvas('under');
  useEffect(
    () =>
      surface.registerPainter(id, (rect, frame) => {
        const gl = canvas?.getContext('webgl2', { preserveDrawingBuffer: true });
        if (!gl) return;
        const v = toDeviceRect(rect, frame.size.height, frame.dpr);
        const px = (n: number) => Math.round(n * frame.dpr);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(px(v.x), px(v.y), px(v.w), px(v.h));
        gl.clearColor(0, 1, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      }),
    [surface, id, canvas],
  );
  return <div className="lk-lightbox-lab-solid" ref={attach} />;
}

/** The under buffer's own pixel at a viewport point, read back from GL. */
function underPixelAt(x: number, y: number): [number, number, number] {
  const canvas = document.querySelector('.lk-lab__layer--under canvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  const out = new Uint8Array(4);
  const gx = Math.round((x - box.left) * dpr);
  const gy = Math.round(canvas.height - (y - box.top) * dpr);
  gl.readPixels(gx, gy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0] ?? 0, out[1] ?? 0, out[2] ?? 0];
}

const Marked = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Marked',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: (ctx) => (
    <>
      <div
        className="lk-lightbox-lab-pane"
        ref={(el) => {
          paneFor(ctx.trial.id).current = el;
        }}
      />
      <Solid />
      <Count />
    </>
  ),
  annotations: {
    targets: (_s, _c, trial) => [{ id: 'pane', ref: paneFor(trial.id), content: CONTENT }],
  },
});

/** A screenshot's pixels along a horizontal line, in viewport px: what the
 *  compositor shows, top layer included. */
async function rowAt(y: number, x0: number, x1: number): Promise<Array<[number, number, number]>> {
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
  const left = Math.round(x0 * scale);
  const d = g.getImageData(left, Math.round(y * scale), Math.round((x1 - x0) * scale), 1).data;
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < d.length; i += 4) out.push([d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0]);
  return out;
}

const BLUE = '0,0,255';

/** Drags a rectangle across the middle of `box`, in viewport px, delivered
 *  to whatever the browser hit-tests at the press. */
async function drawRect(box: DOMRect): Promise<void> {
  const x0 = box.left + box.width * 0.3;
  const y0 = box.top + box.height * 0.3;
  const x1 = box.left + box.width * 0.7;
  const y1 = box.top + box.height * 0.7;
  const target = document.elementFromPoint(x0, y0) as Element;
  const fire = (type: string, x: number, y: number, buttons: number): void => {
    target.dispatchEvent(
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
  await new Promise((r) => requestAnimationFrame(r));
}

test('an expanded trial keeps its marks over it and takes new ones', async () => {
  render(
    <div className="lk-lightbox-lab-host">
      <Lab instruments={[Marked]} defaultInstrument="Marked" />
    </div>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
  const pane = document.querySelector('.lk-lightbox-lab-pane') as HTMLElement;
  await waitFor(() => expect(document.querySelector('.lk-annotate__input')).not.toBeNull());

  await drawRect(pane.getBoundingClientRect());
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));

  await userEvent.click(screen.getByRole('button', { name: 'Expand trial' }));
  const box = pane.closest('.lk-lightbox') as HTMLElement;
  expect(box.matches(':popover-open')).toBe(true);
  const big = pane.getBoundingClientRect();
  expect(big.width).toBeGreaterThan(window.innerWidth * 0.5);

  // The input box followed the pane into the top layer, and is what a press
  // over the pane reaches.
  const input = document.querySelector('.lk-annotate__input') as HTMLElement;
  await waitFor(() => {
    const r = input.getBoundingClientRect();
    expect(r.left).toBeCloseTo(big.left, 0);
    expect(r.width).toBeCloseTo(big.width, 0);
  });
  expect(document.elementFromPoint(big.left + big.width / 2, big.top + big.height / 2)).toBe(input);

  // The first mark is drawn over the expanded pane: somewhere along the
  // pane's middle row the rectangle's stroke crosses it, and the margins of
  // that row, outside the mark, are still the pane's flat blue.
  await waitFor(
    async () => {
      const row = await rowAt(big.top + big.height / 2, big.left + 2, big.right - 2);
      expect(row[0]?.join()).toBe(BLUE);
      expect(row.at(-1)?.join()).toBe(BLUE);
      expect(row.filter((p) => p.join() !== BLUE).length).toBeGreaterThan(0);
    },
    { timeout: 5000 },
  );

  await drawRect(big);
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

  // The under buffer was lifted below the trial and covers the window, and the
  // tenant painted the expanded solid's rect there.
  const under = document.querySelector('.lk-lab__layer--under') as HTMLElement;
  expect(under.matches(':popover-open')).toBe(true);
  expect(under.getBoundingClientRect().width).toBeCloseTo(window.innerWidth, 0);
  const solid = (
    document.querySelector('.lk-lightbox-lab-solid') as HTMLElement
  ).getBoundingClientRect();
  expect(solid.width).toBeGreaterThan(0);
  await waitFor(() =>
    expect(underPixelAt(solid.left + solid.width / 2, solid.top + solid.height / 2)).toEqual([
      0, 255, 0,
    ]),
  );

  await userEvent.keyboard('{Escape}');
  expect(box.matches(':popover-open')).toBe(false);
});
