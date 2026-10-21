import { createContext } from 'react';
import type { Globals } from '../../protocol/messages';
import type { TrialHit } from './trialAt';

/** One Live lens's ask of the trial under its reticle: render a copy into `slot`, magnified about `hit.local`. */
export interface LiveRequest {
  lensId: string;
  slot: HTMLElement;
  hit: TrialHit;
  factor: number;
  /** The slot's size, in CSS px. */
  size: { width: number; height: number };
  /** The globals the comparison sets, laid over the trial's own; null when the lens shows the story as it is. */
  globals: Globals | null;
  /** Config values written over the trial's at their paths. */
  args: Readonly<Record<string, unknown>>;
}

/** The Live requests standing, by lens, read by each trial for the copies it owes. */
export interface LiveLenses {
  /** `null` withdraws the lens's request. */
  set(lensId: string, request: LiveRequest | null): void;
  /** The same array until a request changes. */
  forTrial(trialId: string): readonly LiveRequest[];
  subscribe(listener: () => void): () => void;
}

const NONE: readonly LiveRequest[] = [];

export function createLiveLenses(): LiveLenses {
  const requests = new Map<string, LiveRequest>();
  const listeners = new Set<() => void>();
  let byTrial = new Map<string, readonly LiveRequest[]>();
  return {
    set(lensId, request) {
      if (request === null) {
        if (!requests.delete(lensId)) return;
      } else requests.set(lensId, request);
      byTrial = new Map();
      for (const listener of [...listeners]) listener();
    },
    forTrial(trialId) {
      let found = byTrial.get(trialId);
      if (!found) {
        const mine = [...requests.values()].filter((r) => r.hit.trialId === trialId);
        found = mine.length === 0 ? NONE : mine;
        byTrial.set(trialId, found);
      }
      return found;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The workshop's Live requests; null outside a workshop, where no trial renders copies. */
export const LiveLensesContext = createContext<LiveLenses | null>(null);
