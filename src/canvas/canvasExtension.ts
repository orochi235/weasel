import type { RenderLayer } from '../core/layers/render';
import type { IngestItem } from '../features/ingestion/ingestItems';

/**
 * The **public imperative ref handle** for `<SceneCanvas>` (and `<Canvas>`).
 * Obtain it via a ref:
 *
 * ```tsx
 * const ref = useRef<CanvasExtensionApi>(null);
 * <SceneCanvas ref={ref} … />;
 * ref.current?.element?.focus();
 * ```
 *
 * This is a deliberately small, supported consumer surface — not internal.
 * Consumers use `element` for focus / screenshots / `getBoundingClientRect`;
 * plugin packages (e.g. `@weasel-js/hud`) additionally use `requestRedraw`
 * and `registerLayer` to attach externally-owned draw layers.
 *
 * @public
 */
export interface CanvasExtensionApi {
  /** The underlying HTMLCanvasElement. Null until the canvas mounts.
   *  Use this for screenshots, getBoundingClientRect, focus management, etc.
   *  (Replaces the pre-A2 pattern where `ref.current` directly *was* the element.) */
  readonly element: HTMLCanvasElement | null;
  requestRedraw(): void;
  /** Register an externally-owned RenderLayer. The layer participates in the
   *  draw stack and, if it implements `hitTest`, in the dispatcher's hit-test
   *  pipeline (see `src/tools/dispatcher.ts`'s `getHitTestContext`). */
  registerLayer(layer: RenderLayer<unknown>): () => void;
  /** Feed external content into the ingestion pipeline imperatively — the
   *  same content-handler registry that OS drop and clipboard paste hit.
   *  `input` may be raw `File[]` (e.g. from `openFilePicker`) or
   *  pre-normalized `IngestItem[]`. `point` is a world-space placement
   *  anchor; omitted → handlers use their point-less policy (the kit image
   *  handler centers on the viewport).
   *
   *  Optional because ingestion needs the SceneCanvas action stack — the
   *  handle is always populated on `<SceneCanvas>` refs, absent on the
   *  bare-primitive handle. */
  ingest?(input: File[] | IngestItem[], point?: { x: number; y: number }): void;
}
