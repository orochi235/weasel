import { describe, expect, it, vi } from 'vitest';
import { openChannel } from './channel';
import type { FromFrame, ToFrame } from './messages';

function pair() {
  const { port1, port2 } = new MessageChannel();
  return { shell: openChannel<FromFrame, ToFrame>(port1), frame: openChannel<ToFrame, FromFrame>(port2) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('openChannel', () => {
  it('delivers typed messages both ways', async () => {
    const { shell, frame } = pair();
    const toFrame = vi.fn();
    const toShell = vi.fn();
    frame.on(toFrame);
    shell.on(toShell);
    shell.send({ type: 'config', config: { n: 1 } });
    frame.send({ type: 'setState', state: 2 });
    await tick();
    expect(toFrame).toHaveBeenCalledWith({ type: 'config', config: { n: 1 } });
    expect(toShell).toHaveBeenCalledWith({ type: 'setState', state: 2 });
  });

  it('reports a message from another protocol version instead of delivering it', async () => {
    const { port1, port2 } = new MessageChannel();
    const onMismatch = vi.fn();
    const received = vi.fn();
    openChannel(port1, { onMismatch }).on(received);
    port2.postMessage({ v: 999, msg: { type: 'play' } });
    port2.start();
    await tick();
    expect(received).not.toHaveBeenCalled();
    expect(onMismatch).toHaveBeenCalledWith(999);
  });

  it('stops delivering after an unsubscribe', async () => {
    const { shell, frame } = pair();
    const fn = vi.fn();
    const off = frame.on(fn);
    off();
    shell.send({ type: 'play' });
    await tick();
    expect(fn).not.toHaveBeenCalled();
  });
});
