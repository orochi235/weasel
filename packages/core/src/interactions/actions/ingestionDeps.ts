/** The deps external-content ingestion reads: the `ingest` action's dep and
 *  the SVG and clipboard seams it carries. */
import type { InsertAdapter, PasteOmission } from 'core/adapters/types';

/**
 * Options for the kit `image/svg+xml` content handler, threaded from
 * SceneCanvas's `ingestion={{ svg }}` prop.
 */
export interface SvgIngestOptions {
  /** Parse dropped/pasted/picked SVG files into native scene nodes (path /
   *  text leaves under containers mirroring the source `<g>` structure)
   *  instead of the default single embedded-image node.
   *
   *  Pass `unpackSvgFiles` from `@weasel-js/svg`:
   *
   *  ```ts
   *  import { unpackSvgFiles } from '@weasel-js/svg';
   *  <SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }} />
   *  ```
   *
   *  It is injected rather than flagged on with `true` because the SVG parser
   *  lives in `@weasel-js/svg`, which depends on this package. */
  unpack?: SvgUnpacker;
}

/** Parses SVG files and inserts the resulting nodes into `ctx.scene`, as one
 *  `applyOps` batch per file. Implemented by `unpackSvgFiles` in
 *  `@weasel-js/svg`; see {@link SvgIngestOptions.unpack}. */
export type SvgUnpacker = (
  files: File[],
  ctx: import('../../domains/ingestion/contentHandlers').IngestCtx,
) => Promise<void>;

/**
 * Clipboard-paste seam consumed by the kit weasel-JSON content handler
 * (`IngestCtx.clipboard`). Built by `<SceneCanvas>` from its own synthesized
 * adapter + the `ingestion.clipboard` prop; absent when the consumer set
 * `ingestion.clipboard.enabled === false` or the adapter lacks `commitPaste`.
 * Absence makes the handler decline inert (dwarn, nothing ingested) — its
 * matched items were already consumed at match time and do not fall through
 * to other handlers.
 */
export interface ClipboardIngestCtx {
  /** The hosting canvas's adapter — `commitPaste` materializes the pasted
   *  nodes (fresh ids, offset applied); insertion still goes through ops. */
  adapter: InsertAdapter<{ id: string }>;
  /** JSON reviver for the weasel wire payload (typed arrays etc.) — from
   *  `SceneCanvasProps.ingestion.clipboard.reviver`. */
  reviver?: (key: string, value: unknown) => unknown;
  /** Told what a paste left out and why — from
   *  `SceneCanvasProps.ingestion.clipboard.onOmitted`. */
  onOmitted?: (omitted: PasteOmission[]) => void;
}

/** Dep for the `ingest` action (external-content ingestion). */
export interface IngestionDep {
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** Consumer file→src resolver (from SceneCanvas's `ingestion` prop).
   *  Live accessor — read it at use time. Destructuring (or copying the
   *  property early) snapshots the current value and won't track later
   *  prop changes across an `await`. */
  resolveSrc?: (file: File) => Promise<string>;
  /** Kit SVG-handler options (from SceneCanvas's `ingestion` prop).
   *  Live accessor, same caveat as `resolveSrc`. */
  svg?: SvgIngestOptions;
  /** Clipboard-paste seam for the kit weasel-JSON handler.
   *  Live accessor, same caveat as `resolveSrc`. */
  clipboard?: ClipboardIngestCtx;
  /** The canvas's own content handlers and the kit's it keeps (SceneCanvas's
   *  `ingestion.handlers` and `ingestion.kitHandlers`). An arrival routes
   *  through these and the page-wide registry's. Absent reads as none.
   *  Live accessor, same caveat as `resolveSrc`. */
  handlers?: readonly import('../../domains/ingestion/contentHandlers').ContentHandlerEntry[];
}
