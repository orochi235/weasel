import { describe, expect, it, vi } from 'vitest';
import { FakeWorker } from './fakeWorker';

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
