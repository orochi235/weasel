/**
 * The one boundary every export reads the document at: what it draws comes
 * from a single revision, with what that revision needs loaded.
 */
import { documentOf } from 'core/scene/documentOf';
import type { RenderDiagnostic, RenderDiagnosticSink } from '../renderDiagnostics';
import type { ExportRegion, ExportRegionSource, ExportRegions, ExportScene } from './exportTypes';

/** How many times an export reads the document before giving up on it holding still. */
export const EXPORT_CAPTURE_ATTEMPTS = 3;

/** An export gave up: the document changed while each of its attempts loaded what it draws. */
export class ExportRevisionError extends Error {
  constructor(readonly attempts: number) {
    super(`export: the document changed while the export loaded what it draws, ${attempts} times running; nothing was written`);
  }
}

/** The two halves of an export's read of the document, as {@link captureExport} runs them. Each
 *  reports what the export will draw without to `report`. */
export interface ExportCaptureSteps<T> {
  /** Load what drawing `regions` of `doc` needs: fonts, paint kinds, pictures. */
  warm(doc: ExportScene, regions: readonly ExportRegion[], report: RenderDiagnosticSink): Promise<void>;
  /** Read everything the file is written from, synchronously, into values the document cannot change. */
  read(doc: ExportScene, regions: readonly ExportRegion[], report: RenderDiagnosticSink): T;
}

/** One region source as the {@link ExportRegions} {@link captureExport} takes. */
export const regionsOfOne = (region: ExportRegionSource): ExportRegions =>
  typeof region === 'function' ? (doc) => [region(doc)] : [region];

/** `regions` as of `doc`: each a copy, so a caller's later edit to one reaches no export in flight. */
export function exportRegionsOf(regions: ExportRegions, doc: ExportScene): readonly ExportRegion[] {
  const list = typeof regions === 'function' ? regions(doc) : regions;
  return Object.freeze(list.map((r) => Object.freeze({ ...r })));
}

/**
 * Read `regions` of `scene`'s document through `steps`, from one content
 * revision (`getContentVersion`): warm, then, if no content changed while it
 * loaded, read at once, in the same task. Fixed regions are copied when it is
 * called. A change restarts it, with the
 * regions read again when they are a function of the document, so the bounds
 * and the content come from the same revision. After
 * {@link EXPORT_CAPTURE_ATTEMPTS} attempts it rejects with
 * {@link ExportRevisionError}.
 *
 * What a gesture or an open edit shows is never read, and a change of
 * selection restarts nothing. The painters, paint kinds and fonts registered
 * when `read` runs are the ones it draws with. What the steps report reaches
 * `report` only from the attempt that is read, once it has been.
 */
export async function captureExport<T>(
  scene: ExportScene, regions: ExportRegions, steps: ExportCaptureSteps<T>, report: RenderDiagnosticSink = () => {},
): Promise<T> {
  const doc = documentOf(scene);
  const source = typeof regions === 'function' ? regions : exportRegionsOf(regions, doc);
  for (let attempt = 1; ; attempt++) {
    const revision = scene.getContentVersion();
    const heard: RenderDiagnostic[] = [];
    const hear = (d: RenderDiagnostic) => { heard.push(d); };
    await steps.warm(doc, exportRegionsOf(source, doc), hear);
    if (scene.getContentVersion() === revision) {
      const read = steps.read(doc, exportRegionsOf(source, doc), hear);
      heard.forEach(report);
      return read;
    }
    if (attempt >= EXPORT_CAPTURE_ATTEMPTS) throw new ExportRevisionError(attempt);
  }
}
