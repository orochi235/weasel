/**
 * Editing a chart through a real canvas: a drag on a bar's end or a line's
 * point reports the spec it leaves, and a still click reports nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import { textMeasure } from './measure';
import { PlotView } from './PlotView';
import { PLOT_THEME } from './theme';
import { compileXyChart } from './xychart/compile';
import type { XyChartData } from './xychart/types';

registerCanvasFont('sans-serif');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const DATA: XyChartData = {
  kind: 'xychart',
  x: { kind: 'band', categories: ['a', 'b', 'c'] },
  y: { min: 0, max: 100 },
  series: [{ kind: 'bar', values: [20, 50, 80] }, { kind: 'line', values: [30, 60, 40] }],
};
const SIZE = { width: 480, height: 320 };
const { marks, layout } = compileXyChart(DATA, SIZE, PLOT_THEME, textMeasure);
const markAt = (key: string) => marks.find((m) => m.key === key)!.pose;

async function mount(onChange: (data: XyChartData) => void): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(PlotView, { data: DATA, onChange: onChange as never, ...SIZE })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + x, clientY: box.top + y,
  }));
}

async function drag(canvas: HTMLCanvasElement, from: { x: number; y: number }, toY: number): Promise<void> {
  pointer(canvas, 'pointermove', from.x, from.y);
  pointer(canvas, 'pointerdown', from.x, from.y);
  for (let i = 1; i <= 8; i++) {
    pointer(canvas, 'pointermove', from.x, from.y + ((toY - from.y) * i) / 8);
    await frame();
  }
  pointer(canvas, 'pointerup', from.x, toY);
  await frame();
}

describe('dragging in PlotView', () => {
  it('moves a bar\'s value with its top', async () => {
    const onChange = vi.fn();
    const canvas = await mount(onChange);
    const bar = markAt('bar:0:1');
    await drag(canvas, { x: bar.x + bar.width / 2, y: bar.y }, layout.value.map(70));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].series[0].values).toEqual([20, 70, 80]);
  });

  it('moves a line\'s value with its point', async () => {
    const onChange = vi.fn();
    const canvas = await mount(onChange);
    const point = markAt('point:1:2');
    await drag(canvas, { x: point.x + point.width / 2, y: point.y + point.height / 2 }, layout.value.map(10));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].series[1].values).toEqual([30, 60, 10]);
  });

  it('reports nothing for a still click on a handle', async () => {
    const onChange = vi.fn();
    const canvas = await mount(onChange);
    const bar = markAt('bar:0:0');
    pointer(canvas, 'pointermove', bar.x + bar.width / 2, bar.y);
    pointer(canvas, 'pointerdown', bar.x + bar.width / 2, bar.y);
    pointer(canvas, 'pointerup', bar.x + bar.width / 2, bar.y);
    await frame();
    expect(onChange).not.toHaveBeenCalled();
  });
});
