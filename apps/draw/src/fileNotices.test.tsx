import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScene } from '@weasel-js/core';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { reportSessionSave, reportSvgWarnings } from './fileNotices';
import { importSvgFile, openSvgFile } from './openSvg';
import { saveSvgFile } from './saveSvg';
import * as svgExport from './svgExport';
import { renderWithIcons } from './testIcons';

vi.mock('./svgExport', async (actual) => ({ ...(await actual<typeof svgExport>()), sceneToSvgString: vi.fn() }));

afterEach(() => {
  act(() => {
    reportSessionSave(true);
    defaultToastQueue.clear();
  });
  vi.restoreAllMocks();
});

const newScene = () =>
  createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });

describe('reportSvgWarnings', () => {
  it('shows nothing when there is nothing to warn about', () => {
    renderWithIcons(<ToastRegion />);
    act(() => reportSvgWarnings('Opened', []));
    expect(screen.queryByText(/Opened with/)).toBeNull();
  });
});

describe('opening and importing an SVG', () => {
  const pick = (body: string): void => {
    const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9">${body}</svg>`;
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File([text], 'art.svg')] });
      this.dispatchEvent(new Event('change'));
    });
  };
  const target = () => ({
    scene: newScene(),
    setFilename: vi.fn(), setPaperSize: vi.fn(), setBackgroundColor: vi.fn(),
  });

  it('toasts what Open could not read, and stays quiet about a clean file', async () => {
    renderWithIcons(<ToastRegion />);
    pick('<foreignObject width="5" height="5"/>');
    await act(() => openSvgFile(target()));
    expect(screen.getByText('Opened with 1 warning')).toBeInTheDocument();

    act(() => defaultToastQueue.clear());
    pick('<rect width="5" height="5"/>');
    await act(() => openSvgFile(target()));
    expect(screen.queryByText(/Opened with/)).toBeNull();
  });

  it('toasts what Import could not read', async () => {
    renderWithIcons(<ToastRegion />);
    pick('<foreignObject width="5" height="5"/>');
    await act(() => importSvgFile(newScene()));
    expect(screen.getByText('Imported with 1 warning')).toBeInTheDocument();
  });
});

describe('saving an SVG', () => {
  const doc = { filename: 'art', paperSize: 'letter', backgroundColor: '#ffffff' } as const;
  const click = () => {
    // jsdom's URL cannot take a Blob from this realm.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:saved');
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  };

  it('downloads the file under its name, with the extension', async () => {
    const download = click();
    let name = '';
    download.mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    vi.mocked(svgExport.sceneToSvgString).mockResolvedValue('<svg/>');
    await saveSvgFile(newScene(), doc);
    expect(name).toBe('art.svg');
  });

  it('toasts what the export left out', async () => {
    click();
    vi.mocked(svgExport.sceneToSvgString).mockImplementation(async (_scene, opts) => {
      opts.onWarn?.('a pattern fill was written as gray');
      return '<svg/>';
    });
    renderWithIcons(<ToastRegion />);
    await act(() => saveSvgFile(newScene(), doc));
    expect(screen.getByText('Saved with 1 warning')).toBeInTheDocument();
    expect(screen.getByText('a pattern fill was written as gray')).toBeInTheDocument();
  });

  it('toasts a save that failed, and downloads nothing', async () => {
    const download = click();
    vi.mocked(svgExport.sceneToSvgString).mockRejectedValue(new Error('out of memory'));
    renderWithIcons(<ToastRegion />);
    await act(() => saveSvgFile(newScene(), doc));
    expect(screen.getByText('The SVG was not saved')).toBeInTheDocument();
    expect(screen.getByText('out of memory')).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
  });
});

describe('reportSessionSave', () => {
  it('says once that the browser is not keeping the drawing, and takes it back when a save lands', () => {
    renderWithIcons(<ToastRegion />);
    act(() => reportSessionSave(false));
    act(() => reportSessionSave(false));
    expect(screen.getAllByText('This drawing is not being kept in the browser')).toHaveLength(1);
    act(() => reportSessionSave(true));
    expect(screen.queryByText('This drawing is not being kept in the browser')).toBeNull();
  });
});
