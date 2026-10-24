import { describe, expect, it } from 'vitest';
import { exportPageSvg } from './pageSvg';
import { BLUE, GREEN, PAPER, RED, pageScene } from './testing/pageScene';

async function exported(pageIndex: number, opts?: Parameters<typeof exportPageSvg>[2]): Promise<Document> {
  const { scene, pages } = pageScene();
  const svg = await exportPageSvg(scene, pages[pageIndex]!, opts);
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

/** The drawn paths, in paint order: not those defining a marker. */
const paths = (doc: Document): Element[] => [...doc.querySelectorAll('path')].filter((p) => p.closest('defs') === null);
const fills = (doc: Document): string[] => paths(doc).map((p) => p.getAttribute('fill') ?? '');

describe('exportPageSvg', () => {
  it('views exactly the page, at the page size', async () => {
    const root = (await exported(1)).documentElement;
    expect(root.getAttribute('viewBox')).toBe('240 0 200 100');
    expect(root.getAttribute('width')).toBe('200');
    expect(root.getAttribute('height')).toBe('100');
  });

  it('paints the page color first, over the whole page', async () => {
    const first = paths(await exported(0, { background: PAPER }))[0]!;
    expect(first.getAttribute('fill')).toBe(PAPER);
    expect(first.getAttribute('d')).toMatch(/^M0 0/);
  });

  it('draws only what meets the page', async () => {
    expect(fills(await exported(0))).toEqual(expect.arrayContaining([RED, GREEN]));
    expect(fills(await exported(0))).not.toContain(BLUE);
    expect(fills(await exported(1))).toContain(BLUE);
    expect(fills(await exported(1))).not.toContain(RED);
  });

  it('draws an outline as its shape, not its box', async () => {
    const doc = await exported(0);
    const diamond = paths(doc).find((p) => p.getAttribute('fill') === RED)!;
    // A diamond in (20, 20, 60, 40) starts at its top vertex.
    expect(diamond.getAttribute('d')).toMatch(/^M50 20/);
  });

  it('writes a box with a row as a <g> holding its outline, then the row', async () => {
    const doc = await exported(0);
    const diamond = paths(doc).find((p) => p.getAttribute('fill') === RED)!;
    const g = diamond.parentElement!;
    expect(g.tagName).toBe('g');
    expect([...g.children].map((c) => c.tagName)).toEqual(['path', 'text']);
    expect(g.querySelector('text')!.textContent).toBe('Start');
  });

  it('draws a connector as one path with its marker', async () => {
    const doc = await exported(0);
    const ends = [...doc.querySelectorAll('path[marker-end]')];
    expect(ends.length).toBeGreaterThan(0);
    const id = /url\(#(.+)\)/.exec(ends[0]!.getAttribute('marker-end')!)![1]!;
    expect(doc.getElementById(id)?.tagName).toBe('marker');
  });

  it('writes rows and tags as text', async () => {
    const text = [...(await exported(0)).querySelectorAll('text')].map((t) => t.textContent);
    expect(text).toContain('Start');
    expect(text.some((t) => t?.includes('Page 2'))).toBe(true);
    const far = [...(await exported(1)).querySelectorAll('text')].map((t) => t.textContent);
    expect(far.some((t) => t?.includes('Page 1'))).toBe(true);
  });

  it('defaults the background to the scene theme page color, and draws none for null', async () => {
    const themed = paths(await exported(0))[0]!;
    expect(themed.getAttribute('d')).toMatch(/^M0 0/);
    const bare = paths(await exported(0, { background: null }))[0]!;
    expect(bare.getAttribute('d')).not.toMatch(/^M0 0/);
  });
});
