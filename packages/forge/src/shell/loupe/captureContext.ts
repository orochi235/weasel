import { createEmitter } from '@weasel-js/registry';
import { createContext } from 'react';
import type { Layout } from '../../protocol/messages';
import type { IndexEntry } from '../../story/types';
import type { CssOverrides } from '../cssVars/overrides';

/** A count of story edits since the workshop loaded: a capture taken at an older one shows a story that is gone. */
export interface Revision {
  get(): number;
  subscribe(listener: () => void): () => void;
}

export function createRevision(): Revision & { bump(): void } {
  let n = 0;
  const bumped = createEmitter<[]>();
  return {
    get: () => n,
    subscribe: bumped.subscribe,
    bump() {
      n += 1;
      bumped.emit();
    },
  };
}

/** What a trial renders its story from, as a capture of it needs them. */
export interface TrialInputs {
  entry: Pick<IndexEntry, 'id' | 'isolate'>;
  layout: Layout;
  /** The trial's whole config, forge's `$` keys included. */
  config: unknown;
  state: unknown;
  overrides: CssOverrides;
}

/** Each story trial's inputs, by trial id, published by the trial and read by a Pixels lens over it. */
export interface CaptureTrials {
  /** Returns the withdrawal, which leaves a later publish for the same trial standing. */
  publish(trialId: string, inputs: TrialInputs): () => void;
  get(trialId: string): TrialInputs | null;
  subscribe(listener: () => void): () => void;
}

export function createCaptureTrials(): CaptureTrials {
  const trials = new Map<string, TrialInputs>();
  const changed = createEmitter<[]>();
  return {
    publish(trialId, inputs) {
      trials.set(trialId, inputs);
      changed.emit();
      return () => {
        if (trials.get(trialId) !== inputs) return;
        trials.delete(trialId);
        changed.emit();
      };
    },
    get: (trialId) => trials.get(trialId) ?? null,
    subscribe: changed.subscribe,
  };
}

/** Where a Pixels lens asks for captures, and what it captures from; null where no dev server takes captures. */
export interface LoupeCapture {
  /** The dev server's base, under which its capture endpoint answers. */
  base: string;
  trials: CaptureTrials;
  revision: Revision;
}

export const LoupeCaptureContext = createContext<LoupeCapture | null>(null);
