/** `lazyDevtools` on a canvas that has gone before its hook loads: a load that then fails is no one's error. */
import { describe, expect, it, vi } from 'vitest';
import { lazyDevtools } from './mount';

vi.mock('./hook', () => {
  throw new Error('the module runner closed');
});

describe('lazyDevtools', () => {
  it('drops a failed load once the canvas it was attaching to has detached', async () => {
    const onRejection = vi.fn();
    process.on('unhandledRejection', onRejection);
    try {
      const detach = lazyDevtools.attach!({} as never, {} as never);
      (detach as () => void)();
      await new Promise((r) => setTimeout(r, 20));
      expect(onRejection).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });
});
