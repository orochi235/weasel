/** The types the export registry and its formats share. */
import type { Rect } from '@weasel-js/geom';
import type { RectPose } from 'core/geometry/rectPose';
import type { Scene } from 'core/scene/types';

/**
 * A world-space rectangle to export: a page (`exportPages` makes one of each
 * `PlacedPage`), what the viewport shows (`viewportWorldRect`), a selection's
 * bounds, or any other. `name` is what a format that labels its pages or
 * documents calls it: a PDF page's label, an SVG's `<title>`.
 */
export interface ExportRegion extends Rect {
  readonly name?: string;
}

/** A scene as the exports read it: world-space `RectPose`s. */
export type ExportScene = Scene<unknown, string, RectPose>;

/** What every format takes. */
export interface ExportOptions {
  /** The color painted under each region. Default none: core holds no page color. */
  background?: string | null;
  /** Hears what the export left out or could not load; the export goes ahead without it. */
  onWarn?: (message: string) => void;
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
  export(scene: ExportScene, regions: readonly ExportRegion[], opts: TOptions): Promise<Blob>;
}
