import { describe, expect, it, vi } from 'vitest';
import type { IdBuffer } from '@weasel-js/renderer';
import type { AnyRenderWorker } from './liveClients';
import { paintPageRun, paintWorkerRun, readStackIds, snapshotStack, type StackFrame, type StackSurface } from './workerStack';
import { combinedStatus, type RenderWorkerStatus } from './workerHealth';

const RECT = { x: 0, y: 0, width: 1, height: 1 };
const ids = (...data: number[]): IdBuffer => ({ x: 0, y: 0, width: data.length, height: 1, data: Uint32Array.from(data) });
const worker = (answer: IdBuffer | null): StackSurface => ({
  by: 'worker', run: { by: 'worker', ids: ['scene'] },
  client: { readIds: () => Promise.resolve(answer) } as unknown as AnyRenderWorker,
});

describe('readStackIds', () => {
  it('fills a pixel the top canvas left empty from the one under it', async () => {
    expect((await readStackIds([worker(ids(5, 6)), worker(ids(0, 7))], new Map(), RECT, undefined))!.data)
      .toEqual(Uint32Array.from([5, 7]));
  });

  it('answers null when a canvas gave no ids, rather than read its pixels as empty', async () => {
    expect(await readStackIds([worker(null), worker(ids(0, 7))], new Map(), RECT, undefined)).toBeNull();
    expect(await readStackIds([{ by: 'worker', run: { by: 'worker', ids: ['scene'] }, client: null }], new Map(), RECT, undefined)).toBeNull();
  });
});

describe('paintWorkerRun', () => {
  it("hands a run's layers the visibility its frame holds for each, by own key", () => {
    let sent: Record<string, unknown> | undefined;
    const client = { update: (u: Record<string, unknown>) => { sent = u; }, sync: () => {} } as unknown as AnyRenderWorker;
    const visibility = Object.fromEntries([['__proto__', false], ['a', true]]) as Record<string, boolean>;
    const frame = { inputs: {}, view: { x: 0, y: 0, scale: 1 }, dims: { width: 1, height: 1, dpr: 1 }, visibility } as unknown as StackFrame;
    paintWorkerRun(client, { by: 'worker', ids: ['__proto__', 'a', 'constructor'] }, frame);
    const shown = sent!.layerVisibility as Record<string, boolean>;
    expect(Object.getPrototypeOf(shown)).toBe(Object.prototype);
    expect(Object.entries(shown)).toEqual([['__proto__', false], ['a', true], ['constructor', true]]);
  });

  const sentFor = (ids: string[], layers: object[], visibility: Record<string, boolean>) => {
    let sent: Record<string, unknown> | undefined;
    const client = { update: (u: Record<string, unknown>) => { sent = u; }, sync: () => {} } as unknown as AnyRenderWorker;
    const frame = { inputs: {}, view: { x: 0, y: 0, scale: 1 }, dims: { width: 1, height: 1, dpr: 1 }, visibility, layers } as unknown as StackFrame;
    paintWorkerRun(client, { by: 'worker', ids }, frame);
    return sent!;
  };

  it('shows each layer as the page would: alwaysOn over an entry, an entry over defaultVisible', () => {
    const sent = sentFor(['scene:a', 'scene:b'], [
      { id: 'scene:a', alwaysOn: true }, { id: 'scene:b', defaultVisible: false },
    ], { 'scene:a': false });
    expect(sent.layerVisibility).toEqual({ 'scene:a': true, 'scene:b': false });
  });

  it('paints nothing of a whole scene layer the page hides', () => {
    expect(sentFor(['scene'], [{ id: 'scene' }], { scene: false }).layerOrder).toEqual([]);
    expect(sentFor(['scene'], [{ id: 'scene' }], {}).layerOrder).toBeUndefined();
  });
});

describe('snapshotStack', () => {
  it('closes every bitmap a worker answered with, drawn or not', async () => {
    const close = vi.fn();
    const bitmap = (width: number) => ({ width, height: width, close }) as unknown as ImageBitmap;
    const surface = (b: ImageBitmap): StackSurface => ({
      by: 'worker', run: { by: 'worker', ids: ['scene'] },
      client: { snapshot: () => Promise.resolve(b) } as unknown as AnyRenderWorker,
    });
    const drawImage = vi.fn();
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(public width: number, public height: number) {}
      getContext() { return { drawImage }; }
      transferToImageBitmap() { return 'composed'; }
    });
    try {
      expect(await snapshotStack([surface(bitmap(4)), surface(bitmap(0))], 4, 4)).toBe('composed');
      expect(drawImage).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('combinedStatus', () => {
  const failed: RenderWorkerStatus = { state: 'failed', failure: { reason: 'init', message: 'no webgl2' } };
  it('names the first failure, else starting while any starts, else running', () => {
    expect(combinedStatus([{ state: 'running' }, failed, { state: 'starting' }])).toBe(failed);
    expect(combinedStatus([{ state: 'running' }, { state: 'starting' }])).toEqual({ state: 'starting' });
    expect(combinedStatus([{ state: 'running' }, { state: 'running' }])).toEqual({ state: 'running' });
    expect(combinedStatus([])).toEqual({ state: 'starting' });
  });

  it('answers the same object while nothing changed', () => {
    expect(combinedStatus([{ state: 'running' }])).toBe(combinedStatus([{ state: 'running' }]));
  });
});

describe('paintPageRun', () => {
  it("adds its layers' spans and its renderer's stats to a timed frame", () => {
    const stats = { drawCalls: 2, ms: 1, spans: [{ id: 'a', drawCalls: 2, ms: 1 }], retained: { composited: 0, redrawn: 0, declined: 0, bytes: 0 } };
    const render = vi.fn();
    const renderer = { render, lastFrameStats: () => stats } as unknown as Parameters<typeof paintPageRun>[0];
    const layer = { id: 'a', label: 'a', space: 'screen' as const, draw: () => [{ kind: 'path' as const, path: { kind: 'rect' as const, x: 0, y: 0, width: 1, height: 1 } }] };
    const timed: NonNullable<StackFrame['timed']> = [];
    const frame = {
      layers: [layer], visibility: {}, order: undefined, view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      dims: { width: 1, height: 1, dpr: 1 }, cache: new Map(), groups: undefined, paints: () => false,
      retain: false, timed,
    } as unknown as StackFrame;
    paintPageRun(renderer, { by: 'page', ids: ['a'] }, 0, frame, new Map());
    expect(timed).toHaveLength(1);
    expect(timed[0]!.spans.map((sp) => sp.id)).toEqual(['a']);
    expect(timed[0]!.render).toBe(stats);
    expect(render.mock.calls[0]![2]).toEqual({ spans: timed[0]!.spans });
  });
});
