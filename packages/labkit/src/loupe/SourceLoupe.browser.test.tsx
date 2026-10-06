import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createCanvasSource, type CanvasSource } from '@weasel-js/loupe';
import { useEffect, useRef, useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { TrialLoupe } from './TrialLoupe';

// A foreign WebGL canvas — one labkit neither created nor draws — read by the
// lens. Its pixels only exist in the task that drew them, which is what a
// real browser shows and jsdom cannot.

afterEach(cleanup);

const CSS_W = 100;
const CSS_H = 50;
/** The backing store is twice the CSS box, as on a 2x display. */
const SCALE = 2;
/** Four vertical bands, each a quarter of the canvas wide. */
const BANDS: Array<[number, number, number]> = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];

function drawBands(gl: WebGLRenderingContext): void {
  const w = gl.drawingBufferWidth / BANDS.length;
  gl.enable(gl.SCISSOR_TEST);
  BANDS.forEach(([r, g, b], i) => {
    gl.scissor(i * w, 0, w, gl.drawingBufferHeight);
    gl.clearColor(r / 255, g / 255, b / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  });
  gl.disable(gl.SCISSOR_TEST);
}

interface SceneProps {
  /** Whether the drawing code calls `capture()` after it draws. */
  captures: boolean;
  onColorChange?: (hex: string) => void;
  /** Handed the context, and a way to redraw the whole canvas one color — a
   *  frame that changes what is under a lens that has not moved. */
  onReady?: (gl: WebGLRenderingContext, fill: (rgb: [number, number, number]) => void) => void;
}

/** Stands in for an app's own WebGL view: it owns the context, draws on
 *  demand, and hands the lens a source. */
function Scene({ captures, onColorChange, onReady }: SceneProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [source, setSource] = useState<CanvasSource | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { preserveDrawingBuffer: false, antialias: false });
    if (!gl) throw new Error('no WebGL');
    let solid: [number, number, number] | null = null;
    const draw = (): void => {
      if (solid) {
        gl.clearColor(solid[0] / 255, solid[1] / 255, solid[2] / 255, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else drawBands(gl);
      if (captures) s.capture();
    };
    const s = createCanvasSource(gl, { requestRedraw: draw });
    draw();
    setSource(s);
    onReadyRef.current?.(gl, (rgb) => {
      solid = rgb;
      draw();
    });
  }, [captures]);

  return (
    <div className="scene-box" style={{ width: CSS_W, height: CSS_H }}>
      <TrialLoupe
        enabled
        source={source ?? undefined}
        factor={4}
        diameter={40}
        peekKey={null}
        onColorChange={onColorChange}
      >
        <canvas
          ref={ref}
          width={CSS_W * SCALE}
          height={CSS_H * SCALE}
          style={{ display: 'block', width: CSS_W, height: CSS_H }}
        />
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

function aim(container: HTMLElement, x: number, y: number): void {
  const host = container.querySelector('.lk-loupe-host');
  if (!host) throw new Error('no host');
  const r = host.getBoundingClientRect();
  fireEvent.pointerMove(host, { clientX: r.left + x, clientY: r.top + y });
}

/** The lens pixel at a CSS point inside the lens. */
function lensPixel(container: HTMLElement, x: number, y: number): number[] {
  const lens = container.querySelector<HTMLCanvasElement>('.lk-loupe__canvas');
  if (!lens) throw new Error('no lens');
  const k = lens.width / 40;
  const ctx = lens.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  return [...ctx.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data];
}

test('a WebGL canvas without preserveDrawingBuffer reads blank after its frame', async () => {
  // The premise the capture exists for. If this ever reads the bands, the
  // browser has started keeping the buffer and the lens would pass for free.
  let gl: WebGLRenderingContext | null = null;
  render(<Scene captures={false} onReady={(g) => (gl = g)} />);
  await frames(3);
  const canvas = (gl as WebGLRenderingContext | null)?.canvas as HTMLCanvasElement;
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe?.drawImage(canvas, 10, 10, 1, 1, 0, 0, 1, 1);
  expect([...(probe?.getImageData(0, 0, 1, 1).data ?? [])]).toEqual([0, 0, 0, 0]);
});

test('the lens magnifies the frame a foreign WebGL canvas captured', async () => {
  const { container } = render(<Scene captures />);
  await frames(3);
  // On the boundary between the green and blue bands, at 4x: the lens spans
  // 10 CSS px of the canvas, half of each.
  aim(container, 50, 25);
  await waitFor(() => expect(lensPixel(container, 10, 20)).toEqual([0, 255, 0, 255]));
  expect(lensPixel(container, 30, 20)).toEqual([0, 0, 255, 255]);

  aim(container, 12, 25);
  await waitFor(() => expect(lensPixel(container, 20, 20)).toEqual([255, 0, 0, 255]));
});

test('without capture the lens has nothing to show', async () => {
  const { container } = render(<Scene captures={false} />);
  await frames(3);
  aim(container, 50, 25);
  await frames(3);
  expect(lensPixel(container, 10, 20)).toEqual([0, 0, 0, 0]);
});

test('reports the captured color on the first aim', async () => {
  const colors: string[] = [];
  const { container } = render(<Scene captures onColorChange={(c) => colors.push(c)} />);
  await frames(3);
  aim(container, 80, 25);
  await waitFor(() => expect(colors.at(-1)).toBe('#ffffff'));
  aim(container, 30, 25);
  await waitFor(() => expect(colors.at(-1)).toBe('#00ff00'));
});

test('a still aim follows the canvas as it redraws', async () => {
  const colors: string[] = [];
  let fill: ((rgb: [number, number, number]) => void) | undefined;
  const { container } = render(
    <Scene captures onColorChange={(c) => colors.push(c)} onReady={(_, f) => (fill = f)} />,
  );
  await frames(3);
  aim(container, 80, 25);
  await waitFor(() => expect(colors.at(-1)).toBe('#ffffff'));
  fill?.([255, 0, 255]);
  await waitFor(() => expect(colors.at(-1)).toBe('#ff00ff'));
});

test('reads a plain 2D canvas directly, with no capture', async () => {
  function Flat() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
      const ctx = ref.current?.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, CSS_W * SCALE, CSS_H * SCALE);
    }, []);
    return (
      <div style={{ width: CSS_W, height: CSS_H }}>
        <TrialLoupe enabled source={() => ref.current} factor={4} diameter={40} peekKey={null}>
          <canvas
            ref={ref}
            width={CSS_W * SCALE}
            height={CSS_H * SCALE}
            style={{ display: 'block', width: CSS_W, height: CSS_H }}
          />
        </TrialLoupe>
      </div>
    );
  }
  const { container } = render(<Flat />);
  await frames(2);
  aim(container, 50, 25);
  await waitFor(() => expect(lensPixel(container, 20, 20)).toEqual([255, 0, 255, 255]));
});
