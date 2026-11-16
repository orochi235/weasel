/**
 * The kit's content handlers: images, SVG, and nodes a kit canvas copied. `ingestPreset` brings them to the
 * canvas, not to the page-wide registry, so one canvas turning one off leaves the others alone.
 */
import type { ContentHandlerEntry } from '@weasel-js/core';
import { kitImageHandler } from './imageHandler';
import { kitSvgHandler } from './svgHandler';
import { kitWeaselJsonHandler } from './weaselJsonHandler';

/** The kit's content handlers, by the order `ingestPreset` brings them in; `<SceneCanvas ingestion.kitHandlers>`
 *  turns any of them off. */
export const KIT_CONTENT_HANDLERS: readonly ContentHandlerEntry[] = [
  kitImageHandler, kitSvgHandler, kitWeaselJsonHandler,
];
