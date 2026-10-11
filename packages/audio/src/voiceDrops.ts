import type { VoiceDropReason } from './types';

/** Tell a voice's owner it never played. Queued, as a source's `onended` is:
 *  a play dropped on the spot would otherwise call back before `play()` has
 *  returned the handle. */
export const reportDrop = (
  onDrop: ((reason: VoiceDropReason) => void) | undefined,
  reason: VoiceDropReason,
): void => {
  if (onDrop) queueMicrotask(() => onDrop(reason));
};

/** The console warnings for a dropped play, each given once per engine. */
export interface DropWarnings {
  locked(): void;
  disposed(): void;
  unknownSound(id: string): void;
  /** Let `locked` warn again, after the context suspended a second time. */
  rearmLocked(): void;
}

export function createDropWarnings(): DropWarnings {
  let warnedLocked = false;
  let warnedDisposed = false;
  let warnedUnknownSound = false;
  return {
    locked() {
      if (warnedLocked) return;
      warnedLocked = true;
      console.warn(
        '@weasel-js/audio: play() before the AudioContext was unlocked — the voice was dropped. ' +
        'Browsers require a user gesture; call engine.unlock() from one, or wait for the ' +
        'automatic gesture listener.',
      );
    },
    disposed() {
      if (warnedDisposed) return;
      warnedDisposed = true;
      console.warn('@weasel-js/audio: play() after dispose() — the voice was dropped.');
    },
    unknownSound(id) {
      if (warnedUnknownSound) return;
      warnedUnknownSound = true;
      console.warn(
        `@weasel-js/audio: play() was handed sound "${id}", which this engine never loaded — ` +
        'the voice was dropped. A handle belongs to the engine that produced it.',
      );
    },
    rearmLocked() { warnedLocked = false; },
  };
}
