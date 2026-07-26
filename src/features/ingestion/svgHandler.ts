/**
 * The kit's `image/svg+xml` content handler.
 *
 * Default: a dropped SVG stays **one scene node** — the standard
 * embedded-image contract (`data.image.src` as a `data:image/svg+xml;…`
 * URI, source bytes preserved verbatim). Rendering rides the normal
 * `imageCache` path: browsers rasterize SVG in an `<img>`, so only the
 * ingest-time measurement needs special handling — Chromium's
 * `createImageBitmap` rejects raw SVG blobs, so this handler measures via
 * an `Image` element instead, falling back to 300×150 (the CSS default
 * object size) when the file declares no intrinsic dimensions.
 *
 * `<SceneCanvas ingestion={{ svg: { unpack: true } }}>` switches to parsing
 * the file into native scene nodes — see `svgUnpack.ts`.
 *
 * Registered at priority -90: ahead of `kit:image` (-100) so SVG files
 * never hit the raster measure path, still behind any consumer handler
 * (default 0).
 */
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';
import type { IngestItem } from './ingestItems';
import { embedFilesAsImageNodes, type Measure } from './imageHandler';
import { unpackSvgFiles } from './svgUnpack';

export const SVG_MIME = 'image/svg+xml';

// CSS default object size — what browsers use for replaced content with no
// intrinsic dimensions (e.g. a viewBox-only SVG in an <img>).
const FALLBACK_WIDTH = 300;
const FALLBACK_HEIGHT = 150;

/**
 * True for file items that are SVG by MIME — or by `.svg` extension when
 * the source offered no usable type (an empty `File.type` normalizes to
 * `application/octet-stream` at materialization).
 */
export function isSvgFileItem(item: IngestItem): boolean {
  if (item.kind !== 'file') return false;
  if (item.mime === SVG_MIME) return true;
  return item.mime === 'application/octet-stream' && /\.svg$/i.test(item.file.name);
}

/**
 * Strict-prefix sniff: could this text be an SVG document? `<svg` (or an XML
 * declaration, then optional whitespace/comments, then `<svg`) must open the
 * document — no mid-document substring scans, same discipline as
 * `sniffWeaselClipboardText`. Exists because Safari drops both custom MIMEs
 * and `image/svg+xml` from async clipboard writes, leaving `text/plain` as
 * the only surviving flavor of an SVG copy.
 */
export function sniffSvgText(text: string): boolean {
  let t = text.trimStart();
  if (t.startsWith('<?xml')) {
    const end = t.indexOf('?>');
    if (end < 0) return false;
    t = t.slice(end + 2);
  }
  for (;;) {
    t = t.trimStart();
    if (t.startsWith('<!--')) {
      const end = t.indexOf('-->');
      if (end < 0) return false;
      t = t.slice(end + 3);
      continue;
    }
    break;
  }
  return /^<svg[\s>/]/i.test(t);
}

const defaultMeasure: Measure = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth || FALLBACK_WIDTH,
      height: img.naturalHeight || FALLBACK_HEIGHT,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

let measure: Measure = defaultMeasure;

export const kitSvgHandler: ContentHandlerEntry = {
  id: 'kit:svg',
  // Files by MIME/extension, plus the text/plain fallback flavor: SVG markup
  // pasted as plain text (the only flavor Safari lets an SVG copy keep).
  match: (item) =>
    isSvgFileItem(item)
    || (item.kind === 'string' && item.mime === 'text/plain' && sniffSvgText(item.text)),
  priority: -90,
  handle(items, ctx: IngestCtx) {
    const files = items.flatMap((it) => (it.kind === 'file' ? [it.file] : []));
    // String items (the text/plain SVG fallback flavor) enter the same file
    // path — wrap the markup in a File so unpack/embed stays one code path.
    // BUT skip them when the weasel-JSON handler already pasted this event's
    // copy: draw writes weasel-JSON + SVG together, so ingesting both would
    // double-paste. (ctx is shared per event; the weasel handler runs first.)
    if (!ctx.consumedWeaselPayload) {
      for (const it of items) {
        if (it.kind === 'string') files.push(new File([it.text], 'pasted.svg', { type: SVG_MIME }));
      }
    }
    if (files.length === 0) return;
    if (ctx.svg?.unpack) return unpackSvgFiles(files, ctx);
    // Thunk (not the variable) so the test seam is read at call time.
    return embedFilesAsImageNodes(files, ctx, {
      measure: (f) => measure(f),
      mimeOverride: SVG_MIME,
    });
  },
};

/** @internal test seam — override the Image-element measurer (jsdom can't
 *  decode SVG). Not part of the public barrel. */
export function __setSvgMeasureForTests(fn: Measure): void {
  measure = fn;
}

/** @internal test seam — restore the default measurer. */
export function _resetSvgHandlerSeamsForTests(): void {
  measure = defaultMeasure;
}
