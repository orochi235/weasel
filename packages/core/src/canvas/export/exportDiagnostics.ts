/** How every export reports what it could not draw, and when it refuses to write a file without it. */
import type { RenderDiagnostic, RenderDiagnosticSink } from '../renderDiagnostics';
import type { ExportOptions } from './exportTypes';

/** One thing an export drew without, or drew in part: a `RenderDiagnostic`. */
export type ExportDiagnostic = RenderDiagnostic;

/** A strict export (`strict: true`) found something it could not draw, and wrote nothing. */
export class ExportIncompleteError extends Error {
  constructor(readonly diagnostics: readonly ExportDiagnostic[]) {
    super(`export: ${diagnostics.length === 1 ? 'one thing' : `${diagnostics.length} things`} could not be drawn, and a strict export writes nothing without them: ${
      diagnostics.map((d) => d.message).join('; ')}`);
  }
}

/** One export's diagnostics: `report` hears each, `settle` ends the export's reporting. */
export interface ExportReporter {
  readonly report: RenderDiagnosticSink;
  /** Throws {@link ExportIncompleteError} for a strict export that reported anything. */
  settle(): void;
}

/**
 * The reporter an export with `opts` reports through. Each diagnostic reaches
 * `onDiagnostic` once, however often it is found. Best-effort, the default,
 * writes the file without what it reports; `strict` writes none when it
 * reports anything, and `settle` throws instead.
 */
export function exportReporter(opts: Pick<ExportOptions, 'onDiagnostic' | 'strict'>): ExportReporter {
  const seen = new Map<string, ExportDiagnostic>();
  return {
    report(d) {
      const key = `${d.kind}\u0000${d.subject}\u0000${d.message}`;
      if (seen.has(key)) return;
      seen.set(key, d);
      opts.onDiagnostic?.(d);
    },
    settle() {
      if (opts.strict && seen.size > 0) throw new ExportIncompleteError([...seen.values()]);
    },
  };
}
