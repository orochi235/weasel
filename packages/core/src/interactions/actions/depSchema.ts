/**
 * `DepSchema` and every dep value type it names: the entries any host sources
 * (`engineDeps.ts`, re-exported here) and the 2D canvas's own below. Consumer
 * apps add their own entries by declaration-merging against `'@weasel-js/core'`
 * in their own files.
 */

import type { EditAnchorsDep, FinishedEditFrame } from './editAnchorsDep';
import type { SvgIngestOptions, SvgUnpacker, ClipboardIngestCtx, IngestionDep } from './ingestionDeps';

export * from './engineDeps';
export type { EditAnchorsDep, FinishedEditFrame };
export type { SvgIngestOptions, SvgUnpacker, ClipboardIngestCtx, IngestionDep };

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** Where an action's `preview` draws what it would make, over the canvas.
     *  Sourced by `<SceneCanvas>`. */
    previewPaths?: import('../../canvas/deps/previewPaths').PreviewPathsDep;
    /** Edit-anchors dep — narrow read/write of one polygon's path. If
     *  absent, `editAnchorsAction`'s `start` returns an empty handle (no-op). */
    editAnchors: EditAnchorsDep;
    /**
     * Booleans adapter — read selection ids, fetch world-space `Path`s,
     * compare z-order, and mint result nodes for Pathfinder ops.
     *
     * Consumers wire via `useBooleansAdapter(adapter)`.
     */
    booleansAdapter?: import('./booleans/booleans').BooleansAdapter;
    /**
     * Create Outlines adapter — read selection ids, resolve text nodes, and
     * mint the path nodes that replace them. Consumers wire it with
     * `useCreateOutlinesAdapter(adapter)`; the `createOutlines` action reads it
     * in both its `enabled` predicate and its invoker.
     */
    createOutlinesAdapter?: import('./outlines/createOutlines').CreateOutlinesAdapter;
    /** Where an action tells the user something went wrong, such as text it
     *  could not outline. Optional: without it the message goes to the console. */
    notices?: import('./notices').NoticesDep;
    /**
     * Ingestion dep — canvas viewport rect + consumer file→src resolver.
     * Optional: when absent, the `ingest` action no-ops (there is no
     * placement geometry to work with).
     */
    ingestion?: IngestionDep;
  }
}
