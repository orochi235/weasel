import { describe, expect, it } from 'vitest';
import { admitIngestMime, itemsFromDataTransfer, itemTypesFromDataTransfer } from './ingestItems';

const untyped = { kind: 'string' as const, type: '', getAsFile: () => null, getAsString: (cb: (s: string) => void) => cb('x') };
const dt = { items: [untyped], files: [] } as unknown as DataTransfer;

describe('an untyped string item', () => {
  it('is offered during the drag exactly when the drop takes it', async () => {
    const release = admitIngestMime('application/octet-stream');
    try {
      const dropped = await itemsFromDataTransfer(dt);
      expect(dropped.map((i) => i.mime)).toEqual(['application/octet-stream']);
      expect(itemTypesFromDataTransfer(dt)).toEqual([{ pending: 'string', mime: 'application/octet-stream' }]);
    } finally { release(); }
    expect(await itemsFromDataTransfer(dt)).toEqual([]);
    expect(itemTypesFromDataTransfer(dt)).toEqual([]);
  });
});
