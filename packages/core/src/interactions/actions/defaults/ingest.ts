/**
 * @experimental
 * `ingest` — routes externally-arrived content (OS drop, clipboard paste,
 * file picker / `CanvasExtensionApi.ingest`) through the content-handler
 * registry (`features/ingestion/contentHandlers`).
 *
 * Registered ambient with both `drop` and `paste` default bindings, so
 * external content works regardless of the active tool. A tool can still
 * bind `{ kind: 'drop', types: [...] }` itself to intercept (active scope
 * beats ambient).
 *
 * This is the `ingest` preset's action. A canvas with `edit` and without
 * `ingest` answers a paste with `clipboard.pasteEvent` instead, which runs
 * the same `ingestFromEvent` limited to the kit's copied-node payload;
 * `useStandardActions` never registers the two together.
 *
 * Every binding declares every modifier `'optional'`: strict matching would
 * otherwise reject Cmd+V paste and macOS Option-drag drops outright.
 *
 * The dispatcher merges event data into `params`: `items` (IngestItem[]),
 * `via` ('drop' | 'paste'), plus `worldX`/`worldY` for drops. Absent
 * coords → `point: null`; handlers pick their own placement policy.
 */
import type { Action } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';
import { runIngest, type IngestCtx, type RunIngestOptions } from 'features/ingestion/contentHandlers';
import type { IngestItem } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

export const ANY_INGEST_MODS = {
  alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional',
} as const;

/** The deps {@link ingestFromEvent} reads; an action calling it declares these. */
export const INGEST_REQUIRES = ['scene', 'selection', 'insert', 'applyOps', 'ingestion'] as const;

/**
 * @experimental
 * Route one drop or paste event's dispatcher params through the content
 * handlers: builds the `IngestCtx` from the action's deps and calls
 * `runIngest`. `opts` is `runIngest`'s, so an action accepting only some
 * content passes `handlers`.
 */
export function ingestFromEvent(
  deps: ActionDeps,
  params: Record<string, unknown> | undefined,
  opts?: RunIngestOptions,
): void {
  const items = params?.items as IngestItem[] | undefined;
  if (!items || items.length === 0) return;
  const ingestion = deps.ingestion;
  const insert = deps.insert;
  const scene = deps.scene;
  const selection = deps.selection;
  if (!ingestion || !insert || !scene || !selection) return;
  const applyOps = deps.applyOps;

  const point =
    typeof params?.worldX === 'number' && typeof params?.worldY === 'number'
      ? { x: params.worldX as number, y: params.worldY as number }
      : null;

  const ctx: IngestCtx = {
    point,
    viewportWorldRect: () => ingestion.viewportWorldRect(),
    insert,
    applyOps: (ops, label) => {
      if (applyOps) applyOps(ops, label ?? 'Ingest');
      else scene.applyBatch(ops, label ?? 'Ingest', defaultCommitAdapter(scene, selection.adapterMethods));
    },
    scene,
    selection,
    // Snapshot per ingest event — intentional. The dep's live getters are
    // fresh at dispatch time, and one consistent resolver per drop/paste
    // beats half a multi-file drop resolving through a swapped-in one.
    resolveSrc: ingestion.resolveSrc,
    svg: ingestion.svg,
    clipboard: ingestion.clipboard,
    deps,
  };
  // Fire-and-forget: handler errors are caught inside runIngest, but a
  // malformed item (non-string mime via untyped JS) can still throw in
  // the matching path — keep the rejection out of the event loop.
  runIngest(items, ctx, opts).catch((err) => console.warn('weasel ingest:', err));
}

export const ingestAction: Action & { requires: string[] } = {
  id: 'ingest',
  label: 'Insert external content',
  defaultBinding: [
    { kind: 'drop', mods: ANY_INGEST_MODS },
    { kind: 'paste', mods: ANY_INGEST_MODS },
  ],
  requires: [...INGEST_REQUIRES],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => ingestFromEvent(deps, params),
  },
  // No `eligible` rule (always eligible): external-content arrival is
  // mode-agnostic in v1. Revisit if a capability-restricted mode needs to
  // refuse drops/pastes (the listener-level editable-target guard already
  // keeps text-editing pastes away from the scene).
  enabled: () => true,
};
