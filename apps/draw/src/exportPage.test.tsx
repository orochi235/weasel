import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addOnPages, documentOf, exportRegionsOf, placedPagesOf, registerExportFormat, type ExportFormat } from '@weasel-js/core';
import { downloadBlob } from '@weasel-js/editor';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { exportPagesFile, exportSelectionFile } from './exportPage';
import { renderWithIcons } from './testIcons';
import { drawScene } from './testScenes';

vi.mock('@weasel-js/editor', async (actual) => ({ ...(await actual<typeof import('@weasel-js/editor')>()), downloadBlob: vi.fn() }));

const drops: (() => void)[] = [];
afterEach(() => {
  drops.splice(0).forEach((drop) => drop());
  act(() => { defaultToastQueue.clear(); });
  vi.clearAllMocks();
});

/** A format recording what it was asked for, and warning or failing when told to. */
function fake(id: string, multiRegion: boolean, run: Partial<Pick<ExportFormat, 'export'>> = {}) {
  const format: ExportFormat = {
    id, label: id, mimeType: `test/${id}`, extension: id, multiRegion,
    export: vi.fn(run.export ?? (async () => new Blob([id], { type: `test/${id}` }))),
  };
  drops.push(registerExportFormat(format));
  return format;
}

function twoPages() {
  const scene = drawScene([{ id: 'p1', name: 'Cover', width: 100, height: 50 }, { id: 'p2', width: 100, height: 50 }]);
  addOnPages(scene, [{
    id: 'm', kind: 'mark', layer: 'default', pose: { x: 10, y: 10, width: 20, height: 10 },
    data: { path: { kind: 'rect', x: 10, y: 10, width: 20, height: 10 } },
  }] as never);
  return { scene, pages: placedPagesOf(scene) };
}

/** The regions `format`'s first export was asked for, read from the document it was handed. */
const asked = (format: ExportFormat) => {
  const [scene, regions] = vi.mocked(format.export).mock.calls[0]!;
  return exportRegionsOf(regions, documentOf(scene));
};

const DOC = { filename: 'art.svg', backgroundColor: '#336699' };

describe('exportPagesFile', () => {
  it('names one page for the document and the page, on the background, at 2×', async () => {
    const format = fake('one', false);
    const { scene, pages } = twoPages();
    await exportPagesFile(scene, format, [pages[0]!], DOC);
    expect(format.export).toHaveBeenCalledWith(scene, expect.any(Function),
      expect.objectContaining({ background: '#336699', scale: 2, title: 'art - Cover' }));
    expect(asked(format)).toEqual([expect.objectContaining({ x: pages[0]!.x, name: 'Cover' })]);
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'art - Cover.one');
  });

  it('names a file of several pages for the document', async () => {
    const format = fake('many', true);
    const { scene, pages } = twoPages();
    await exportPagesFile(scene, format, pages, DOC);
    expect(asked(format).map((r) => r.name)).toEqual(['Cover', 'Page 2']);
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'art.many');
  });

  it('toasts what the format left out, and why an export failed', async () => {
    renderWithIcons(<ToastRegion />);
    const { scene, pages } = twoPages();
    const warns = fake('warns', true, { export: async (_s, _r, opts) => { opts.onDiagnostic?.({ kind: 'font', subject: 'serif', message: 'a glyph' }); return new Blob([]); } });
    await act(() => exportPagesFile(scene, warns, pages, DOC));
    expect(await screen.findByText(/Exported/)).toBeTruthy();
    const fails = fake('fails', true, { export: async () => { throw new Error('no WebGL2'); } });
    await act(() => exportPagesFile(scene, fails, pages, DOC));
    expect(await screen.findByText('The FAILS was not exported')).toBeTruthy();
    expect(screen.getByText('no WebGL2')).toBeTruthy();
  });
});

describe('exportSelectionFile', () => {
  it('exports the box the selection draws, named for the document', async () => {
    const format = fake('one', false);
    const { scene } = twoPages();
    await exportSelectionFile(scene, format, ['m'], DOC);
    expect(asked(format)).toEqual([{ x: 10, y: 10, width: 20, height: 10, name: 'Selection' }]);
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'art - Selection.one');
  });

  it('writes nothing when the selection draws nothing', async () => {
    const format = fake('one', false);
    const { scene } = twoPages();
    await exportSelectionFile(scene, format, [], DOC);
    expect(format.export).not.toHaveBeenCalled();
  });
});
