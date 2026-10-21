import { createContext } from 'react';
import type { ForgeComparison, ResolveContext } from './conditions';
import type { TrialHit } from './trialAt';

/** One Live lens cell's ask of the trial under its reticle: render a copy into `slot`, magnified about `hit.local`. */
export interface LiveRequest {
  /** The lens's id; a cell showing a comparison adds `~compared`, so a Split lens's two cells are two requests. */
  lensId: string;
  slot: HTMLElement;
  hit: TrialHit;
  factor: number;
  /** The slot's size, in CSS px. */
  size: { width: number; height: number };
  /** What the copy compares against, resolved over the trial's own globals, pins included; null shows the story
   *  as it is. */
  compare: ForgeComparison | null;
  ctx: ResolveContext;
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
