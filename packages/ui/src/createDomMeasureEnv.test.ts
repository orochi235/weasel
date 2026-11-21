import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomMeasureEnv } from './createDomMeasureEnv';

describe('createDomMeasureEnv', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('measures text in the style, weight, size, and family it is asked for', () => {
    const fonts: string[] = [];
    const fake = {
      set font(f: string) { fonts.push(f); },
      measureText: () => ({ width: 10, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2, actualBoundingBoxAscent: 7 }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake as never);
    const env = createDomMeasureEnv(document.body);
    env.text('a', { family: 'Inter', size: 12, weight: 600, style: 'italic' });
    env.text('a', { family: 'Inter', size: 12 });
    expect(fonts).toEqual(['italic 600 12px "Inter"', 'normal 400 12px "Inter"']);
  });
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
