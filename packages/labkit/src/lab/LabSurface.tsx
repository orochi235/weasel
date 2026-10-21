import {
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LabContribution } from '../chrome/labTypes';
import { OverlayRegion } from '../chrome/regions/OverlayRegion';
import { LightboxLayers } from '../lightbox/LightboxLayers';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { type SurfaceFrame, useTiledSurface } from '../surface/useTiledSurface';

/** Props for `LabSurface`. */
export interface LabSurfaceProps {
  /** Receives the lab body, which the surface's layers cover. */
  bodyRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
  /** The lab's contributions; the `overlay` ones render after `children`,
   *  inside the surface. */
  contributions?: readonly LabContribution[];
}

/** The `top` buffer: mounted only while some tenant claims it. */
function useTopBuffer(
  ref: RefObject<HTMLCanvasElement | null>,
  bufferRef: RefObject<{ w: number; h: number }>,
  surfaceRef: RefObject<ReturnType<typeof useTiledSurface> | null>,
) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [claims, setClaims] = useState(0);
  // A buffer that mounts later starts at 0×0; forgetting the size makes the
  // next frame size every buffer, and repaint every tile into them.
  const attach = useCallback(
    (el: HTMLCanvasElement | null) => {
      ref.current = el;
      setCanvas(el);
      if (el) {
        bufferRef.current = { w: 0, h: 0 };
        surfaceRef.current?.invalidateAll();
      }
    },
    [ref, bufferRef, surfaceRef],
  );
  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  return { canvas, claims, attach, claim };
}

/**
 * The lab body and the one shared drawing surface its trials paint into.
 *
 * The two buffers sit in layers stacked around the trials, both taking no
 * input — each tile takes it from its own box. A tile's marks annotate the
 * instrument's DOM from over it; an opaque renderer sits under it, so the
 * pane can still hold a label. Tile rects are measured against the over
 * layer, which is also where a tile's own chrome on the surface (an
 * annotation input box) mounts. The layers are declared to any lightbox
 * inside, which lifts them around an expanded trial. A third buffer, `top`,
 * mounts in the over layer above the over buffer while a tenant claims it.
 *
 * A host that already owns a surface keeps it: a lab embedded in a larger
 * shared-surface app must not open a second GL tenancy.
 */
export function LabSurface({ bodyRef, children, contributions }: LabSurfaceProps) {
  const outerSurface = useSurfaceOptional();
  const outerCanvases = useContext(SurfaceCanvasContext);
  const [ownOver, setOwnOver] = useState<HTMLCanvasElement | null>(null);
  const [ownUnder, setOwnUnder] = useState<HTMLCanvasElement | null>(null);
  const [underLayer, setUnderLayer] = useState<HTMLDivElement | null>(null);
  const [overLayer, setOverLayer] = useState<HTMLDivElement | null>(null);
  const ownOverRef = useRef<HTMLCanvasElement | null>(null);
  const ownUnderRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef({ w: 0, h: 0 });
  const surfaceRef = useRef<ReturnType<typeof useTiledSurface> | null>(null);
  const ownTopRef = useRef<HTMLCanvasElement | null>(null);
  const top = useTopBuffer(ownTopRef, bufferRef, surfaceRef);

  // Sizing the buffer clears all of it, so every tile has to repaint — not
  // only the one whose move triggered the measurement. Every buffer is the
  // same box, so one invalidateAll covers them all.
  const onFrame = useCallback((frame: SurfaceFrame) => {
    const canvases = [ownUnderRef.current, ownOverRef.current, ownTopRef.current].filter(
      (c) => c !== null,
    );
    if (canvases.length === 0) return;
    const w = Math.round(frame.size.width * frame.dpr);
    const h = Math.round(frame.size.height * frame.dpr);
    if (bufferRef.current.w !== w || bufferRef.current.h !== h) {
      bufferRef.current = { w, h };
      for (const c of canvases) {
        c.width = w;
        c.height = h;
        c.style.width = `${frame.size.width}px`;
        c.style.height = `${frame.size.height}px`;
      }
      surfaceRef.current?.invalidateAll();
      return;
    }
    // A same-size re-tile does not go through here: assigning `width` its own
    // value resizes nothing, so it clears nothing. The tenants clear, through
    // `registerClear`.
  }, []);

  const ownSurface = useTiledSurface({ onFrame });
  // Not `useLatest`: `onFrame` reads it, and is needed before the surface exists.
  useInsertionEffect(() => {
    surfaceRef.current = ownSurface;
  }, [ownSurface]);

  const attachOwnSurface = ownSurface.containerRef;
  const overLayerRef = useCallback(
    (el: HTMLDivElement | null) => {
      setOverLayer(el);
      attachOwnSurface(el);
    },
    [attachOwnSurface],
  );

  const surface = outerSurface ?? ownSurface;
  const canvases = useMemo(
    () =>
      outerSurface
        ? outerCanvases
        : { over: ownOver, under: ownUnder, top: top.canvas, claimTop: top.claim },
    [outerSurface, outerCanvases, ownOver, ownUnder, top.canvas, top.claim],
  );
  const below = useMemo(() => [underLayer], [underLayer]);
  const above = useMemo(() => [overLayer], [overLayer]);

  const body = (
    <div className="lk-lab__body" ref={bodyRef}>
      {outerSurface ? null : (
        <div className="lk-lab__layer lk-lab__layer--under" ref={setUnderLayer}>
          <canvas
            className="lk-lab__surface"
            ref={(el) => {
              ownUnderRef.current = el;
              setOwnUnder(el);
            }}
          />
        </div>
      )}
      {children}
      {contributions ? <OverlayRegion contributions={contributions} /> : null}
      {outerSurface ? null : (
        <div className="lk-lab__layer lk-lab__layer--over" ref={overLayerRef}>
          <canvas
            className="lk-lab__surface"
            ref={(el) => {
              ownOverRef.current = el;
              setOwnOver(el);
            }}
          />
          {top.claims > 0 ? (
            <canvas className="lk-lab__surface lk-lab__surface--top" ref={top.attach} />
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <SurfaceContext.Provider value={surface}>
      <SurfaceCanvasContext.Provider value={canvases}>
        <LightboxLayers below={below} above={above}>
          {body}
        </LightboxLayers>
      </SurfaceCanvasContext.Provider>
    </SurfaceContext.Provider>
  );
}
