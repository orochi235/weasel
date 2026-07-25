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
 * Both bindings declare every modifier `'optional'`: strict matching would
 * otherwise reject Cmd+V paste and macOS Option-drag drops outright.
 *
 * The dispatcher merges event data into `params`: `items` (IngestItem[]),
 * `via` ('drop' | 'paste'), plus `worldX`/`worldY` for drops. Absent
 * coords → `point: null`; handlers pick their own placement policy.
 */
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Action } from '../registry';
import type { InsertDep, IngestionDep } from '../depSchema';
import { runIngest, type IngestCtx } from 'features/ingestion/contentHandlers';
import type { IngestItem } from 'features/ingestion/ingestItems';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

const ANY_MODS = {
  alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional',
} as const;

export const ingestAction: Action & { requires: string[] } = {
  id: 'ingest',
  label: 'Insert external content',
  defaultBinding: [
    { kind: 'drop', mods: ANY_MODS },
    { kind: 'paste', mods: ANY_MODS },
  ],
  requires: ['scene', 'selection', 'insert', 'applyOps', 'ingestion'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const items = params?.items as IngestItem[] | undefined;
      if (!items || items.length === 0) return;
      const ingestion = deps.ingestion as IngestionDep | undefined;
      const insert = deps.insert as InsertDep | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const selection = deps.selection as SelectionApi | undefined;
      if (!ingestion || !insert || !scene || !selection) return;
      const applyOps = deps.applyOps as ((ops: Op[], label?: string) => void) | undefined;

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
          // `setSelection` is a documented exclusion from the scene-backed
          // commit adapter (the scene doesn't own selection) — spread the
          // SelectionApi's adapter methods over it so selection-carrying
          // batches (e.g. the weasel-JSON paste handler's SetSelectionOp)
          // replay instead of throwing mid-batch.
          else scene.applyBatch(ops, label ?? 'Ingest', { ...defaultCommitAdapter(scene), ...selection.adapterMethods });
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
      runIngest(items, ctx).catch((err) => console.warn('weasel ingest:', err));
    },
  },
  // No `eligible` rule (always eligible): external-content arrival is
  // mode-agnostic in v1. Revisit if a capability-restricted mode needs to
  // refuse drops/pastes (the listener-level editable-target guard already
  // keeps text-editing pastes away from the scene).
  enabled: () => true,
};
