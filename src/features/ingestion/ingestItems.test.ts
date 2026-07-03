import { describe, it, expect } from 'vitest';
import { itemsFromDataTransfer, itemsFromClipboardData } from './ingestItems';

/** Minimal DataTransferItem stand-in (jsdom has no DataTransfer constructor). */
function fileItem(name: string, type: string) {
  const file = new File(['x'], name, { type });
  return { kind: 'file' as const, type, getAsFile: () => file, getAsString: () => {} };
}
function stringItem(type: string, text: string) {
  return {
    kind: 'string' as const, type,
    getAsFile: () => null,
    getAsString: (cb: (s: string) => void) => setTimeout(() => cb(text), 0),
  };
}
function dt(items: unknown[], files: File[] = []) {
  return { items, files } as unknown as DataTransfer;
}

describe('itemsFromDataTransfer', () => {
  it('materializes files and strings (strings read async)', async () => {
    const out = await itemsFromDataTransfer(dt([
      fileItem('a.png', 'image/png'),
      stringItem('text/plain', 'hello'),
    ]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'file', mime: 'image/png' });
    expect(out[1]).toMatchObject({ kind: 'string', mime: 'text/plain', text: 'hello' });
  });

  it('ignores string flavors outside the supported set', async () => {
    const out = await itemsFromDataTransfer(dt([stringItem('application/x-moz-custom', 'x')]));
    expect(out).toHaveLength(0);
  });

  it('falls back to dataTransfer.files when items is empty', async () => {
    const f = new File(['x'], 'b.jpg', { type: 'image/jpeg' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out).toEqual([{ kind: 'file', mime: 'image/jpeg', file: f }]);
  });

  it('defaults a missing file MIME to application/octet-stream', async () => {
    const f = new File(['x'], 'noext', { type: '' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out[0]).toMatchObject({ mime: 'application/octet-stream' });
  });

  it('normalizes MIME parameters and case (bare type/subtype)', async () => {
    const f = new File(['x'], 'a.png', { type: 'IMAGE/PNG' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out[0]).toMatchObject({ mime: 'image/png' });
  });
});

describe('itemsFromClipboardData', () => {
  it('reads files and text flavors synchronously', () => {
    const f = new File(['x'], 'c.png', { type: 'image/png' });
    const cd = {
      files: [f],
      getData: (t: string) => (t === 'text/plain' ? 'pasted' : ''),
    } as unknown as DataTransfer;
    const out = itemsFromClipboardData(cd);
    expect(out).toEqual([
      { kind: 'file', mime: 'image/png', file: f },
      { kind: 'string', mime: 'text/plain', text: 'pasted' },
    ]);
  });
});
