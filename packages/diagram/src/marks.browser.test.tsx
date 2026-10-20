import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { registerCanvasFont } from '@weasel-js/font';
import { DiagramView, type NodeMove } from './DiagramView';
import { diagramScene } from './fromData';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');

/** One black box at world (100, 100), 80 by 80, on a black canvas. Its lower
 *  half is a red mark at half opacity; a green text mark hangs off its right edge. */
const SPECS = diagramScene(
  {
    nodes: [{
      id: 'a', lines: [], width: 80, height: 80, at: { x: 100, y: 100 },
      marks: [
        { d: 'M0 0.5 H1 V1 H0 Z', fill: '#ff0000', opacity: 0.5 },
        { text: 'WWW', at: { u: 1, v: 0.5 }, self: { u: 0, v: 0.5 }, offset: { x: 4, y: 0 }, color: '#00ff00', style: { fontSize: 20 } },
      ],
    }],
    edges: [],
  },
  { layout: 'none', nodeStyle: () => ({ fill: '#000000', stroke: '#000000', text: '#000000' }) },
);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DX = 200;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function read(canvas: HTMLCanvasElement) {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const at = (x: number, y: number) => {
    const i = (Math.round(canvas.height - 1 - y * dpr) * canvas.width + Math.round(x * dpr)) * 4;
    return [px[i]!, px[i + 1]!, px[i + 2]!];
  };
  /** Pixels that are mostly green inside a CSS-pixel rect: the text mark's ink. */
  const green = (x0: number, y0: number, x1: number, y1: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const [r, g, b] = at(x, y);
        if (g! > 100 && r! < 60 && b! < 60) n++;
      }
    }
    return n;
  };
  return { at, green };
}

it('carries a node\'s marks with it when the node is dragged, at the opacity they were given', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const moves: NodeMove[] = [];
  await act(async () => {
    root = createRoot(host);
    root.render(
      <DiagramView
        specs={SPECS} width={600} height={300} view={VIEW} onViewChange={() => {}}
        background={{ color: '#000000' }} onMove={(m) => moves.push(...m)}
      />,
    );
  });
  await frame();
  await frame();
  const canvas = host.querySelector('canvas')!;

  const before = read(canvas);
  expect(before.green(184, 100, 280, 180)).toBeGreaterThan(20);
  const red = before.at(140, 160);
  expect(red[0]).toBeGreaterThan(110);
  expect(red[0]).toBeLessThan(145);

  const { left, top } = canvas.getBoundingClientRect();
  await act(async () => {
    fire(canvas, 'pointerdown', left + 140, top + 120);
    for (let i = 1; i <= 10; i++) fire(canvas, 'pointermove', left + 140 + (i * DX) / 10, top + 120);
    fire(canvas, 'pointerup', left + 140 + DX, top + 120);
  });
  await expect.poll(() => moves.some((m) => m.id === 'a')).toBe(true);
  const moved = moves.filter((m) => m.id === 'a').at(-1)!;
  const dx = moved.x - 100;
  const dy = moved.y - 100;
  expect(dx).toBeGreaterThan(150);
  await frame();
  await frame();

  const after = read(canvas);
  // The text mark followed: its ink is beside the node's new place and gone from the old one.
  expect(after.green(184 + dx, 100 + dy, 280 + dx, 180 + dy)).toBeGreaterThan(20);
  expect(after.green(184, 100, 280, 180)).toBe(0);
  // The drawn mark followed and kept its opacity: half-strength red over the black node.
  expect(after.at(140, 160)).toEqual([0, 0, 0]);
  const redAfter = after.at(140 + dx, 160 + dy);
  expect(redAfter[0]).toBeGreaterThan(110);
  expect(redAfter[0]).toBeLessThan(145);
  expect(redAfter[0]).toBeCloseTo(red[0]!, -1);
});
