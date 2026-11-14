import type { DocumentCodec, DraftStorage } from './document';
import type { Workspace } from './workspace';
import { workspaceChanges } from './workspaceChanges';

const NONE: ReadonlySet<string> = new Set();

/** `storage` as something to read: opening a draft may tidy it away, which is the editor's to do. */
function readOnly(storage: DraftStorage | undefined): DraftStorage {
  return {
    getItem: (key) => (storage ?? localStorage).getItem(key),
    setItem: () => {},
    removeItem: () => {},
  };
}

/**
 * The ids of the assets the draft kept under `key` changes from `original`: what an `AssetEditor` given the same
 * `draftKey`, `original`, `codec`, and `draftStorage` reports through `onChangedAssets` as it mounts. None where
 * there is no draft or storage cannot be read. For a host that shows one editor at a time and marks the others'
 * assets `changed` before any of them has been opened.
 */
export function draftChangedAssets(
  key: string, original: Workspace, codec: DocumentCodec<Workspace>, storage?: DraftStorage,
): ReadonlySet<string> {
  const opened = codec.openDraft(key, original, readOnly(storage));
  return opened === null ? NONE : new Set(workspaceChanges(original, opened.value).map((asset) => asset.id));
}
