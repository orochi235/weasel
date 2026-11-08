import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

let finish!: () => void;
vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  warmRender: async () => {},
  renderDebugSnapshot: () => ({}),
  rasterToPng: () => new Promise((resolve) => { finish = () => resolve(new Blob(['png'])); }),
}));

const { DebugOverlayDemo } = await import('../DebugOverlayDemo');

describe('DebugOverlayDemo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes no object URL for a snapshot that finishes after the demo has gone', async () => {
    const made: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal('URL', Object.assign(class extends URL {}, {
      createObjectURL: () => { made.push(`blob:${made.length}`); return made.at(-1)!; },
      revokeObjectURL: (u: string) => { revoked.push(u); },
    }));
    const { getByRole, unmount } = render(<DebugOverlayDemo />);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'snapshot' })); });
    expect(finish).toBeTypeOf('function');
    unmount();
    await act(async () => { finish(); });
    expect(made.filter((u) => !revoked.includes(u))).toEqual([]);
  });
});
