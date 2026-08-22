import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_VERSION,
  emptyDocument,
  labDocumentKey,
  quarantineKey,
  runMigrations,
} from './document';

describe('document keys', () => {
  it('namespaces the document key by storageKey', () => {
    expect(labDocumentKey('mylab')).toBe('lk:mylab');
  });

  it('namespaces the quarantine key by storageKey', () => {
    expect(quarantineKey('mylab')).toBe('lk:mylab:quarantine');
  });
});

describe('emptyDocument', () => {
  it('is stamped at the current version with the given mode', () => {
    const doc = emptyDocument('light');
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
    expect(doc.workspaces).toEqual([]);
    expect(doc.saves).toEqual([]);
    expect(doc.layout).toEqual({});
  });
});

const bump = (to: number) => (doc: Record<string, unknown>) => ({ ...doc, version: to });

describe('runMigrations', () => {
  it('returns a current-version document untouched', () => {
    const doc = { version: 2, a: 1 };
    const out = runMigrations(doc, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2, a: 1 }, migrated: false });
  });

  it('runs every migration from the stored version to the current one', () => {
    const out = runMigrations({ version: 0 }, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2 }, migrated: true });
  });

  it('refuses a document from a future version', () => {
    const out = runMigrations({ version: 9 }, [bump(1)], 1);
    expect(out).toEqual({ ok: false, reason: 'future' });
  });

  it('reports a throwing migration as failed', () => {
    const boom = () => {
      throw new Error('nope');
    };
    const out = runMigrations({ version: 0 }, [boom], 1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('failed');
  });

  it('treats a document with no version as version 0', () => {
    const out = runMigrations({}, [bump(1)], 1);
    expect(out).toEqual({ ok: true, doc: { version: 1 }, migrated: true });
  });
});
