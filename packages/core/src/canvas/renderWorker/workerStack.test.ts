import { describe, expect, it } from 'vitest';
import type { IdBuffer } from '@weasel-js/renderer';
import type { AnyRenderWorker } from './liveClients';
import { paintWorkerRun, readStackIds, type StackFrame, type StackSurface } from './workerStack';
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
    expect(Object.entries(shown)).toEqual([['__proto__', false], ['a', true]]);
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
