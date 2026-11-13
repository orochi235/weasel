/**
 * The export registry: the formats a scene's regions can be written in, each
 * registered by the package that can write it. Core registers `png`; svg and
 * pdf register theirs (`registerSvgExport`, `registerPdfExport`), so core
 * depends on neither.
 */
import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { ExportFormat, ExportOptions, ExportRegion, ExportScene } from './exportTypes';
import { PNG_EXPORT } from './regionPng';

const FORMATS = createReflectable<ExportFormat>();

// The built-ins go in on first use, not at module load: a bundler may drop an
// import kept only for its side effect, and the registry would come up empty.
let builtInsRegistered = false;
function ensureBuiltIns(): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  FORMATS.push(PNG_EXPORT.id, PNG_EXPORT as ExportFormat, { source: 'kit' });
}

/** Every registered export format, keyed by id, with the overrides each displaced. */
export const exportFormatRegistry: Reflection<ExportFormat> = {
  get: (id) => { ensureBuiltIns(); return FORMATS.get(id); },
  has: (id) => { ensureBuiltIns(); return FORMATS.has(id); },
  entries: () => { ensureBuiltIns(); return FORMATS.entries(); },
  subscribe: (listener) => { ensureBuiltIns(); return FORMATS.subscribe(listener); },
  getVersion: () => { ensureBuiltIns(); return FORMATS.getVersion(); },
};

/**
 * Register an export format. Returns a disposer that removes this
 * registration. Registering an id already held overrides it, `png` included;
 * disposing uncovers what it displaced.
 */
export function registerExportFormat<TOptions extends ExportOptions>(format: ExportFormat<TOptions>): () => void {
  ensureBuiltIns();
  return FORMATS.push(format.id, format as ExportFormat);
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
 * to a format that is not `multiRegion`; a multi-region format takes one or more.
 */
export function exportRegions(
  scene: ExportScene,
  regions: readonly ExportRegion[],
  formatId: string,
  opts: ExportOptions & Readonly<Record<string, unknown>> = {},
): Promise<Blob> {
  const format = exportFormatRegistry.get(formatId);
  if (!format) {
    const known = exportFormats().map((f) => f.id).join(', ');
    return Promise.reject(new Error(`exportRegions: no export format "${formatId}" is registered (registered: ${known})`));
  }
  if (regions.length === 0) return Promise.reject(new Error(`exportRegions: "${formatId}" was handed no regions`));
  if (!format.multiRegion && regions.length > 1) {
    return Promise.reject(new Error(
      `exportRegions: "${formatId}" writes one region to a file and was handed ${regions.length}; export them one at a time`,
    ));
  }
  return format.export(scene, regions, opts);
}

/** Drop every registration and the built-ins, so the next use registers them again. */
export function _resetExportFormatsForTests(): void {
  FORMATS.clear();
  builtInsRegistered = false;
  listed = null;
}
