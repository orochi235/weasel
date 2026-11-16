/**
 * The export registry: the formats a scene's regions can be written in, each
 * registered by the package that can write it. This package registers `png`;
 * svg and pdf register theirs (`registerSvgExport`, `registerPdfExport`), so it
 * depends on neither.
 */
import { createReflectable, type PushOptions, type Reflection } from '@weasel-js/registry';
import type { ExportFormat, ExportOptions, ExportRegion, ExportRegions, ExportScene } from './exportTypes';
import { PNG_EXPORT } from './regionPng';

const FORMATS = createReflectable<ExportFormat>({ name: 'export formats' });

// The built-ins go in on first use, not at module load: a bundler may drop an
// import kept only for its side effect, and the registry would come up empty.
let builtInsRegistered = false;
function ensureBuiltIns(): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  FORMATS.push(PNG_EXPORT.id, PNG_EXPORT as ExportFormat, { source: 'kit', fallback: true });
}

/** Every registered export format, keyed by id, with the overrides each displaced. */
export const exportFormatRegistry: Reflection<ExportFormat> = {
  name: FORMATS.name,
  get: (id) => { ensureBuiltIns(); return FORMATS.get(id); },
  has: (id) => { ensureBuiltIns(); return FORMATS.has(id); },
  entries: () => { ensureBuiltIns(); return FORMATS.entries(); },
  subscribe: (listener) => { ensureBuiltIns(); return FORMATS.subscribe(listener); },
  getVersion: () => { ensureBuiltIns(); return FORMATS.getVersion(); },
};

/**
 * Register an export format. Returns a disposer that removes this
 * registration. Registering an id already held overrides it, `png` included;
 * disposing uncovers what it displaced. `fallback` marks an engine default,
 * which a later registration replaces without the development clash warning.
 */
export function registerExportFormat<TOptions extends ExportOptions>(
  format: ExportFormat<TOptions>,
  options?: Pick<PushOptions, 'fallback'>,
): () => void {
  ensureBuiltIns();
  return FORMATS.push(format.id, format as ExportFormat, options);
}

let listed: { from: readonly unknown[]; formats: readonly ExportFormat[] } | null = null;

/** Every registered format, `png` first, then in registration order. The same array until the registry changes. */
export function exportFormats(): readonly ExportFormat[] {
  const entries = exportFormatRegistry.entries();
  if (listed?.from !== entries) listed = { from: entries, formats: Object.freeze(entries.map((e) => e.value)) };
  return listed.formats;
}

/**
 * Write `regions` of `scene` in the format registered as `formatId`. Throws
 * for an id nothing registered, and for more or fewer than one region handed
 * to a format that is not `multiRegion`; a multi-region format takes one or
 * more. Regions given as a function of the document are counted each time
 * the export reads them.
 */
export function exportRegions(
  scene: ExportScene,
  regions: ExportRegions,
  formatId: string,
  opts: ExportOptions & Readonly<Record<string, unknown>> = {},
): Promise<Blob> {
  const format = exportFormatRegistry.get(formatId);
  if (!format) {
    const known = exportFormats().map((f) => f.id).join(', ');
    return Promise.reject(new Error(`exportRegions: no export format "${formatId}" is registered (registered: ${known})`));
  }
  if (typeof regions !== 'function') {
    try {
      checkCount(format, regions);
    } catch (err) {
      return Promise.reject(err);
    }
    return format.export(scene, regions, opts);
  }
  return format.export(scene, (doc) => checkCount(format, regions(doc)), opts);
}

function checkCount(format: ExportFormat, regions: readonly ExportRegion[]): readonly ExportRegion[] {
  if (regions.length === 0) throw new Error(`exportRegions: "${format.id}" was handed no regions`);
  if (!format.multiRegion && regions.length > 1) {
    throw new Error(`exportRegions: "${format.id}" writes one region to a file and was handed ${regions.length}; export them one at a time`);
  }
  return regions;
}

/** Drop every registration and the built-ins, so the next use registers them again. */
export function _resetExportFormatsForTests(): void {
  FORMATS.clear();
  builtInsRegistered = false;
  listed = null;
}
