/** Declares the `recording` dep the Record and Play actions read. `recordingContribution` publishes its source. */
import '@weasel-js/core';
import type { RecordingSession } from './session';

declare module '@weasel-js/core' {
  interface DepSchema {
    recording?: RecordingSession;
  }
}

export {};

// An augmentation that stops merging still compiles; this says the key landed.
const _merged: import('@weasel-js/core').DepName = 'recording';
void _merged;
