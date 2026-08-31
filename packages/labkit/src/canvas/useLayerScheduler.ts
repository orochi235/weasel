import { useVisibleRaf } from '@weasel-js/core';
import { type RefObject, useEffect, useRef } from 'react';
import type { ViewTransform } from '../instrument/types';
import { DEFAULT_FRAME, type WorldFrame } from './worldSpec';

/** One layer of a canvas stack: its id, whether it is currently shown, and how
 *  it paints itself. */
export interface CanvasLayerDescriptor {
  id: string;
  visible: boolean;
  render: (ctx: CanvasRenderingContext2D, view: ViewTransform, frame: WorldFrame) => void;
}

interface SchedulerOptions {
  layers: CanvasLayerDescriptor[];
  view: ViewTransform;
  /** The instrument's coordinate system, resolved against `size`. */
  frame?: WorldFrame;
  canvasRefs: RefObject<Map<string, HTMLCanvasElement>>;
  size: { width: number; height: number; dpr: number };
  /** The element the stack occupies. Given one, the scheduler also stops while
   *  the stack sits outside the viewport. */
  host?: RefObject<Element | null>;
}

export function useLayerScheduler({
  layers,
  view,
  frame = DEFAULT_FRAME,
  canvasRefs,
  size,
  host,
}: SchedulerOptions): void {
  const dirty = useRef<Set<string>>(new Set());
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
  }, [view, frame, size, layers]);

  // Painting only what is dirty is not the same as doing nothing: a hidden tab
  // still commits React updates, and the effect above marks every layer dirty
  // on any view or size change. The gate is what actually stops the work.
  const frameLoop = useVisibleRaf(
    () => {
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
        layer.render(ctx, view, frame);
        ctx.restore();
      }
      dirty.current.clear();
    },
    { target: host },
  );

  useEffect(() => {
    if (dirty.current.size > 0) frameLoop.request();
  });
}
