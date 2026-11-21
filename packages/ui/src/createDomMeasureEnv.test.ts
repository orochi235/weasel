import { afterEach, expect, it, vi } from 'vitest';
import { createDomMeasureEnv } from './createDomMeasureEnv';

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
  const env = createDomMeasureEnv(document.body);
  env.text('x', { family: 'Font 3D', size: 12 });
  env.text('x', { family: 'Inter, sans-serif', size: 12 });
  expect(fonts.slice(-2)).toEqual(['400 12px "Font 3D"', '400 12px Inter, sans-serif']);
});

it('measures in each document on a canvas of that document, whose fonts it has', () => {
  const measured: string[] = [];
  const fake = (doc: Document, name: string) => {
    const real = doc.createElement.bind(doc);
    vi.spyOn(doc, 'createElement').mockImplementation((tag: string) => {
      const el = real(tag);
      if (tag === 'canvas') {
        (el as HTMLCanvasElement).getContext = (() => ({
          font: '',
          measureText: () => { measured.push(name); return { width: 1, fontBoundingBoxAscent: 1, fontBoundingBoxDescent: 0 }; },
        })) as unknown as HTMLCanvasElement['getContext'];
      }
      return el;
    });
  };
  const frames = [0, 1].map(() => document.body.appendChild(document.createElement('iframe')));
  const [story, popout] = frames.map((f) => f.contentDocument!);
  fake(story!, 'story');
  fake(popout!, 'popout');
  createDomMeasureEnv(story!.body).text('x', { size: 12 });
  createDomMeasureEnv(popout!.body).text('x', { size: 12 });
  for (const f of frames) f.remove();
  expect([...new Set(measured)]).toEqual(['story', 'popout']);
});
