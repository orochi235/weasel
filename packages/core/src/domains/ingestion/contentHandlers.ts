/**
 * Content-handler registry for external-content ingestion.
 *
 * All three arrival paths (OS drop, clipboard paste, file picker /
 * `CanvasExtensionApi.ingest`) converge here: `runIngest(items, ctx)`
 * partitions the items across registered handlers in priority order — the
 * first matching handler takes every item it matches; leftovers continue
 * down the list.
 *
 * MIME matching delegates to `mimeMatchesGlob` from `@weasel-js/gestures` —
 * the SAME matcher the binding-level `types` filter uses, so a binding that
 * matched can never disagree with the registry about what a glob means.
 */
import { mimeMatchesGlob, UNKNOWN_MIME } from '@weasel-js/gestures';
import { dwarn } from '../../debug';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { ClipboardIngestCtx, InsertDep, SnapDep, SvgIngestOptions } from 'interactions/actions/depSchema';
import { admitIngestMime, type ActionDeps, type IngestItem } from '@weasel-js/routing';

/** Context handed to every content handler for one ingest event. */
export interface IngestCtx {
  /** World-space arrival point (drop / pointed imperative ingest); `null`
   *  for paste and point-less calls — handlers pick their own policy
   *  (the kit image handler centers on the viewport). */
  point: { x: number; y: number } | null;
  /** Every item the arrival carried, the ones other handlers took included:
   *  a handler can tell that the string it was given rides beside a file.
   *  Absent reads as the items the handler was handed. */
  items?: readonly IngestItem[];
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** The kit insert dep — id/layer/undoable-op supplied; the canonical way
   *  for a handler to mint a node (`insert.commit(bounds, { kind, ... })`). */
  insert: InsertDep;
  /** The canvas's snap dep, for a handler that places what it inserts where a
   *  gesture would: begin a session, take `at()`, `end()`. Its points are ctx
   *  coordinates: world on a 2D canvas, screen in a 3D host. */
  snap?: SnapDep;
  /** Raw op commit for handlers that build their own ops. */
  applyOps(ops: Op[], label?: string): void;
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  /** Consumer file→src resolver (SceneCanvas `ingestion.resolveSrc`).
   *  When absent, the kit image handler embeds as a `data:` URI. */
  resolveSrc?: (file: File) => Promise<string>;
  /** Kit SVG-handler options (SceneCanvas `ingestion.svg`) — e.g.
   *  `{ unpack: unpackSvgFiles }` (from `@weasel-js/svg`) to parse SVG files
   *  into scene nodes. */
  svg?: SvgIngestOptions;
  /** Clipboard-paste seam — present when the hosting `SceneCanvas` supplied
   *  an adapter with `commitPaste`. `reviver` comes from
   *  `SceneCanvasProps.ingestion.clipboard`. Absent ⇒ the kit weasel-JSON
   *  handler declines inert (dwarn, nothing ingested) — its matched items
   *  were already consumed at match time, so they do NOT fall through;
   *  only match-level misses flow on to other handlers. */
  clipboard?: ClipboardIngestCtx;
  /** Set to `true` by the kit weasel-JSON handler when it successfully
   *  pastes a payload in this event. `kit:svg`'s `text/plain` SVG fallback
   *  reads this to decline the SVG flavor of a copy whose weasel-JSON flavor
   *  already ingested (avoids a double-paste when both flavors ride one
   *  clipboard event). */
  consumedWeaselPayload?: boolean;
  /** Full action-deps bag, for consumer handlers that need more. */
  deps: ActionDeps;
}

/** A handler for content arriving by paste, drop or file picker. Handlers are
 *  matched by MIME glob or predicate and run highest-priority first; the kit's
 *  own register at a low priority so a consumer's handler wins by default. */
export interface ContentHandlerEntry {
  /** Stable identifier — used for unregistration and debugging
   *  (`'kit:image'`, `'app:csv'`). */
  id: string;
  /** MIME glob(s) (`'image/*'`, `'text/csv'`) or an item predicate. A drop
   *  or paste keeps string flavors of any exact MIME named here or in
   *  `types` while the handler is registered, so a handler can claim a drag
   *  from the app's own UI by a type of its own. */
  match: string | string[] | ((item: IngestItem) => boolean);
  /** For a predicate `match`: the MIME globs it could say yes to. A drag
   *  still in flight shows its MIMEs and no contents, so a predicate cannot be
   *  asked about it; this is what it is asked instead. Without it, no drag
   *  can be refused while this handler is registered. */
  types?: readonly string[];
  /** Higher runs earlier. Kit defaults register at -100 so any consumer
   *  handler (default 0) beats them. */
  priority?: number;
  handle(items: IngestItem[], ctx: IngestCtx): void | Promise<void>;
}

const HANDLERS: ContentHandlerEntry[] = [];
const RELEASES = new Map<ContentHandlerEntry, (() => void)[]>();

/** The exact MIMEs a handler names, for string flavors to be kept. A glob
 *  names no one flavor, and `application/octet-stream` is what an untyped
 *  file reports, never a string flavor anyone meant. */
function namedMimes(entry: ContentHandlerEntry): string[] {
  const named = [...(typeof entry.match === 'function' ? [] : [entry.match].flat()), ...(entry.types ?? [])];
  return [...new Set(named)].filter((m) => !m.includes('*') && m !== 'application/octet-stream');
}

function unregister(entry: ContentHandlerEntry): void {
  const i = HANDLERS.indexOf(entry);
  if (i < 0) return;
  HANDLERS.splice(i, 1);
  // The same entry may be registered more than once; each registration admitted once.
  const releases = RELEASES.get(entry);
  releases?.pop()?.();
  if (releases?.length === 0) RELEASES.delete(entry);
}

/** Keep the string flavors `entries` name exactly, as registering them would, until the
 *  returned disposer runs: for handlers one canvas holds rather than the registry. */
export function admitHandlerMimes(entries: readonly ContentHandlerEntry[]): () => void {
  const releases = [...new Set(entries.flatMap(namedMimes))].map(admitIngestMime);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releases.forEach((release) => release());
  };
}

/** Register a content handler for every canvas on the page. Returns a disposer that removes
 *  it. A handler for one canvas goes in that canvas's `ingestion.handlers` instead. */
export function registerContentHandler(entry: ContentHandlerEntry): () => void {
  HANDLERS.push(entry);
  const admits = namedMimes(entry).map(admitIngestMime);
  const releases = RELEASES.get(entry) ?? [];
  releases.push(() => admits.forEach((release) => release()));
  RELEASES.set(entry, releases);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    unregister(entry);
  };
}

function byPriority(handlers: readonly ContentHandlerEntry[]): ContentHandlerEntry[] {
  return [...handlers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** Snapshot of registered handlers, priority-ordered (stable within ties —
 *  registration order; Array.prototype.sort is stable per ES2019). */
export function getContentHandlers(): readonly ContentHandlerEntry[] {
  return byPriority(HANDLERS);
}

/** The handlers an arrival on one canvas routes through: the canvas's own, then the
 *  registry's, priority-ordered, so at equal priority the canvas's own run first. */
export function handlersFor(own: readonly ContentHandlerEntry[] | undefined): ContentHandlerEntry[] {
  return byPriority([...(own ?? []), ...HANDLERS]);
}

/** Options for {@link runIngest}. */
export interface RunIngestOptions {
  /**
   * The handlers to route through, in place of the registry. The registry is
   * shared by every canvas on the page, so this is how one canvas routes
   * through its own handlers, and how one arrival path accepts a narrower set
   * of content than the canvas has handlers for.
   * Ordered by `priority` like registered handlers; an item none of them
   * matches is ignored.
   */
  handlers?: readonly ContentHandlerEntry[];
}

function entryMatches(entry: ContentHandlerEntry, item: IngestItem): boolean {
  const { match } = entry;
  if (typeof match === 'function') {
    try {
      return match(item);
    } catch (err) {
      console.warn(`weasel ingest: handler "${entry.id}" match predicate threw`, err);
      return false;
    }
  }
  const globs = Array.isArray(match) ? match : [match];
  return globs.some((g) => mimeMatchesGlob(item.mime, g));
}

/**
 * Whether some handler could claim one of `items`: the registry's, or
 * `handlers`. An item with contents is put to each handler's `match`. One
 * with a MIME alone, from a drag still in flight, is answered from the globs
 * and a predicate's declared `types`; it is never refused when its MIME is
 * `UNKNOWN_MIME`, or while a predicate handler declares no types.
 */
export function couldClaim(
  items: readonly IngestItem[],
  handlers: readonly ContentHandlerEntry[] = HANDLERS,
): boolean {
  return items.some((item) => {
    if ((item as { kind?: string }).kind !== undefined) return handlers.some((h) => entryMatches(h, item));
    if (item.mime === UNKNOWN_MIME) return true;
    return handlers.some((h) => {
      const globs = typeof h.match === 'function' ? h.types : [h.match].flat();
      return globs === undefined || globs.some((g) => mimeMatchesGlob(item.mime, g));
    });
  });
}

/**
 * Route one ingest event's items through the registry. Handlers are queued
 * as microtasks in priority order and their async work then overlaps (each
 * already owns a disjoint item set); a throwing or rejecting handler
 * `console.warn`s and doesn't block the others. The queue order is a real
 * invariant: a higher-priority handler's `handle` body runs before lower
 * ones start, so ctx-flag coordination (e.g. `consumedWeaselPayload`)
 * works — but only while the writing handler stays synchronous up to the
 * write and the reading handler reads before its first `await`.
 * Unmatched items are ignored with a debug-gated `dwarn('ingest', ...)`.
 */
export async function runIngest(
  items: IngestItem[],
  ctx: IngestCtx,
  opts: RunIngestOptions = {},
): Promise<void> {
  let remaining = items;
  const runs: Promise<void>[] = [];
  const handlers = opts.handlers ? byPriority(opts.handlers) : getContentHandlers();

  for (const entry of handlers) {
    if (remaining.length === 0) break;
    const mine = remaining.filter((it) => entryMatches(entry, it));
    if (mine.length === 0) continue;
    remaining = remaining.filter((it) => !mine.includes(it));
    runs.push(
      Promise.resolve()
        .then(() => entry.handle(mine, ctx))
        .catch((err) => {
          console.warn(`weasel ingest: handler "${entry.id}" threw`, err);
        }),
    );
  }

  if (remaining.length > 0) {
    dwarn(
      'ingest',
      `no content handler matched ${remaining.length} item(s):`,
      remaining.map((it) => it.mime).join(', '),
    );
  }

  await Promise.all(runs);
}

/** @internal test seam — clear the registry. Not part of the public barrel. */
export function _resetContentHandlersForTests(): void {
  while (HANDLERS.length > 0) unregister(HANDLERS[0]!);
}
