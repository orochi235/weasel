import { createEmitter } from '@weasel-js/registry';

/** Story files edited while the workshop runs, for the registry to load again. */
export interface StoryChanges {
  subscribe(listener: (file: string) => void): () => void;
  emit(file: string): void;
}

export function createStoryChanges(): StoryChanges {
  const changes = createEmitter<[file: string]>();
  return { subscribe: changes.subscribe, emit: changes.emit };
}
