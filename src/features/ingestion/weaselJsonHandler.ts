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
import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { ClipboardSnapshot } from 'core/adapters/types';
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
    item.mime === WEASEL_CLIPBOARD_MIME
    || item.mime === WEASEL_CLIPBOARD_MIME_WEB
    || (item.mime === 'text/plain' && item.kind === 'string' && sniffWeaselClipboardText(item.text)),
  handle(items, ctx: IngestCtx) {
    const clipboard = ctx.clipboard;
    const adapter = clipboard?.adapter;
    if (!clipboard || !adapter?.commitPaste) {
      dwarn('clipboard', 'weasel payload arrived but ctx.clipboard is not wired — declining');
      return;
    }
    const item = items.find((it) => it.kind === 'string');
    if (!item || item.kind !== 'string') return;
    const nodes = parseWeaselClipboardText(item.text, clipboard.reviver);
    if (nodes === null) {
      dwarn('clipboard', 'weasel payload failed to parse — declining');
      return;
    }
    // Mirror useClipboardOps.paste's op construction: commitPaste
    // materializes (fresh ids, roots offset), ops do the inserting so the
    // whole paste is one undo entry. `ctx.point` is null for paste, so no
    // dropPoint ctx is threaded — the cascade offset is the placement.
    const snapshot: ClipboardSnapshot = { items: nodes };
    const offset = adapter.getPasteOffset?.(snapshot) ?? { dx: 0, dy: 0 };
    const created = adapter.commitPaste(snapshot, offset);
    if (created.length === 0) return;
    const newIds = created.map((o) => o.id as NodeId);
    const ops: Op[] = [
      ...created.map((o) => createInsertOp({ node: o })),
      createSetSelectionOp({ from: ctx.selection.get(), to: newIds }),
    ];
    ctx.applyOps(ops, 'Paste');
    ctx.selection.set(newIds);
  },
};
