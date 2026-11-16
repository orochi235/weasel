/** The types the export registry and its formats share. */
import type { Rect } from '@weasel-js/geom';
import type { RectPose, RenderDiagnostic, Scene } from '@weasel-js/core';

/**
 * A rectangle of the document to export: a page (`exportPages` makes one of
 * each `PlacedPage`), the world rect a view spans (`viewportWorldRect`), a
 * selection's bounds, or any other. Every format draws each layer in it at its
 * document pose: a parallax layer's camera tracking is not applied. `name` is
 * what a format that labels its pages or documents calls it: a PDF page's
 * label, an SVG's `<title>`.
 */
export interface ExportRegion extends Rect {
  readonly name?: string;
}

/**
 * The regions an export writes: fixed rects, or a function reading them from
 * the document. A function is called each time the export reads the document,
 * so bounds that come from it, a page's or a selection's, belong to the same
 * revision as what is drawn in them.
 */
export type ExportRegions = readonly ExportRegion[] | ((doc: ExportScene) => readonly ExportRegion[]);

/** One region an export writes, fixed or read from the document, as {@link ExportRegions} holds them. */
export type ExportRegionSource = ExportRegion | ((doc: ExportScene) => ExportRegion);

/** A scene as the exports read it: world-space `RectPose`s. */
export type ExportScene = Scene<unknown, string, RectPose>;

/** What every format takes. */
export interface ExportOptions {
  /** The color painted under each region. Default none: core holds no page color. */
  background?: string | null;
  /** Hears each thing the export could not draw or load, once: a picture or face
   *  that failed, a paint kind or shader nothing can draw, what the format cannot hold. */
  onDiagnostic?: (diagnostic: RenderDiagnostic) => void;
  /** Write nothing when anything is diagnosed, and reject with `ExportIncompleteError`.
   *  Default `false`: best-effort, the file is written without it. */
  strict?: boolean;
}

/**
 * One way of writing regions of a scene to a file, registered with
 * `registerExportFormat`. `TOptions` is what the format reads beyond
 * {@link ExportOptions}. `exportRegions` hands a format whatever its caller
 * passed, so a format treats every option of its own as optional there.
 */
export interface ExportFormat<TOptions extends ExportOptions = ExportOptions> {
  /** The id `exportRegions` names it by: `'png'`, `'svg'`, `'pdf'`. */
  readonly id: string;
  /** What a menu calls it: "PNG Image". */
  readonly label: string;
  readonly mimeType: string;
  /** The file extension, without the dot. */
  readonly extension: string;
  /** Whether one file holds several regions, as a PDF's pages do. A single-region format takes exactly one. */
  readonly multiRegion: boolean;
  /**
   * The option keys it reads beyond {@link ExportOptions}. `exportRegions` warns in development about a
   * key passed to this format that neither lists, and {@link pickExportOptions} picks these. Left out,
   * nothing is checked.
   */
  readonly options?: readonly Exclude<keyof TOptions, keyof ExportOptions>[];
  export(scene: ExportScene, regions: ExportRegions, opts: TOptions): Promise<Blob>;
}
