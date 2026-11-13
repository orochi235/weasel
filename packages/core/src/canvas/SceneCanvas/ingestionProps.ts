import type { PasteOmission } from 'core/adapters/types';
import type { ContentHandlerEntry, KitHandlersOption } from 'domains/ingestion';
import type { SvgIngestOptions } from 'interactions/actions/depSchema';

/** `<SceneCanvas ingestion>`: external content arriving by OS drop, clipboard
 *  paste, or the file picker. Memoize `handlers` and `clipboard.reviver`:
 *  inline literals rebuild them every render. */
export interface SceneCanvasIngestion {
  /** Content handlers for this canvas alone, priority 0 by default, above the
   *  kit's. One for every canvas on the page goes through `registerContentHandler`. */
  handlers?: ContentHandlerEntry[];
  /** Which kit handlers it keeps. Default all. */
  kitHandlers?: KitHandlersOption;
  /** Overrides the image handler's `data:`-URI embed (e.g. upload to an asset
   *  store, return the URL). */
  resolveSrc?: (file: File) => Promise<string>;
  /** `unpack` makes the kit SVG handler parse dropped SVG files into native
   *  scene nodes instead of one embedded-image node each. */
  svg?: SvgIngestOptions;
  /** The kit weasel-JSON paste handler, enabled by default. Also governs
   *  Cmd/Ctrl+V under the `edit` preset; the rest takes the `ingest` preset. */
  clipboard?: {
    /** Restores JSON-unfriendly values the copying side encoded via `jsonReplacer`. */
    reviver?: (key: string, value: unknown) => unknown;
    /** `false` opts the canvas out, but the kit handler still consumes
     *  weasel-matching items and declines them inert rather than letting them
     *  fall through. */
    enabled?: boolean;
    /** Called when a paste left copied nodes out, with each one and the
     *  reason. `useClipboardOps` takes the same callback as
     *  `onPasteOmitted` for a paste from its own in-memory copy. */
    onOmitted?: (omitted: PasteOmission[]) => void;
  };
}
