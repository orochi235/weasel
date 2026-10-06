import { type ReactNode, useCallback, useInsertionEffect, useMemo, useRef, useState } from 'react';
import { LightboxLayers } from '../lightbox/LightboxLayers';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { useSurfaceCanvas, useSurfaceOptional } from '../surface/useSurfaceTile';
import { type SurfaceFrame, useTiledSurface } from '../surface/useTiledSurface';

/** Props for `LabSurface`. */
export interface LabSurfaceProps {
  /** Receives the lab body, which the surface's layers cover. */
  bodyRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
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
 * inside, which lifts them around an expanded trial; while lifted they cover
 * the window, the surface re-measures against that, and the buffers resize.
 *
 * A host that already owns a surface keeps it: a lab embedded in a larger
 * shared-surface app must not open a second GL tenancy, and mounts no buffer
 * or layer of its own.
 */
export function LabSurface({ bodyRef, children }: LabSurfaceProps) {
  const outerSurface = useSurfaceOptional();
  const outerOver = useSurfaceCanvas('over');
  const outerUnder = useSurfaceCanvas('under');
  const [ownOver, setOwnOver] = useState<HTMLCanvasElement | null>(null);
  const [ownUnder, setOwnUnder] = useState<HTMLCanvasElement | null>(null);
  const [underLayer, setUnderLayer] = useState<HTMLDivElement | null>(null);
  const [overLayer, setOverLayer] = useState<HTMLDivElement | null>(null);
  const ownOverRef = useRef<HTMLCanvasElement | null>(null);
  const ownUnderRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef({ w: 0, h: 0 });
  const surfaceRef = useRef<ReturnType<typeof useTiledSurface> | null>(null);

  // Sizing the buffer clears all of it, so every tile has to repaint — not
  // only the one whose move triggered the measurement. Both buffers are sized
  // together off one comparison: they are the same box, so a tenant of either
  // is looking at the same rects, and one invalidateAll covers both.
  const onFrame = useCallback((frame: SurfaceFrame) => {
    const canvases = [ownUnderRef.current, ownOverRef.current].filter((c) => c !== null);
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
      outerSurface ? { over: outerOver, under: outerUnder } : { over: ownOver, under: ownUnder },
    [outerSurface, outerOver, outerUnder, ownOver, ownUnder],
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
      {outerSurface ? null : (
        <div className="lk-lab__layer lk-lab__layer--over" ref={overLayerRef}>
          <canvas
            className="lk-lab__surface"
            ref={(el) => {
              ownOverRef.current = el;
              setOwnOver(el);
            }}
          />
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
