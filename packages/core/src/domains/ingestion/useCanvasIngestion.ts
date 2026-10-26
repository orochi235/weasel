import { useLatest } from '@weasel-js/react';
import { itemsFromFiles, type ActionsRegistry, type IngestItem } from '@weasel-js/routing';
import type { InsertAdapter } from 'core/adapters/types';
import type { ClipboardIngestCtx } from 'interactions/actions/depSchema';
import { useCallback, useEffect, useMemo } from 'react';
import { dwarn } from '../../debug';
import { registerContentHandler, type ContentHandlerEntry } from './contentHandlers';
import { acquireKitContentHandlers } from './registerKitHandlers';

/** What `useCanvasIngestion` reads of `<SceneCanvas ingestion>`. */
export interface CanvasIngestionOptions {
  handlers?: ContentHandlerEntry[];
  clipboard?: {
    reviver?: ClipboardIngestCtx['reviver'];
    enabled?: boolean;
    onOmitted?: ClipboardIngestCtx['onOmitted'];
  };
}

export interface CanvasIngestion {
  /** `SceneCanvasApi.ingest`. */
  ingest(input: File[] | IngestItem[], point?: { x: number; y: number }): boolean;
  /** For the `ingestion` dep. Absent, so the kit weasel-JSON handler declines, when
   *  `clipboard.enabled` is false or the adapter cannot `commitPaste`. */
  clipboard: ClipboardIngestCtx | undefined;
}

/**
 * One canvas's share of ingestion: its content handlers for as long as it is mounted, the
 * clipboard seam pastes re-materialize through, and the imperative `ingest`, which triggers
 * the `ingest` action so its deps resolve as they do on the dispatcher path.
 *
 * `getRegistry` answers null until the canvas's action registry is reachable.
 */
export function useCanvasIngestion(
  adapter: InsertAdapter<{ id: string }>,
  getRegistry: () => ActionsRegistry | null,
  options: CanvasIngestionOptions | undefined,
): CanvasIngestion {
  // The kit's default handlers are refcounted across mounted canvases.
  const handlers = options?.handlers;
  useEffect(() => {
    const disposers = [acquireKitContentHandlers()];
    for (const h of handlers ?? []) disposers.push(registerContentHandler(h));
    return () => disposers.forEach((d) => d());
  }, [handlers]);

  const reviver = options?.clipboard?.reviver;
  const enabled = options?.clipboard?.enabled !== false;
  const onOmitted = useLatest(options?.clipboard?.onOmitted);
  const clipboard = useMemo<ClipboardIngestCtx | undefined>(() => {
    if (!enabled || !adapter.commitPaste) return undefined;
    return {
      adapter,
      ...(reviver ? { reviver } : {}),
      onOmitted: (omitted) => onOmitted.current?.(omitted),
    };
  }, [adapter, enabled, reviver, onOmitted]);

  const registryOf = useLatest(getRegistry);
  const ingest = useCallback<CanvasIngestion['ingest']>((input, point) => {
    const items: IngestItem[] = (input as (File | IngestItem)[]).map((entry) =>
      entry instanceof File ? itemsFromFiles([entry])[0] : entry,
    );
    if (items.length === 0) return false;
    const registry = registryOf.current();
    if (!registry) {
      dwarn('ingest', 'CanvasExtensionApi.ingest called before the action registry mounted — call ignored. Defer to an effect or event handler.');
      return false;
    }
    const params = { items, ...(point ? { worldX: point.x, worldY: point.y } : {}) };
    const ran = registry.trigger('ingest', params);
    if (!ran) dwarn('ingest', 'CanvasExtensionApi.ingest ran nothing: this canvas has no `ingest` action. Add `ingest` to `features`.');
    return ran;
  }, [registryOf]);

  return { ingest, clipboard };
}
