import { type RefObject, useEffect, useRef } from 'react';
import type { ViewTransform } from '../instrument/types';

export interface CanvasLayerDescriptor {
  id: string;
  visible: boolean;
  render: (ctx: CanvasRenderingContext2D, view: ViewTransform) => void;
}

interface SchedulerOptions {
  layers: CanvasLayerDescriptor[];
  view: ViewTransform;
  canvasRefs: RefObject<Map<string, HTMLCanvasElement>>;
  size: { width: number; height: number; dpr: number };
}

export function useLayerScheduler({ layers, view, canvasRefs, size }: SchedulerOptions): void {
  const dirty = useRef<Set<string>>(new Set());
  const rafId = useRef<number | null>(null);
  const lastRenderRef = useRef<Map<string, CanvasLayerDescriptor['render']>>(new Map());

  useEffect(() => {
    for (const layer of layers) {
      const prev = lastRenderRef.current.get(layer.id);
      if (prev !== layer.render) dirty.current.add(layer.id);
      lastRenderRef.current.set(layer.id, layer.render);
    }
    for (const id of [...lastRenderRef.current.keys()]) {
      if (!layers.find((l) => l.id === id)) lastRenderRef.current.delete(id);
    }
  }, [layers]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-mark dirty when view or size changes
  useEffect(() => {
    for (const layer of layers) dirty.current.add(layer.id);
  }, [view, size, layers]);

  useEffect(() => {
    const tick = () => {
      rafId.current = null;
      if (dirty.current.size === 0) return;
      const map = canvasRefs.current;
      if (!map) {
        dirty.current.clear();
        return;
      }
      for (const layer of layers) {
        if (!dirty.current.has(layer.id)) continue;
        if (!layer.visible) continue;
        const canvas = map.get(layer.id);
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.save();
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);
        layer.render(ctx, view);
        ctx.restore();
      }
      dirty.current.clear();
    };
    if (dirty.current.size > 0 && rafId.current === null) {
      rafId.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  });
}
