import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { TrialLoupe } from './TrialLoupe';
import type { LoupeOptions } from './types';

// The lens has to open where the pointer already is, however it comes up:
// the peek key held over a still pointer, or the lens turned on under one.
// Its position and what it draws are layout and pixels, which is why this is
// a browser test.

afterEach(cleanup);

const CSS_W = 100;
const CSS_H = 50;
const DIAMETER = 40;
/** Four vertical bands, each a quarter of the canvas wide. */
const BANDS: Array<[number, number, number]> = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];

/** A WebGL2 scene whose buffer is preserved, so the lens reads it with no
 *  capture — the shape of astv's 3D stage. */
function SourceScene({
  enabled,
  lab,
  onColorChange,
  shape,
  place,
}: {
  enabled?: boolean;
  /** Mount inside `.lk-root`, under the lab's own resets. */
  lab?: boolean;
  onColorChange?: (hex: string) => void;
  shape?: LoupeOptions['shape'];
  place?: LoupeOptions['place'];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [gl, setGl] = useState<WebGL2RenderingContext | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('webgl2', {
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!ctx) throw new Error('no WebGL2');
    const w = ctx.drawingBufferWidth / BANDS.length;
    ctx.enable(ctx.SCISSOR_TEST);
    BANDS.forEach(([r, g, b], i) => {
      ctx.scissor(i * w, 0, w, ctx.drawingBufferHeight);
      ctx.clearColor(r / 255, g / 255, b / 255, 1);
      ctx.clear(ctx.COLOR_BUFFER_BIT);
    });
    setGl(ctx);
  }, []);
  return (
    <div className={lab ? 'lk-root' : undefined} style={{ width: CSS_W, height: CSS_H }}>
      <TrialLoupe
        enabled={enabled}
        source={gl ?? undefined}
        factor={4}
        diameter={DIAMETER}
        shape={shape}
        place={place}
        onColorChange={onColorChange}
      >
        <canvas
          ref={ref}
          width={CSS_W * 2}
          height={CSS_H * 2}
          style={{ display: 'block', width: CSS_W, height: CSS_H }}
        />
      </TrialLoupe>
    </div>
  );
}

/** DOM content with a `render` lens, which draws it again magnified. */
function RenderScene({ enabled, lab }: { enabled?: boolean; lab?: boolean }) {
  return (
    <div className={lab ? 'lk-root' : undefined} style={{ width: CSS_W, height: CSS_H }}>
      <TrialLoupe
        enabled={enabled}
        factor={4}
        diameter={DIAMETER}
        render={() => <div className="lens-content" />}
      >
        <div style={{ width: CSS_W, height: CSS_H }} />
      </TrialLoupe>
    </div>
  );
}

const frames = (n: number): Promise<void> =>
  new Promise((resolve) => {
    const step = (k: number): void => {
      if (k === 0) resolve();
      else requestAnimationFrame(() => step(k - 1));
    };
    step(n);
  });

function host(container: HTMLElement): HTMLElement {
  const h = container.querySelector<HTMLElement>('.lk-loupe-host');
  if (!h) throw new Error('no host');
  return h;
}

function move(container: HTMLElement, x: number, y: number): void {
  const h = host(container);
  const r = h.getBoundingClientRect();
  fireEvent.pointerMove(h, { clientX: r.left + x, clientY: r.top + y });
}

function peek(down: boolean): void {
  act(() => {
    if (down) fireEvent.keyDown(window, { key: 'Alt' });
    else fireEvent.keyUp(window, { key: 'Alt' });
  });
}

/** The middle of the lens's inner box — inside its ring, where the painters
 *  put the aimed point — in the host's CSS px, read from layout and rounded to
 *  the nearest half pixel. */
function lensCenter(container: HTMLElement): { x: number; y: number } | null {
  const lens = container.querySelector<HTMLElement>('.lk-loupe');
  if (!lens) return null;
  const l = lens.getBoundingClientRect();
  const h = host(container).getBoundingClientRect();
  const half = (n: number): number => Math.round(n * 2) / 2;
  return {
    x: half(l.left + lens.clientLeft + lens.clientWidth / 2 - h.left),
    y: half(l.top + lens.clientTop + lens.clientHeight / 2 - h.top),
  };
}

/** The pixel at the lens's own center. */
function lensMiddle(container: HTMLElement): number[] {
  const lens = container.querySelector<HTMLCanvasElement>('.lk-loupe__canvas');
  if (!lens) throw new Error('no lens canvas');
  const ctx = lens.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  return [...ctx.getImageData(lens.width / 2, lens.height / 2, 1, 1).data];
}

test('a source lens peeked over a still pointer opens under it', async () => {
  const colors: string[] = [];
  const { container } = render(
    <SourceScene enabled={false} onColorChange={(c) => colors.push(c)} />,
  );
  await frames(2);
  // Inside the blue band, then the peek key with no move after it.
  move(container, 62, 25);
  expect(lensCenter(container)).toBeNull();
  peek(true);
  await waitFor(() => expect(lensCenter(container)).toEqual({ x: 62, y: 25 }));
  await waitFor(() => expect(lensMiddle(container)).toEqual([0, 0, 255, 255]));
  expect(colors.at(-1)).toBe('#0000ff');
  peek(false);
  expect(lensCenter(container)).toBeNull();
});

test('a source lens turned on under a still pointer opens under it', async () => {
  const { container, rerender } = render(<SourceScene enabled={false} />);
  await frames(2);
  move(container, 30, 25);
  rerender(<SourceScene enabled />);
  await waitFor(() => expect(lensCenter(container)).toEqual({ x: 30, y: 25 }));
  await waitFor(() => expect(lensMiddle(container)).toEqual([0, 255, 0, 255]));
});

test('a peek before the pointer ever reaches the host shows nothing until it does', async () => {
  const { container } = render(<SourceScene enabled={false} />);
  await frames(2);
  peek(true);
  await frames(2);
  expect(lensCenter(container)).toBeNull();
  move(container, 88, 25);
  await waitFor(() => expect(lensCenter(container)).toEqual({ x: 88, y: 25 }));
  await waitFor(() => expect(lensMiddle(container)).toEqual([255, 255, 255, 255]));
});

test('a render lens peeked over a still pointer opens under it', async () => {
  const { container } = render(<RenderScene enabled={false} />);
  await frames(2);
  move(container, 70, 20);
  peek(true);
  await waitFor(() => expect(lensCenter(container)).toEqual({ x: 70, y: 20 }));
});

// Where the magnified point lands on the page, against the pointer. The ring
// is drawn outside the box the painters fill, so a lens positioned by its
// outer edge puts the aim a border-width off; and under `.lk-root`, whose
// resets make every box `border-box`, the ring also eats into the painters'
// box. Both contexts, since they fail differently.
for (const lab of [false, true]) {
  const where = lab ? 'inside a lab' : 'outside a lab';

  test(`a source lens's magnified point sits under the pointer, ${where}`, async () => {
    const { container } = render(<SourceScene enabled lab={lab} />);
    await frames(2);
    move(container, 62, 25);
    await waitFor(() => expect(container.querySelector('.lk-loupe__canvas')).not.toBeNull());
    const canvas = container.querySelector<HTMLElement>('.lk-loupe__canvas');
    const c = canvas?.getBoundingClientRect() as DOMRect;
    const h = host(container).getBoundingClientRect();
    // The canvas is drawn for exactly the diameter, aim in its middle.
    expect(c.width).toBeCloseTo(DIAMETER, 1);
    expect(c.height).toBeCloseTo(DIAMETER, 1);
    expect(Math.abs(c.left + c.width / 2 - (h.left + 62))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(c.top + c.height / 2 - (h.top + 25))).toBeLessThanOrEqual(0.5);
  });

  test(`a render lens's magnified point sits under the pointer, ${where}`, async () => {
    const { container } = render(<RenderScene enabled lab={lab} />);
    await frames(2);
    move(container, 70, 20);
    await waitFor(() => expect(container.querySelector('.lk-loupe__stage')).not.toBeNull());
    const lens = container.querySelector<HTMLElement>('.lk-loupe') as HTMLElement;
    const stage = container.querySelector<HTMLElement>('.lk-loupe__stage') as HTMLElement;
    const s = stage.getBoundingClientRect();
    const h = host(container).getBoundingClientRect();
    // The stage reproduces the host and zooms about the aim, so the aim sits
    // at its own offset into the stage: under the pointer when the stage
    // lines up with the host.
    expect(lens.clientWidth).toBe(DIAMETER);
    expect(lens.clientHeight).toBe(DIAMETER);
    expect(Math.abs(s.left - h.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(s.top - h.top)).toBeLessThanOrEqual(0.5);
  });
}

test('a placed square lens is drawn at its center, shows the point it names, and reports the aim', async () => {
  const colors: string[] = [];
  // Drawn in the host's middle, showing the middle of the blue band (50–75)
  // at 2x: 30 page px across, so its edges reach the green and white bands.
  const place = () => ({ center: { x: 50, y: 25 }, shows: { x: 62, y: 25 }, width: 60, height: 20, factor: 2 });
  const { container } = render(
    <SourceScene enabled shape="square" place={place} onColorChange={(c) => colors.push(c)} />,
  );
  await frames(2);
  move(container, 30, 25);
  await waitFor(() => expect(container.querySelector('.lk-loupe__canvas')).not.toBeNull());
  const canvas = container.querySelector<HTMLCanvasElement>('.lk-loupe__canvas') as HTMLCanvasElement;
  const c = canvas.getBoundingClientRect();
  const h = host(container).getBoundingClientRect();
  expect(c.width).toBeCloseTo(60, 1);
  expect(c.height).toBeCloseTo(20, 1);
  expect(Math.abs(c.left + c.width / 2 - (h.left + 50))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(c.top + c.height / 2 - (h.top + 25))).toBeLessThanOrEqual(0.5);

  const lens = container.querySelector<HTMLElement>('.lk-loupe') as HTMLElement;
  expect(getComputedStyle(lens).borderTopLeftRadius).not.toBe('50%');

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const at = (x: number): number[] => [...ctx.getImageData(x, canvas.height / 2, 1, 1).data];
  await waitFor(() => expect(lensMiddle(container)).toEqual([0, 0, 255, 255]));
  expect(at(2)).toEqual([0, 255, 0, 255]);
  expect(at(canvas.width - 3)).toEqual([255, 255, 255, 255]);
  // The pointer is over the green band, and that is the color reported.
  await waitFor(() => expect(colors.at(-1)).toBe('#00ff00'));
});

test('a hollow lens draws only its outline, and tells the host where it is', async () => {
  const lenses: unknown[] = [];
  const { container } = render(
    <div style={{ width: CSS_W, height: CSS_H }}>
      <TrialLoupe enabled hollow shape="square" factor={4} diameter={DIAMETER} onLens={(l) => lenses.push(l)}>
        <div style={{ width: CSS_W, height: CSS_H }} />
      </TrialLoupe>
    </div>,
  );
  await frames(2);
  move(container, 30, 25);
  await waitFor(() => expect(lensCenter(container)).toEqual({ x: 30, y: 25 }));
  const lens = container.querySelector<HTMLElement>('.lk-loupe') as HTMLElement;
  expect(lens.children).toHaveLength(0);
  expect(getComputedStyle(lens).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(lens).borderTopStyle).not.toBe('none');
  expect(lenses.at(-1)).toEqual({
    center: { x: 30, y: 25 },
    shows: { x: 30, y: 25 },
    width: DIAMETER,
    height: DIAMETER,
    factor: 4,
    shape: 'square',
  });
});
