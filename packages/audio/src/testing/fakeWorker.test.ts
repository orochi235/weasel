import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeWorker, stubWorkerGlobals } from './fakeWorker';

afterEach(() => { vi.unstubAllGlobals(); });

describe('FakeWorker', () => {
  it('delivers neither replies nor errors once terminated', () => {
    const w = new FakeWorker('w.js');
    const message = vi.fn();
    const error = vi.fn();
    w.addEventListener('message', message);
    w.addEventListener('error', error);
    w.terminate();
    w._reply(1);
    w._fail();
    expect(message).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('stubWorkerGlobals', () => {
  it('restores Worker and Blob, and leaves a global the test stubbed itself', () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    const worker = globalThis.Worker;
    const blob = globalThis.Blob;
    const stub = stubWorkerGlobals();
    expect(globalThis.Worker).toBe(FakeWorker);
    expect(globalThis.Blob).not.toBe(blob);
    stub.restore();
    expect(globalThis.Worker).toBe(worker);
    expect(globalThis.Blob).toBe(blob);
    expect(globalThis.fetch).toBe(fetchStub);
  });
});
