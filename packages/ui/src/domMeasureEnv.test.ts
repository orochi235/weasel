import { afterEach, expect, it, vi } from 'vitest';
import { domMeasureEnv } from './domMeasureEnv';

afterEach(() => vi.restoreAllMocks());

it('quotes a lone family name in the font it measures with, as every other font string in the kit does', () => {
  const fonts: string[] = [];
  const ctx = {
    set font(v: string) { fonts.push(v); },
    measureText: () => ({ width: 10, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
  };
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = real(tag);
    if (tag === 'canvas') (el as HTMLCanvasElement).getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
    return el;
  });
  const env = domMeasureEnv(document.body);
  env.text('x', { family: 'Font 3D', size: 12 });
  env.text('x', { family: 'Inter, sans-serif', size: 12 });
  expect(fonts.slice(-2)).toEqual(['400 12px "Font 3D"', '400 12px Inter, sans-serif']);
});
