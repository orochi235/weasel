/**
 * The kit's weasel-JSON clipboard content handler.
 *
 * Consumes `application/x-weasel-clipboard+json` payloads (either MIME
 * spelling — Chromium's async-clipboard API round-trips custom formats with
 * a `web ` prefix — plus `text/plain` that sniffs as the wire format) and
 * replays them as a paste through the hosting canvas's adapter: parse →
 * `commitPaste` (fresh ids, cascade offset) → one undoable batch of
 * `InsertOp`s + a selection op. Mirrors `useClipboardOps.paste`'s op
 * construction exactly so OS-arriving pastes and in-memory pastes are
 * indistinguishable in history.
 *
 * Declines (leaving the event un-acted-on) when `ctx.clipboard` is absent
 * (consumer disabled it, or the adapter lacks `commitPaste`) or the payload
 * fails to parse. Note `runIngest` consumes items at *match* time, so
 * "leave it for other handlers" is the sniff's job: non-weasel `text/plain`
 * never matches and flows on to lower-priority handlers untouched.
 */
import type { NodeId } from 'core/scene/types';
import type { ClipboardSnapshot } from 'core/adapters/types';
import { materializePaste } from 'interactions/actions/clipboard/materializePaste';
import {
  WEASEL_CLIPBOARD_MIME,
  WEASEL_CLIPBOARD_MIME_WEB,
  sniffWeaselClipboardText,
  parseWeaselClipboardText,
} from 'interactions/actions/clipboard/wireFormat';
import { dwarn } from '../../debug';
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';

export const kitWeaselJsonHandler: ContentHandlerEntry = {
  id: 'kit:weasel-json',
  // Above the other kit handlers (-100/-90) so weasel payloads never fall
  // through to the SVG/text paths; still below consumer handlers (default 0).
  priority: -50,
  match: (item) =>
    item.kind === 'string'
    && (item.mime === WEASEL_CLIPBOARD_MIME
      || item.mime === WEASEL_CLIPBOARD_MIME_WEB
      || (item.mime === 'text/plain' && sniffWeaselClipboardText(item.text))),
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
    const nodes = parseWeaselClipboardText(item.text, clipboard.reviver);
    if (nodes === null) {
      dwarn('clipboard', 'weasel payload unusable — declining (see prior warning if the parse threw)');
      return;
    }
    // Shared paste recipe (offset → commitPaste → InsertOps + selection op)
    // so OS-arriving pastes match useClipboardOps.paste exactly. `ctx.point`
    // is null for paste, so no dropPoint is threaded — the cascade offset is
    // the placement.
    const snapshot: ClipboardSnapshot = { items: nodes };
    const result = materializePaste(clipboard.adapter, snapshot, {
      currentSelection: ctx.selection.get(),
    });
    if (!result) return;
    ctx.applyOps(result.ops, 'Paste');
    ctx.selection.set(result.newIds as NodeId[]);
    // Flag the shared event ctx so kit:svg's text/plain fallback declines the
    // SVG flavor of this same copy (draw writes weasel-JSON + SVG together).
    ctx.consumedWeaselPayload = true;
  },
};
