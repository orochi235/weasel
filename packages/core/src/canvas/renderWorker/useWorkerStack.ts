/**
 * `<Canvas>`'s worker mode: the stack of canvases its layers are cut into, the workers and
 * renderers behind them, and the frame, id read and snapshot that cross all of them.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { IdBuffer, WeaselRenderer } from '@weasel-js/renderer';
import type { RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';
import type { CanvasIdReadOptions } from '../canvasExtension';
import { leaseCanvasRenderer, type CanvasRendererLease } from '../canvasRenderer';
import { layerRuns, runsKey, type LayerRun } from './layerRuns';
import { holdRenderWorker, type AnyRenderWorker } from './liveClients';
import type { WorkerAnimationHandle, WorkerAnimator } from './workerAnimator';
import {
  paintPageRun, paintWorkerRun, readStackIds, snapshotStack,
  type CanvasWorkerSurface, type PageFrames, type StackFrame, type StackSurface,
} from './workerStack';
import type { WorkerCanvasHandle } from './WorkerSceneView';

export interface WorkerStack {
  runs: readonly LayerRun[];
  /** React's ref callback for the canvas of run `index`, below the top one. */
  canvasRef(index: number): (el: HTMLCanvasElement | null) => void;
  paint(frame: StackFrame, top: WeaselRenderer): void;
  readIds(rect: { x: number; y: number; width: number; height: number }, options?: CanvasIdReadOptions): Promise<IdBuffer>;
  handle: WorkerCanvasHandle;
  /** The page's frames are back after time nobody saw. */
  resumed(): void;
}

/** The ids in draw order the stack is cut from: `order` where given, as `paintedLayers` reads it. */
function orderedIds(layers: readonly RenderLayer<unknown>[], order: readonly string[] | undefined): string[] {
  const ids = layers.map((l) => l.id);
  if (!order) return ids;
  const known = new Set(ids);
  return order.filter((id) => known.has(id));
}

/** Every worker's animator as one: a call goes to each worker, which paints the layers it holds. */
function fanOut(clients: () => readonly AnyRenderWorker[]): WorkerAnimator {
  let next = 0;
  const each = (fn: (a: WorkerAnimator) => void) => { for (const c of clients()) fn(c.animator); };
  return {
    play(key, params) {
      const handles: WorkerAnimationHandle[] = clients().map((c) => c.animator.play(key, params));
      const all = (fn: (h: WorkerAnimationHandle) => void) => () => { for (const h of handles) fn(h); };
      return {
        id: ++next,
        cancel: all((h) => h.cancel()), pause: all((h) => h.pause()), resume: all((h) => h.resume()),
        setTimeScale: (scale) => { for (const h of handles) h.setTimeScale(scale); },
      };
    },
    cancelKey: (key) => each((a) => a.cancelKey(key)),
    pauseKey: (key) => each((a) => a.pauseKey(key)),
    resumeKey: (key) => each((a) => a.resumeKey(key)),
    cancelAll: () => each((a) => a.cancelAll()),
    pause: () => each((a) => a.pause()),
    resume: () => each((a) => a.resume()),
    setTimeScale: (scale) => each((a) => a.setTimeScale(scale)),
  };
}

export function useWorkerStack(
  surface: CanvasWorkerSurface | undefined,
  layers: readonly RenderLayer<unknown>[],
  order: readonly string[] | undefined,
  top: { canvas: { readonly current: HTMLCanvasElement | null }; lease: CanvasRendererLease },
  frame: { viewRef: { readonly current: View }; dims: () => { width: number; height: number }; requestRedraw: () => void },
): WorkerStack | null {
  const paints = surface?.paints;
  const runs = useMemo(
    () => (paints ? layerRuns(orderedIds(layers, order), paints) : []),
    [layers, order, paints],
  );
  const key = runsKey(runs);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const leases = useRef(new Map<number, CanvasRendererLease>());
  const restoredOff = useRef(new Map<number, () => void>());
  const clients = useRef(new Map<number, AnyRenderWorker>());
  const frames = useRef<PageFrames>(new Map());
  const surfaceRef = useLatest(surface);
  const runsRef = useLatest(runs);
  const frameRef = useLatest(frame);

  useLayoutEffect(() => {
    const current = surfaceRef.current;
    if (!current) return;
    const { viewRef, dims, requestRedraw } = frameRef.current;
    const held: { release: () => void; off: () => void }[] = [];
    runsRef.current.forEach((run, i) => {
      if (run.by !== 'worker') return;
      const canvas = canvases.current.get(i);
      if (!canvas) return;
      const hold = holdRenderWorker(canvas, current.start, { ...current.inputs(), view: viewRef.current, ...dims() });
      clients.current.set(i, hold.client);
      held.push({ release: hold.release, off: hold.client.subscribe(requestRedraw) });
    });
    requestRedraw();
    const clientMap = clients.current, leaseMap = leases.current, frameMap = frames.current, offMap = restoredOff.current;
    return () => {
      for (const h of held) { h.off(); h.release(); }
      clientMap.clear();
      for (const off of offMap.values()) off();
      offMap.clear();
      for (const lease of leaseMap.values()) lease.release();
      leaseMap.clear();
      frameMap.clear();
    };
  }, [key, surfaceRef, runsRef, frameRef]);

  const stack = useMemo<WorkerStack>(() => {
    const surfaces = (): StackSurface[] => runsRef.current.map((run, i, all) => {
      if (run.by === 'worker') return { by: 'worker', run, client: clients.current.get(i) ?? null };
      const last = i === all.length - 1;
      return { by: 'page', run, canvas: last ? top.canvas.current : canvases.current.get(i) ?? null, lease: last ? top.lease : null };
    });
    return {
      runs: [],
      canvasRef: (index) => (el) => {
        if (el) canvases.current.set(index, el);
        else canvases.current.delete(index);
      },
      paint(f, topRenderer) {
        const all = runsRef.current;
        all.forEach((run, i) => {
          if (run.by === 'worker') {
            const client = clients.current.get(i);
            if (client) paintWorkerRun(client, run, f);
            return;
          }
          if (i === all.length - 1) return paintPageRun(topRenderer, run, i, f, frames.current);
          const canvas = canvases.current.get(i);
          if (!canvas) return;
          let lease = leases.current.get(i);
          if (!lease) {
            leases.current.set(i, lease = leaseCanvasRenderer());
            // A context restored on a middle canvas needs a frame nothing else asks for.
            restoredOff.current.set(i, lease.subscribeRestored(() => frameRef.current.requestRedraw()));
          }
          const renderer = lease.bind(canvas, f.dims, f.options);
          if (renderer) paintPageRun(renderer, run, i, f, frames.current);
        });
      },
      resumed: () => { for (const c of clients.current.values()) c.resumed(); },
      readIds: (rect, options) => readStackIds(surfaces(), frames.current, rect, options),
      handle: {
        animator: fanOut(() => [...clients.current.values()]),
        snapshot: () => {
          const { width, height } = frameRef.current.dims();
          return snapshotStack(surfaces(), width, height);
        },
      },
    };
  }, [runsRef, top.canvas, top.lease, frameRef]);
  const present = surface !== undefined;
  return useMemo(() => (present ? { ...stack, runs } : null), [present, stack, runs]);
}

/** {@link useWorkerStack}, and the two halves `<Canvas>` hands on: what the paint cuts its frame
 *  across, and what the handle reads ids and the worker through. */
export function useCanvasWorker(
  surface: CanvasWorkerSurface | undefined,
  layers: readonly RenderLayer<unknown>[],
  order: readonly string[] | undefined,
  at: {
    top: { canvas: { readonly current: HTMLCanvasElement | null }; lease: CanvasRendererLease };
    viewRef: { readonly current: View };
    dims: () => { width: number; height: number };
    requestRedraw: () => void;
    subscribeResume: (fn: () => void) => () => void;
  },
) {
  const { top, subscribeResume, ...frame } = at;
  const stack = useWorkerStack(surface, layers, order, top, frame);
  const stackRef = useLatest(stack && surface ? { paint: stack.paint, paints: surface.paints, inputs: surface.inputs } : null);
  useEffect(() => (stack ? subscribeResume(stack.resumed) : undefined), [stack, subscribeResume]);
  const handleWorker = useMemo(() => (stack ? { readIds: stack.readIds, handle: stack.handle } : null), [stack]);
  return { stack, stackRef, handleWorker };
}
