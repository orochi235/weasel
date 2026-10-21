import { act, render, screen } from '@testing-library/react';
import type { LensCapture, LensIds, LensSettings, LensSource, LensSources } from '@weasel-js/labkit/loupe';
import { LENS_DEFAULTS } from '@weasel-js/labkit/loupe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ForgeComparison } from './conditions';
import { ContrastReadout, contrastAt } from './readouts';

// jsdom has no canvas, so a capture's pixels come from this stand-in for `readBitmap`.
const pixels = vi.hoisted(() => ({ image: null as ImageData | null }));
vi.mock('@weasel-js/labkit/loupe', async (original) => ({
  ...(await original<typeof import('@weasel-js/labkit/loupe')>()),
  readBitmap: () => pixels.image,
}));

function el(html: string): Element {
  document.body.innerHTML = html;
  return document.body.querySelector('[data-aim]') as Element;
}

const originalElementsFromPoint = document.elementsFromPoint;

afterEach(() => {
  document.elementsFromPoint = originalElementsFromPoint;
  document.body.replaceChildren();
  pixels.image = null;
});

const at = (element: Element) => ({ element, point: { x: 0, y: 0 } });

describe('contrastAt over a Live source', () => {
  it('reads the text color against the first opaque background up the tree', () => {
    const aim = el(
      '<div style="background-color: rgb(255, 255, 255)"><div style="background-color: transparent"><p data-aim style="color: rgb(0, 0, 0)">Hi</p></div></div>',
    );
    const got = contrastAt('live', at(aim));
    expect(got).toMatchObject({ aa: true, aaa: true, large: false });
    expect('ratio' in got && got.ratio).toBeCloseTo(21, 5);
  });

  it('reports Contrast unavailable over an element with no text', () => {
    const aim = el('<div style="background-color: white"><div data-aim></div></div>');
    expect(contrastAt('live', at(aim))).toEqual({ unavailable: 'No text under the aim' });
  });

  it('reports it unavailable when nothing under the aim is an element at all', () => {
    expect(contrastAt('live', { point: { x: 0, y: 0 } })).toEqual({ unavailable: 'No text under the aim' });
  });

  it('says so when no ancestor has an opaque background to read against', () => {
    const aim = el('<p data-aim style="color: black">Hi</p>');
    expect(contrastAt('live', at(aim))).toEqual({ unavailable: 'No opaque background behind the text' });
  });

  it('says it cannot read a color paint does not parse, rather than that there is no text', () => {
    const aim = el('<div style="background-color: white"><p data-aim style="color: oklch(0.5 0.1 20)">Hi</p></div>');
    const got = contrastAt('live', at(aim));
    expect(got).toEqual({ unavailable: expect.stringMatching(/^Cannot read the color/) });
  });

  it('says it cannot read an unparseable background instead of calling it opaque', () => {
    const aim = el('<div style="background-color: color(srgb 1 1 1)"><p data-aim style="color: black">Hi</p></div>');
    expect(contrastAt('live', at(aim))).not.toHaveProperty('ratio');
  });

  it('counts 24px text, and 18.66px bold text, as large', () => {
    const big = el('<div style="background-color: white"><p data-aim style="color: black; font-size: 24px">Hi</p></div>');
    expect(contrastAt('live', at(big))).toMatchObject({ large: true });
    const bold = el('<div style="background-color: white"><p data-aim style="color: black; font-size: 19px; font-weight: 700">Hi</p></div>');
    expect(contrastAt('live', at(bold))).toMatchObject({ large: true });
    const thin = el('<div style="background-color: white"><p data-aim style="color: black; font-size: 19px; font-weight: 400">Hi</p></div>');
    expect(contrastAt('live', at(thin))).toMatchObject({ large: false });
  });

  it('applies the large-text thresholds to the verdict', () => {
    const aim = el('<div style="background-color: white"><p data-aim style="color: rgb(130, 130, 130); font-size: 24px">Hi</p></div>');
    const got = contrastAt('live', at(aim));
    expect(got).toMatchObject({ large: true, aa: true, aaa: false });
  });
});

function image(width: number, height: number, rgb: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set([...rgb(x, y), 255], (y * width + x) * 4);
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

const capture = (dpr = 1): LensCapture => ({
  bitmap: {} as ImageBitmap,
  dpr,
  box: { width: 10, height: 10 },
  at: { x: 5, y: 5 },
});

describe('contrastAt over a Pixels source', () => {
  it('takes the pixel at the aim against the most distant color within two pixels of it', () => {
    pixels.image = image(10, 10, (x, y) => (x === 7 && y === 3 ? [255, 255, 255] : [0, 0, 0]));
    const got = contrastAt('pixels', { capture: capture(), point: { x: 5, y: 5 } });
    expect('ratio' in got && got.ratio).toBeCloseTo(21, 5);
  });

  it('does not look past the 5×5 neighborhood', () => {
    pixels.image = image(10, 10, (x) => (x === 8 ? [255, 255, 255] : [0, 0, 0]));
    const got = contrastAt('pixels', { capture: capture(), point: { x: 5, y: 5 } });
    expect('ratio' in got && got.ratio).toBe(1);
  });

  it('finds the aim in capture pixels, which are dpr to a host px', () => {
    pixels.image = image(20, 20, (x) => (x === 10 ? [255, 255, 255] : [0, 0, 0]));
    const got = contrastAt('pixels', { capture: capture(2), point: { x: 5, y: 5 } });
    expect('ratio' in got && got.ratio).toBeCloseTo(21, 5);
  });

  it('is unavailable without a capture, or one whose pixels cannot be read', () => {
    expect(contrastAt('pixels', { point: { x: 0, y: 0 } })).toEqual({ unavailable: 'No capture to read' });
    pixels.image = null;
    expect(contrastAt('pixels', { capture: capture(), point: { x: 5, y: 5 } })).toEqual({
      unavailable: 'No capture to read',
    });
  });

  it('is unavailable at an aim outside the capture', () => {
    pixels.image = image(10, 10, () => [0, 0, 0]);
    expect(contrastAt('pixels', { capture: capture(), point: { x: 50, y: 5 } })).toEqual({
      unavailable: 'The aim is outside the capture',
    });
  });
});

function liveSource(): LensSource<ForgeComparison> {
  return {
    kind: 'live',
    produces: 'dom',
    label: () => 'Live',
    status: () => true,
    subscribe: () => () => {},
    attach: () => ({ update() {}, detach() {} }),
  };
}

const IDS = { lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds;
const SIZE = { width: 160, height: 160 };

function mount(settings: Partial<LensSettings<ForgeComparison>>, sources: LensSources<ForgeComparison>) {
  return render(
    <ContrastReadout
      lens={IDS}
      settings={{ ...LENS_DEFAULTS, ...settings }}
      sources={sources}
      reticle={{ x: 10, y: 10 }}
      size={SIZE}
      describe={String}
    />,
  );
}

describe('ContrastReadout', () => {
  it('shows the ratio and both WCAG verdicts for the text under a Live lens’s aim', async () => {
    const host = document.createElement('div');
    host.dataset.fgHost = 't1';
    host.innerHTML = '<div style="background-color: white"><p style="color: black">Hi</p></div>';
    document.body.append(host);
    document.elementsFromPoint = () => [host.querySelector('p') as Element];
    mount({}, { live: liveSource() });
    expect(await screen.findByText(/21\.00:1/)).toBeTruthy();
    expect(screen.getByText(/AA pass/)).toBeTruthy();
    expect(screen.getByText(/AAA pass/)).toBeTruthy();
  });

  it('reads a lens with a comparison from its own compared copy, not the main story', async () => {
    const main = document.createElement('div');
    main.dataset.fgHost = 't1';
    main.innerHTML = '<div style="background-color: white"><p style="color: black">Hi</p></div>';
    const interior = document.createElement('div');
    interior.className = 'lk-lens-interior';
    interior.dataset.lens = 'a';
    interior.innerHTML =
      '<div data-fg-copy data-fg-host="t1~lens-a"><div style="background-color: black"><p style="color: rgb(119, 119, 119)">Hi</p></div></div>';
    document.body.append(main, interior);
    const copyText = interior.querySelector('p') as Element;
    document.elementsFromPoint = () => [copyText, main.querySelector('p') as Element];
    mount({ compare: { kind: 'opposite-mode' } }, { live: liveSource() });
    // #777 on black is 4.69:1; the main story's black on white would read 21.00:1.
    expect(await screen.findByText(/4\.69:1/)).toBeTruthy();
  });

  it('samples a Split lens’s compared copy at the interior’s center, not the compared half’s', async () => {
    const interior = document.createElement('div');
    interior.className = 'lk-lens-interior';
    interior.dataset.lens = 'a';
    interior.getBoundingClientRect = () => new DOMRect(100, 200, 160, 160);
    interior.innerHTML =
      '<div data-fg-copy data-fg-host="t1~lens-a~compared"><div style="background-color: black"><p style="color: white">Hi</p></div></div>';
    document.body.append(interior);
    const copyText = interior.querySelector('p') as Element;
    const asked: [number, number][] = [];
    document.elementsFromPoint = (x, y) => {
      asked.push([x, y]);
      return [copyText];
    };
    mount({ compare: { kind: 'opposite-mode' }, view: 'split', seam: 0.25 }, { live: liveSource() });
    expect(await screen.findByText(/21\.00:1/)).toBeTruthy();
    expect(new Set(asked.map(([x, y]) => `${x},${y}`))).toEqual(new Set(['180,280']));
  });

  it('says why it has nothing when the aim is over no text', async () => {
    const host = document.createElement('div');
    host.dataset.fgHost = 't1';
    host.innerHTML = '<div style="background-color: white"></div>';
    document.body.append(host);
    document.elementsFromPoint = () => [host.firstElementChild as Element];
    mount({}, { live: liveSource() });
    expect(await screen.findByText('No text under the aim')).toBeTruthy();
  });

  it('reads a Pixels lens’s capture instead of the page', async () => {
    pixels.image = image(10, 10, () => [0, 0, 0]);
    const source: LensSource<ForgeComparison> = {
      ...liveSource(),
      kind: 'pixels',
      produces: 'pixels',
      capture: () => Promise.resolve(capture()),
    };
    mount({ source: 'pixels' }, { pixels: source });
    await act(async () => {});
    expect(await screen.findByText(/1\.00:1/)).toBeTruthy();
  });

  it('shows the reason a Pixels capture was refused', async () => {
    const source: LensSource<ForgeComparison> = {
      ...liveSource(),
      kind: 'pixels',
      produces: 'pixels',
      capture: () => Promise.resolve({ reason: 'Nothing under the reticle' }),
    };
    mount({ source: 'pixels' }, { pixels: source });
    expect(await screen.findByText('Nothing under the reticle')).toBeTruthy();
  });
});
