import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageNodeOf } from 'core/pages/pageNodes';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import { plainScene } from '../../testing/plainScene';
import { _resetExportFormatsForTests, exportFormatRegistry, exportFormats, exportRegions, registerExportFormat } from './exportFormats';
import { exportPages } from './exportPages';
import type { ExportFormat, ExportOptions, ExportRegion } from './exportTypes';
import { selectionRegion } from './selectionRegion';

const calls: { id: string; regions: readonly ExportRegion[]; opts: ExportOptions }[] = [];

function fake(id: string, multiRegion: boolean): ExportFormat {
  return {
    id, label: id.toUpperCase(), mimeType: `test/${id}`, extension: id, multiRegion,
    export: async (_scene, regions, opts) => {
      calls.push({ id, regions, opts });
      return new Blob([id], { type: `test/${id}` });
    },
  };
}

afterEach(() => {
  _resetExportFormatsForTests();
  calls.length = 0;
});

describe('the export registry', () => {
  it('holds png from first use, before anything is registered', () => {
    expect(exportFormats().map((f) => f.id)).toEqual(['png']);
    expect(exportFormatRegistry.get('png')).toMatchObject({ mimeType: 'image/png', extension: 'png', multiRegion: false });
  });

  it('lists formats in registration order, png first, and drops each on its disposer', () => {
    const dropOne = registerExportFormat(fake('one', false));
    const dropTwo = registerExportFormat(fake('two', true));
    expect(exportFormats().map((f) => f.id)).toEqual(['png', 'one', 'two']);
    dropOne();
    expect(exportFormats().map((f) => f.id)).toEqual(['png', 'two']);
    dropTwo();
    dropTwo();
    expect(exportFormats().map((f) => f.id)).toEqual(['png']);
  });

  it('answers the same list until the registry changes, and tells subscribers when it does', () => {
    const heard = vi.fn();
    const unsubscribe = exportFormatRegistry.subscribe(heard);
    const before = exportFormats();
    expect(exportFormats()).toBe(before);
    const drop = registerExportFormat(fake('one', false));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(exportFormats()).not.toBe(before);
    drop();
    unsubscribe();
  });

  it('lets a registration override an id and uncovers the one it displaced on dispose', () => {
    const mine = { ...fake('png', false), label: 'My PNG' };
    const drop = registerExportFormat(mine);
    expect(exportFormatRegistry.get('png')).toBe(mine);
    expect(exportFormatRegistry.entries()[0]!.shadowed).toHaveLength(1);
    drop();
    expect(exportFormatRegistry.get('png')?.label).toBe('PNG Image');
  });
});

describe('exportRegions', () => {
  it('hands the format the scene, the regions and the options', async () => {
    registerExportFormat(fake('many', true));
    const { scene, pages } = plainScene();
    const regions = [pages[0]!, { x: -10, y: -10, width: 500, height: 130, name: 'Everything' }];
    const blob = await exportRegions(scene, regions, 'many', { background: '#fff', extra: 3 });
    expect(blob.type).toBe('test/many');
    expect(calls).toEqual([{ id: 'many', regions, opts: { background: '#fff', extra: 3 } }]);
  });

  it('exports the region a view shows, which is no page', async () => {
    registerExportFormat(fake('one', false));
    const { scene } = plainScene();
    const region = viewportWorldRect({ x: 50, y: 10, scale: { x: 2, y: 2 } }, { width: 300, height: 100 });
    await exportRegions(scene, [region], 'one');
    expect(calls[0]!.regions).toEqual([{ x: 50, y: 10, width: 150, height: 50 }]);
  });

  it('refuses an id nothing registered, naming the ones that are', async () => {
    const { scene, pages } = plainScene();
    await expect(exportRegions(scene, pages, 'tiff')).rejects.toThrow(/no export format "tiff".*png/);
  });

  it('refuses several regions for a single-region format', async () => {
    registerExportFormat(fake('one', false));
    const { scene, pages } = plainScene();
    await expect(exportRegions(scene, pages, 'one')).rejects.toThrow(/one region to a file.*handed 2/);
    expect(calls).toEqual([]);
  });

  it('refuses no regions at all', async () => {
    registerExportFormat(fake('many', true));
    const { scene } = plainScene();
    await expect(exportRegions(scene, [], 'many')).rejects.toThrow(/no regions/);
  });
});

describe('exportPages', () => {
  it('exports each page as a region named for it', async () => {
    registerExportFormat(fake('many', true));
    const { scene, pages } = plainScene();
    await exportPages(scene, pages, 'many');
    expect(calls[0]!.regions).toEqual([
      { x: 0, y: 0, width: 200, height: 100, name: 'Page 1' },
      { x: 240, y: 0, width: 200, height: 100, name: 'Page 2' },
    ]);
  });
});

describe('selectionRegion', () => {
  it('boxes what the ids draw, in world space, leaving the page structure out', () => {
    const { scene, pages } = plainScene();
    const pageNode = pageNodeOf(scene, pages[0]!.id)!;
    expect(scene.get(pageNode)).toBeDefined();
    // The red rect spans (20, 20) to (80, 60) on page 1, the blue path (300, 30) to (340, 60) on page 2.
    expect(selectionRegion(scene, ['r', 'p', pageNode], 'Picked')).toEqual({ x: 20, y: 20, width: 320, height: 40, name: 'Picked' });
    expect(selectionRegion(scene, [])).toBeNull();
  });

  it('exports through any format as a region that is not a page', async () => {
    registerExportFormat(fake('one', false));
    const { scene } = plainScene();
    await exportRegions(scene, [selectionRegion(scene, ['e'])!], 'one');
    expect(calls[0]!.regions).toEqual([{ x: 100, y: 30, width: 40, height: 30 }]);
  });
});
