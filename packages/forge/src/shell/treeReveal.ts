import { createEmitter } from '@weasel-js/registry';

const reveals = createEmitter<[path: string]>();

/** Asks the story tree to show the folder at `path`, as clicking its row would. */
export function revealInTree(path: string): void {
  reveals.emit(path);
}

/** Hears `revealInTree`; returns the unsubscribe. */
export function onRevealInTree(listener: (path: string) => void): () => void {
  return reveals.subscribe(listener);
}
