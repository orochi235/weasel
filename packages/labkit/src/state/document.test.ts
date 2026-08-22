import { describe, expect, it } from 'vitest';
import { CURRENT_DOCUMENT_VERSION, emptyDocument, labDocumentKey, quarantineKey } from './document';

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
