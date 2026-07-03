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

  it('kicks off getAsString reads synchronously (while DataTransfer is live)', async () => {
    let kickedOff = false;
    const syncCheckItem = {
      kind: 'string' as const,
      type: 'text/plain',
      getAsFile: () => null,
      getAsString: (cb: (s: string) => void) => {
        kickedOff = true;
        setTimeout(() => cb('sync-test'), 0);
      },
    };
    const promise = itemsFromDataTransfer(dt([syncCheckItem]));
    expect(kickedOff).toBe(true);
    const out = await promise;
    expect(out).toEqual([{ kind: 'string', mime: 'text/plain', text: 'sync-test' }]);
  });

  it('preserves item order regardless of callback resolution order', async () => {
    // Item 0 (plain) delivers LATE, item 1 (html) delivers immediately —
    // output must still be plain first (item order), not html first
    // (resolution order). This is what the slot-reservation guarantees.
    const slowPlain = {
      kind: 'string' as const,
      type: 'text/plain',
      getAsFile: () => null,
      getAsString: (cb: (s: string) => void) => setTimeout(() => cb('plain-slow'), 0),
    };
    const fastHtml = {
      kind: 'string' as const,
      type: 'text/html',
      getAsFile: () => null,
      getAsString: (cb: (s: string) => void) => cb('<b>fast</b>'),
    };
    const out = await itemsFromDataTransfer(dt([slowPlain, fastHtml]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'string', mime: 'text/plain', text: 'plain-slow' });
    expect(out[1]).toMatchObject({ kind: 'string', mime: 'text/html', text: '<b>fast</b>' });
  });

  it('normalizes MIME parameters and case (bare type/subtype)', async () => {
    const f = new File(['x'], 'a.png', { type: 'IMAGE/PNG' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out[0]).toMatchObject({ mime: 'image/png' });
    // Parameter stripping: a string item advertising a charset still filters
    // into the supported set and stores the bare mime.
    const withParams = await itemsFromDataTransfer(
      dt([stringItem('text/plain;charset=utf-8', 'hi')]),
    );
    expect(withParams).toEqual([{ kind: 'string', mime: 'text/plain', text: 'hi' }]);
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
