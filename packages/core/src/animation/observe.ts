import type { AnimatorEvent, AnimatorListener } from './types';

/** The listener set behind `animator.watch`. Every emit site checks `watched`
 *  first and builds its event only then, so an unwatched animator allocates
 *  nothing for observability. */
export class AnimatorEventHub {
  private readonly listeners = new Set<AnimatorListener>();

  get watched(): boolean {
    return this.listeners.size > 0;
  }

  add(listener: AnimatorListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  emit(event: AnimatorEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch (err) { console.error('useAnimator: watch listener threw', err); }
    }
  }
}
