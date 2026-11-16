import { useLatest } from '@weasel-js/react';
import { itemsFromFiles, type ActionsRegistry, type IngestItem } from '@weasel-js/routing';
import type { InsertAdapter } from 'core/adapters/types';
import type { ClipboardIngestCtx } from 'interactions/actions/depSchema';
import { useCallback, useEffect, useMemo } from 'react';
import { dwarn } from '../../debug';
import { admitHandlerMimes, type ContentHandlerEntry } from './contentHandlers';
import type { ImmediateParams } from '@weasel-js/routing';
import type {} from '../../interactions/actions/actionParamSchema';

const NONE: readonly ContentHandlerEntry[] = [];

/** `<SceneCanvas ingestion={{ kitHandlers }}>`: which of the kit's content handlers (those with a `kit:` id, which
 *  `@weasel-js/editing`'s `ingestPreset` brings) the canvas keeps. `true` (the default) keeps every one, `false`
 *  none, and `{ omit }` all but the ids named (`'kit:image'`, `'kit:svg'`, `'kit:weasel-json'`). */
export type KitHandlersOption = boolean | { omit: readonly string[] };

/** `presetHandlers` less the kit handlers `option` turns off. */
function keptHandlers(presetHandlers: readonly ContentHandlerEntry[], option: KitHandlersOption): readonly ContentHandlerEntry[] {
  if (option === true) return presetHandlers;
  const off = (id: string) => id.startsWith('kit:') && (option === false || option.omit.includes(id));
  return presetHandlers.filter((h) => !off(h.id));
}

/** What `useCanvasIngestion` reads of `<SceneCanvas ingestion>`. */
export interface CanvasIngestionOptions {
  handlers?: ContentHandlerEntry[];
  kitHandlers?: KitHandlersOption;
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
  /** For the `ingestion` dep: this canvas's own handlers and the kit's it keeps. */
  handlers: readonly ContentHandlerEntry[];
}

/**
 * One canvas's share of ingestion: its content handlers and the kit's it keeps, which run on
 * it alone and admit the string flavors they name while it is mounted, the
 * clipboard seam pastes re-materialize through, and the imperative `ingest`, which triggers
 * the `ingest` action so its deps resolve as they do on the dispatcher path.
 *
 * `getRegistry` answers null until the canvas's action registry is reachable.
 */
export function useCanvasIngestion(
  adapter: InsertAdapter<{ id: string }>,
  getRegistry: () => ActionsRegistry | null,
  options: CanvasIngestionOptions | undefined,
  /** Handlers the canvas's presets bring, the kit's among them, tried after its own. */
  presetHandlers: readonly ContentHandlerEntry[] = NONE,
): CanvasIngestion {
  const own = options?.handlers;
  const kit = options?.kitHandlers;
  // Keyed by value, so an inline `{ omit: [...] }` does not rebuild the list every render.
  const omitted = kit === false ? null : typeof kit === 'object' ? kit.omit.join('\n') : '';
  const handlers = useMemo(
    () => [...(own ?? []), ...keptHandlers(presetHandlers, omitted === null ? false : { omit: omitted.split('\n') })],
    [own, omitted, presetHandlers],
  );
  useEffect(() => admitHandlerMimes(handlers), [handlers]);

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
    const params: ImmediateParams = { items, ...(point ? { world: point } : {}) };
    const ran = registry.trigger('ingest', params);
    if (!ran) dwarn('ingest', 'CanvasExtensionApi.ingest ran nothing: this canvas has no `ingest` action. Add `ingest` to `features`.');
    return ran;
  }, [registryOf]);

  return { ingest, clipboard, handlers };
}
