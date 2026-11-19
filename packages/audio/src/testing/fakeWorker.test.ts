import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeWorker, stubWorkerGlobals } from './fakeWorker';

describe('stubWorkerGlobals', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('puts back only the globals it stubbed', () => {
    const mine = { stubbed: 'by the test' };
    vi.stubGlobal('AudioContext', mine);
    const env = stubWorkerGlobals();
    expect(globalThis.Worker).toBe(FakeWorker);
    env.restore();
    expect((globalThis as Record<string, unknown>).AudioContext).toBe(mine);
  });

  it('puts back the Worker and Blob that were there before', () => {
    const before = { Worker: globalThis.Worker, Blob: globalThis.Blob, has: 'Worker' in globalThis };
    const env = stubWorkerGlobals();
    env.restore();
    expect(globalThis.Blob).toBe(before.Blob);
    expect(globalThis.Worker).toBe(before.Worker);
    expect('Worker' in globalThis).toBe(before.has);
  });
});

describe('FakeWorker', () => {
  it('delivers neither a reply nor a failure once terminated', () => {
    const w = new FakeWorker('blob:x');
    const message = vi.fn();
    const error = vi.fn();
    w.addEventListener('message', message);
    w.addEventListener('error', error);
    w.terminate();
    w._reply('late');
    w._fail();
    expect(message).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
