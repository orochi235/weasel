import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { TrialLoupe } from './TrialLoupe';

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
  onColorChange,
}: {
  enabled?: boolean;
  onColorChange?: (hex: string) => void;
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
    <div style={{ width: CSS_W, height: CSS_H }}>
      <TrialLoupe
        enabled={enabled}
        source={gl ?? undefined}
        factor={4}
        diameter={DIAMETER}
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
function RenderScene({ enabled }: { enabled?: boolean }) {
  return (
    <div style={{ width: CSS_W, height: CSS_H }}>
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

/** Where the lens is centered, in the host's CSS px, read from layout: its
 *  box's corner plus half the diameter, since the border sits outside it. */
function lensCenter(container: HTMLElement): { x: number; y: number } | null {
  const lens = container.querySelector<HTMLElement>('.lk-loupe');
  if (!lens) return null;
  const l = lens.getBoundingClientRect();
  const h = host(container).getBoundingClientRect();
  return { x: l.left + DIAMETER / 2 - h.left, y: l.top + DIAMETER / 2 - h.top };
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
  // The stage is slid so the aimed point lands mid-lens.
  const stage = container.querySelector<HTMLElement>('.lk-loupe__stage');
  expect(stage?.style.transform).toBe(`translate(${DIAMETER / 2 - 70}px, ${DIAMETER / 2 - 20}px)`);
});
