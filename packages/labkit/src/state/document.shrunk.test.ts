/** Shrunk counterexamples from `document.pbt.test.ts`, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { CURRENT_DOCUMENT_VERSION, MIGRATIONS, normalizeDocument, runMigrations } from './document';

describe('a stored document', () => {
  it('holding a list where its layout or its undocked panels go starts them empty', () => {
    const doc = normalizeDocument({ layout: [], undockedPanels: [1] }, 'light');
    expect(doc.layout).toEqual({});
    expect(doc.undockedPanels).toEqual({});
  });

  it('stamped with a version no migration starts from is refused, not passed as current', () => {
    for (const version of [Number.NaN, 2.5, -1]) {
      expect(
        runMigrations({ version, workspaces: [] }, MIGRATIONS, CURRENT_DOCUMENT_VERSION),
      ).toMatchObject({ ok: false, reason: 'failed' });
    }
  });
});
