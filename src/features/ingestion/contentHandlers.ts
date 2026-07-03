/**
 * Content-handler registry — the "registry out" half of external-content
 * ingestion (spec: docs/superpowers/specs/2026-07-03-content-ingestion-design.md).
 *
 * All three arrival paths (OS drop, clipboard paste, file picker /
 * `CanvasExtensionApi.ingest`) converge here: the `ingest` action calls
 * `runIngest(items, ctx)`, which partitions the items across registered
 * handlers in priority order — the first matching handler takes every item
 * it matches; leftovers continue down the list. Same per-trait registry
 * idiom as `NodeShape` / `NodeRouting`.
 *
 * MIME matching delegates to `mimeMatchesGlob` from `@weasel-js/gestures` —
 * the SAME matcher the binding-level `types` filter uses, so a binding that
 * matched can never disagree with the registry about what a glob means.
 */
import { mimeMatchesGlob } from '@weasel-js/gestures';
import { dwarn } from '../../debug';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { InsertDep } from 'interactions/actions/depSchema';
import type { ActionDeps } from 'interactions/actions/invoker';
import type { IngestItem } from './ingestItems';

/** Context handed to every content handler for one ingest event. */
export interface IngestCtx {
  /** World-space arrival point (drop / pointed imperative ingest); `null`
   *  for paste and point-less calls — handlers pick their own policy
   *  (the kit image handler centers on the viewport). */
  point: { x: number; y: number } | null;
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** The kit insert dep — id/layer/undoable-op supplied; the canonical way
   *  for a handler to mint a node (`insert.commit(bounds, { kind, ... })`). */
  insert: InsertDep;
  /** Raw op commit for handlers that build their own ops. */
  applyOps(ops: Op[], label?: string): void;
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  /** Consumer file→src resolver (SceneCanvas `ingestion.resolveSrc`).
   *  When absent, the kit image handler embeds as a `data:` URI. */
  resolveSrc?: (file: File) => Promise<string>;
  /** Full action-deps bag, for consumer handlers that need more. */
  deps: ActionDeps;
}

export interface ContentHandlerEntry {
  /** Stable identifier — used for unregistration and debugging
   *  (`'kit:image'`, `'app:csv'`). */
  id: string;
  /** MIME glob(s) (`'image/*'`, `'text/csv'`) or an item predicate. */
  match: string | string[] | ((item: IngestItem) => boolean);
  /** Higher runs earlier. Kit defaults register at -100 so any consumer
   *  handler (default 0) beats them. */
  priority?: number;
  handle(items: IngestItem[], ctx: IngestCtx): void | Promise<void>;
}

const HANDLERS: ContentHandlerEntry[] = [];

/** Register a content handler. Returns a disposer that removes it. */
export function registerContentHandler(entry: ContentHandlerEntry): () => void {
  HANDLERS.push(entry);
  return () => {
    const i = HANDLERS.indexOf(entry);
    if (i >= 0) HANDLERS.splice(i, 1);
  };
}

/** Snapshot of registered handlers, priority-ordered (stable within ties —
 *  registration order; Array.prototype.sort is stable per ES2019). */
export function getContentHandlers(): readonly ContentHandlerEntry[] {
  return [...HANDLERS].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
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
 * Route one ingest event's items through the registry. Handlers run
 * concurrently (each already owns a disjoint item set); a throwing or
 * rejecting handler `console.warn`s and doesn't block the others.
 * Unmatched items are ignored with a debug-gated `dwarn('ingest', ...)`.
 */
export async function runIngest(items: IngestItem[], ctx: IngestCtx): Promise<void> {
  let remaining = items;
  const runs: Promise<void>[] = [];

  for (const entry of getContentHandlers()) {
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
  HANDLERS.length = 0;
}
