import type { LabDocument, LabMode } from './types';

/** Bumped whenever the persisted shape changes; every bump needs a migration. */
export const CURRENT_DOCUMENT_VERSION = 1;

/** The one key a lab persists under. */
export function labDocumentKey(storageKey: string): string {
  return `lk:${storageKey}`;
}

/** Where a document that failed to migrate is set aside, so a bad migration
 *  loses state loudly rather than silently. */
export function quarantineKey(storageKey: string): string {
  return `lk:${storageKey}:quarantine`;
}

/** A fresh document at the current version. */
export function emptyDocument(mode: LabMode): LabDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    workspaces: [],
    saves: [],
    layout: {},
    mode,
  };
}
