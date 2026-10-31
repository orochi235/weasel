import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider, PAGES_DOC_KEY } from '@weasel-js/core';
import { DIAGRAM_JSON, type DiagramDocument } from '@weasel-js/diagram-formats';
import { defaultToastQueue } from '@weasel-js/ui/components/Toast';
import { App } from './App';
import { CHART_SCENE_KEY } from './chartPersistence';
import { chartPrefs } from './prefs';
import { withIcons } from './testIcons';

const io = vi.hoisted(() => ({ saved: [] as { blob: Blob; name: string }[], picked: null as File | null }));
const extra = vi.hoisted(() => ({ warnings: [] as string[] }));

vi.mock('@editor/index', async (actual) => ({
  ...(await actual<typeof import('@editor/index')>()),
  downloadBlob: (blob: Blob, name: string) => { io.saved.push({ blob, name }); },
  pickFile: async () => io.picked,
}));
vi.mock('@weasel-js/diagram-formats', async (actual) => {
  const real = await actual<typeof import('@weasel-js/diagram-formats')>();
  return {
    ...real,
    readDocument: async (text: string, name?: string) => {
      const read = await real.readDocument(text, name);
      return { ...read, warnings: [...read.warnings, ...extra.warnings] };
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
  io.saved.length = 0;
  io.picked = null;
  extra.warnings = [];
  act(() => defaultToastQueue.clear());
  chartPrefs().reset();
  localStorage.clear();
});

const DOC: DiagramDocument = {
  pages: [
    { kind: 'graph', id: 'one', name: 'First', width: 500, height: 400, data: { nodes: [{ id: 'a', lines: ['Alpha'], outline: 'diamond', at: { x: 40, y: 50 } }], edges: [] } },
    { kind: 'graph', id: 'two', width: 500, height: 400, data: { nodes: [{ id: 'b', lines: ['Beta'] }], edges: [] } },
  ],
  crossPageEdges: [{ id: 'ab', from: 'a', to: 'b' }],
};

const rowsOf = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];

/** Opens File, then clicks each row in `path` in the menu the last click opened. */
function choose(...path: string[]): void {
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'File' })); });
  for (const row of path) {
    act(() => { fireEvent.click(rowsOf(screen.getAllByRole('menu').at(-1)!).find((el) => el.textContent?.startsWith(row))!); });
  }
}

const mount = () => render(<DepRegistryProvider><ActionsProvider><App /></ActionsProvider></DepRegistryProvider>, { wrapper: withIcons });

type Saved = { nodes: { id: string; pose: { x: number; y: number } }[]; doc?: Record<string, unknown> };
const stored = (): Saved | null => JSON.parse(localStorage.getItem(CHART_SCENE_KEY) ?? 'null') as Saved | null;

describe('File › Import…', () => {
  it('replaces the chart with the file\'s pages and shapes', async () => {
    io.picked = new File([DIAGRAM_JSON.write!(DOC).text], 'flow.diagram.json');
    mount();
    choose('Import');
    await vi.waitFor(() => expect(stored()?.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b', 'ab'])));
    const pages = (stored()!.doc![PAGES_DOC_KEY] as { pages: { id: string }[] }).pages;
    expect(pages.map((p) => p.id)).toEqual(['one', 'two']);
    expect(stored()!.nodes.find((n) => n.id === 'a')!.pose).toMatchObject({ x: 40, y: 50 });
  });

  it('lays out a Mermaid flowchart, which carries no places', async () => {
    io.picked = new File(['flowchart LR\n  a[Alpha] --> b{Beta}\n  b --> c((Gamma))\n'], 'flow.mmd');
    mount();
    choose('Import');
    await vi.waitFor(() => expect(stored()?.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b', 'c'])));
    const at = (id: string) => stored()!.nodes.find((n) => n.id === id)!.pose;
    expect(at('a').x).toBeLessThan(at('b').x);
    expect(at('b').x).toBeLessThan(at('c').x);
  });

  it('opens a Mermaid xychart as a plot page, and exports it back as one', async () => {
    io.picked = new File(['xychart-beta\n  title "Sales"\n  x-axis [jan, feb]\n  bar [3, 7]\n'], 'sales.mmd');
    mount();
    choose('Import');
    await vi.waitFor(() => expect(stored()?.nodes.map((n) => n.id)).toContain('page-1/plot'));
    const root = stored()!.nodes.find((n) => n.id === 'page-1/plot') as unknown as { data: { plot: { data: unknown } } };
    expect(root.data.plot.data).toMatchObject({ kind: 'xychart', title: 'Sales', series: [{ kind: 'bar', values: [3, 7] }] });
    expect(stored()!.nodes.map((n) => n.id)).toContain('page-1/plot/bar:0:1');

    choose('Export', 'As Mermaid');
    await vi.waitFor(() => expect(io.saved).toHaveLength(1));
    expect(io.saved[0]!.name).toBe('Sales.mmd');
    expect(await io.saved[0]!.blob.text()).toBe('xychart-beta\n  title "Sales"\n  x-axis [jan, feb]\n  bar [3, 7]\n');
  });

  it('lists what the file had that a chart cannot hold in a toast', async () => {
    io.picked = new File([DIAGRAM_JSON.write!(DOC).text], 'flow.diagram.json');
    extra.warnings = ['A lost thing'];
    mount();
    choose('Import');
    expect(await screen.findByText('Imported with 1 warning')).toBeTruthy();
    expect(screen.getByText('A lost thing')).toBeTruthy();
  });
});

describe('File › Export › As a diagram format', () => {
  it('downloads the whole chart in that format', async () => {
    mount();
    choose('Export', 'As Diagram JSON');
    await vi.waitFor(() => expect(io.saved).toHaveLength(1));
    expect(io.saved[0]!.name).toBe('chart.diagram.json');
    const { document } = DIAGRAM_JSON.read!(await io.saved[0]!.blob.text()) as { document: DiagramDocument };
    expect(document.pages.map((p) => p.id)).toEqual(['page-1']);
  });
});
