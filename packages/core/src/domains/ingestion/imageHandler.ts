/**
 * The kit's `image/*` content handler. With no consumer `resolveSrc`, a file
 * embeds as a `data:` URI so the scene stays serializable.
 *
 * Registered at priority -100 so any consumer handler (default 0) can take
 * image files first.
 */
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';
import type { IngestItem } from '@weasel-js/routing';
import { arrivalBounds } from './placement';

const VIEWPORT_FIT = 0.9;

export type Measure = (file: File) => Promise<{ width: number; height: number }>;
type ToDataUri = (file: File) => Promise<string>;

const defaultMeasure: Measure = async (file) => {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
};

const defaultToDataUri: ToDataUri = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

let measure: Measure = defaultMeasure;
let toDataUri: ToDataUri = defaultToDataUri;

/** @internal Options for {@link embedFilesAsImageNodes} — used by the kit
 *  SVG handler, whose files can't go through `createImageBitmap`. */
export interface EmbedImageOptions {
  /** Replace the raster measurer for these files (the SVG handler supplies
   *  an `Image`-element one). Defaults to the module measurer (seam-aware). */
  measure?: Measure;
  /** Force the data-URI MIME. A sniffed `.svg` whose `File.type` was empty
   *  would otherwise embed as `data:application/octet-stream;…`, which
   *  browsers refuse to rasterize. No effect on `resolveSrc` output. */
  mimeOverride?: string;
}

/**
 * @internal The shared embed engine: for each file, measure → resolve a
 * `src` → fit-clamp to 90% of the visible viewport → insert one image node
 * centered on `ctx.point` (or the viewport center), cascading multi-file
 * batches by a fixed offset. A file that fails to measure or resolve is
 * skipped with a `console.warn`; the rest proceed.
 */
export async function embedFilesAsImageNodes(
  files: File[],
  ctx: IngestCtx,
  opts: EmbedImageOptions = {},
): Promise<void> {
  let index = 0;
  for (const file of files) {
    try {
      // Measure first: a corrupt file should fail cheaply here, not after
      // a consumer `resolveSrc` has already uploaded it somewhere.
      const natural = await (opts.measure ?? measure)(file);
      let src = ctx.resolveSrc ? await ctx.resolveSrc(file) : await toDataUri(file);
      if (!ctx.resolveSrc && opts.mimeOverride) {
        src = src.replace(/^data:[^;,]*/, `data:${opts.mimeOverride}`);
      }
      const view = ctx.viewportWorldRect();
      const scale = Math.min(
        1,
        (view.width * VIEWPORT_FIT) / natural.width,
        (view.height * VIEWPORT_FIT) / natural.height,
      );
      const size = { width: natural.width * scale, height: natural.height * scale };
      ctx.insert.commit(arrivalBounds(ctx, size, index), { kind: 'image', src });
      index++;
    } catch (err) {
      console.warn(`weasel ingest: image "${file.name}" failed to load`, err);
    }
  }
}

export const kitImageHandler: ContentHandlerEntry = {
  id: 'kit:image',
  match: (item: IngestItem) => item.kind === 'file' && item.mime.startsWith('image/'),
  types: ['image/*'],
  priority: -100,
  handle(items, ctx: IngestCtx) {
    const files = items.flatMap((it) => (it.kind === 'file' ? [it.file] : []));
    return embedFilesAsImageNodes(files, ctx);
  },
};

/** @internal test seam — override the bitmap measurer (jsdom has no
 *  `createImageBitmap`). Not part of the public barrel. */
export function __setImageMeasureForTests(fn: Measure): void {
  measure = fn;
}

/** @internal test seam — override the FileReader embed. */
export function __setFileToDataUriForTests(fn: ToDataUri): void {
  toDataUri = fn;
}

/** @internal test seam — restore default seams. */
export function _resetImageHandlerSeamsForTests(): void {
  measure = defaultMeasure;
  toDataUri = defaultToDataUri;
}
