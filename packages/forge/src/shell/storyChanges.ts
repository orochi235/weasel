/** Story files edited while the workshop runs, for the registry to load again. */
export interface StoryChanges {
  subscribe(listener: (file: string) => void): () => void;
  emit(file: string): void;
}

export function createStoryChanges(): StoryChanges {
  const listeners = new Set<(file: string) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(file) {
      for (const listener of [...listeners]) listener(file);
    },
  };
}
