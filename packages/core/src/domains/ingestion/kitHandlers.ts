/**
 * The kit's default content handlers, which every `<SceneCanvas>` routes through unless its
 * `ingestion.kitHandlers` turns some or all of them off. They belong to the canvas, not to
 * the page-wide registry, so one canvas turning one off leaves the others alone.
 */
import type { ContentHandlerEntry } from './contentHandlers';
import { kitImageHandler } from './imageHandler';
import { kitSvgHandler } from './svgHandler';
import { kitTextHandler } from './textHandler';
import { kitWeaselJsonHandler } from './weaselJsonHandler';

/** `<SceneCanvas ingestion={{ kitHandlers }}>`: `true` (the default) keeps every kit handler,
 *  `false` none, and `{ omit }` all but the ids named (`'kit:image'`, `'kit:svg'`,
 *  `'kit:weasel-json'`, `'kit:text'`). */
export type KitHandlersOption = boolean | { omit: readonly string[] };

export const KIT_CONTENT_HANDLERS: readonly ContentHandlerEntry[] = [
  kitImageHandler, kitSvgHandler, kitWeaselJsonHandler, kitTextHandler,
];

/** The kit handlers a canvas with `option` routes through. */
export function kitHandlersFor(option: KitHandlersOption = true): readonly ContentHandlerEntry[] {
  if (option === true) return KIT_CONTENT_HANDLERS;
  if (option === false) return [];
  return KIT_CONTENT_HANDLERS.filter((h) => !option.omit.includes(h.id));
}
