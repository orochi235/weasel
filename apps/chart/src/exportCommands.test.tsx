import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { App } from './App';
import { chartPrefs } from './prefs';
import { withIcons } from './testIcons';

const saved = vi.hoisted(() => [] as { blob: Blob; name: string }[]);
const png = vi.hoisted(() => vi.fn(async (_scene: unknown, _page: unknown, opts: { scale: number }) =>
  new Blob([`png@${opts.scale}`], { type: 'image/png' })));
const pdf = vi.hoisted(() => vi.fn(async (_scene: unknown, _pages: readonly unknown[]) =>
  ({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), skipped: [] as { kind: string; detail: string }[] })));
const warned = vi.hoisted(() => vi.fn());
const noPages = vi.hoisted(() => ({ on: false }));

vi.mock('@editor/index', async (actual) => ({
  ...(await actual<typeof import('@editor/index')>()),
  downloadBlob: (blob: Blob, name: string) => { saved.push({ blob, name }); },
  reportFileWarnings: warned,
}));
// jsdom has no WebGL2 to draw a PNG with; the SVG export runs for real.
vi.mock('@weasel-js/diagram-formats', async (actual) => ({
  ...(await actual<typeof import('@weasel-js/diagram-formats')>()),
  exportPagePng: png,
  exportPagesPdf: pdf,
}));
vi.mock('./pages/useChartPages', async (actual) => {
  const real = await actual<typeof import('./pages/useChartPages')>();
  return {
    ...real,
    useChartPages: (...args: Parameters<typeof real.useChartPages>) => {
      const pages = real.useChartPages(...args);
      return noPages.on ? { ...pages, placed: [] } : pages;
    },
  };
});

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
  saved.length = 0;
  png.mockClear();
  pdf.mockClear();
  warned.mockClear();
  noPages.on = false;
  chartPrefs().reset();
  localStorage.clear();
});

const rowsOf = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];

/** File › Export › `row`. */
function exportAs(row: string): void {
  render(<DepRegistryProvider><ActionsProvider><App /></ActionsProvider></DepRegistryProvider>, { wrapper: withIcons });
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'File' })); });
  act(() => { fireEvent.click(rowsOf(screen.getAllByRole('menu').at(-1)!).find((el) => el.textContent?.startsWith('Export'))!); });
  act(() => { fireEvent.click(rowsOf(screen.getAllByRole('menu').at(-1)!).find((el) => el.textContent?.startsWith(row))!); });
}

describe('File › Export', () => {
  it('downloads the page as an SVG named for it', async () => {
    exportAs('Page as SVG');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('Page 1.svg');
    expect(saved[0]!.blob.type).toBe('image/svg+xml');
    expect(await saved[0]!.blob.text()).toMatch(/^<svg[^>]* viewBox="0 0 1056 816"/);
  });

  it('downloads the page as a PNG at the scale picked, named for the page and the scale', async () => {
    exportAs('Page as PNG (2×)');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('Page 1@2x.png');
    expect(saved[0]!.blob.type).toBe('image/png');
    expect(png.mock.calls[0]![1]).toMatchObject({ id: 'page-1', x: 0, y: 0 });
    expect(png.mock.calls[0]![2]).toMatchObject({ scale: 2 });
  });

  it('downloads every page as one PDF', async () => {
    exportAs('Pages as PDF');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('chart.pdf');
    expect(pdf.mock.calls[0]![1]).toHaveLength(1);
    expect(pdf.mock.calls[0]![1][0]).toMatchObject({ id: 'page-1' });
  });

  it('reports what the PDF could not carry', async () => {
    pdf.mockResolvedValueOnce({ blob: new Blob(['%PDF']), skipped: [{ kind: 'glyph', detail: 'glyph U+1F600' }] });
    exportAs('Pages as PDF');
    await vi.waitFor(() => expect(warned).toHaveBeenCalledWith('Exported', ['glyph U+1F600'], 'chart-export-pdf'));
  });

  it('writes no PDF when no page is placed', async () => {
    noPages.on = true;
    exportAs('Pages as PDF');
    await new Promise((r) => setTimeout(r, 0));
    expect(pdf).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });
});
