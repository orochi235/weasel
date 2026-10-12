/**
 * The kit's weasel-JSON clipboard content handler.
 *
 * Consumes `application/x-weasel-clipboard+json` payloads in either MIME
 * spelling (Chromium's async-clipboard API round-trips custom formats with
 * a `web ` prefix), `text/plain` that sniffs as the wire format, and
 * `text/plain` SVG carrying the wire format embedded in a `<metadata>`
 * element (Chromium's DOM paste event exposes ONLY `text/plain`). It replays
 * them as a paste through the hosting canvas's adapter, mirroring
 * `useClipboardOps.paste`'s op construction exactly so OS-arriving pastes
 * and in-memory pastes are indistinguishable in history.
 *
 * Declines when `ctx.clipboard` is absent or the payload fails to parse.
 * `runIngest` consumes items at *match* time, so "leave it for other
 * handlers" is the sniff's job: non-weasel `text/plain` never matches.
 */
import type { NodeId } from 'core/scene/types';
import type { ClipboardSnapshot } from 'core/adapters/types';
import { materializePaste } from 'interactions/actions/clipboard/materializePaste';
import {
  WEASEL_CLIPBOARD_MIME,
  WEASEL_CLIPBOARD_MIME_WEB,
  sniffWeaselClipboardText,
  parseWeaselClipboardText,
  extractWeaselClipboardFromSvg,
} from 'interactions/actions/clipboard/wireFormat';
import { dwarn } from '../../debug';
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';
// Direct module import (not the ./index barrel) to avoid a cycle — the
// barrel re-exports this handler.
import { sniffSvgText } from './svgHandler';

/** text/plain SVG whose `<metadata>` carries a verified weasel payload —
 *  the draw→draw DOM-paste flavor (Chromium exposes only text/plain there).
 *  The `"weaselClipboard"` substring guard keeps match cheap on arbitrary
 *  external SVG pastes before the extraction regex runs. */
const isMetadataBearingSvg = (text: string): boolean =>
  text.includes('"weaselClipboard"')
  && sniffSvgText(text)
  && extractWeaselClipboardFromSvg(text) !== null;

export const kitWeaselJsonHandler: ContentHandlerEntry = {
  id: 'kit:weasel-json',
  // Above the other kit handlers (-100/-90) so weasel payloads never fall
  // through to the SVG/text paths; still below consumer handlers (default 0).
  priority: -50,
  match: (item) =>
    item.kind === 'string'
    && (item.mime === WEASEL_CLIPBOARD_MIME
      || item.mime === WEASEL_CLIPBOARD_MIME_WEB
      || (item.mime === 'text/plain'
        && (sniffWeaselClipboardText(item.text) || isMetadataBearingSvg(item.text)))),
  types: [WEASEL_CLIPBOARD_MIME, WEASEL_CLIPBOARD_MIME_WEB, 'text/plain'],
  handle(items, ctx: IngestCtx) {
    const clipboard = ctx.clipboard;
    if (!clipboard) {
      dwarn('clipboard', 'weasel payload arrived but ctx.clipboard is not wired (ingestion.clipboard disabled or absent) — declining');
      return;
    }
    if (!clipboard.adapter.commitPaste) {
      dwarn('clipboard', 'weasel payload arrived but the clipboard adapter lacks commitPaste — declining');
      return;
    }
    const item = items.find((it) => it.kind === 'string');
    if (!item || item.kind !== 'string') return;
    // The metadata-bearing-SVG flavor: unwrap the embedded payload before
    // parsing. Extraction was already verified at match time, so a null here
    // is the same inert-decline class as a corrupt custom-MIME payload.
    const text = sniffSvgText(item.text)
      ? extractWeaselClipboardFromSvg(item.text)
      : item.text;
    if (text === null) {
      dwarn('clipboard', 'weasel payload vanished from the SVG metadata between match and handle — declining');
      return;
    }
    const nodes = parseWeaselClipboardText(text, clipboard.reviver);
    if (nodes === null) {
      dwarn('clipboard', 'weasel payload unusable — declining (see prior warning if the parse threw)');
      return;
    }
    // `ctx.point` is null for paste, so no dropPoint is threaded — the
    // cascade offset is the placement.
    const snapshot: ClipboardSnapshot = { items: nodes };
    const result = materializePaste(clipboard.adapter, snapshot, {
      currentSelection: ctx.selection.get(),
      onOmitted: clipboard.onOmitted,
    });
    if (!result) return;
    ctx.applyOps(result.ops, 'Paste');
    ctx.selection.set(result.newIds as NodeId[]);
    // So kit:svg's text/plain fallback declines the SVG flavor of this copy.
    // WARNING: do not add an `await` earlier in this handle — the flag must
    // be written before lower-priority handlers' microtasks run.
    ctx.consumedWeaselPayload = true;
  },
};
