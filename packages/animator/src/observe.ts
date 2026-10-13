import { createEmitter } from '@weasel-js/registry';
import type { AnimatorEvent, AnimatorListener } from './types';

/** The listener set behind `animator.watch`. Every emit site checks `watched`
 *  first and builds its event only then, so an unwatched animator allocates
 *  nothing for observability. */
export class AnimatorEventHub {
  private readonly events = createEmitter<[AnimatorEvent]>();

  get watched(): boolean {
    return this.events.size > 0;
  }

  add(listener: AnimatorListener): () => void {
    return this.events.subscribe(listener);
  }

  emit(event: AnimatorEvent): void {
    this.events.emit(event);
  }
}
