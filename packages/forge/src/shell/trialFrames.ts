import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { A11yReport, CssVarReport, ToFrame } from '../protocol/messages';

type Send = (msg: ToFrame) => void;

/** What an axe run in the frame came back with. */
export type A11yOutcome = { ok: true; report: A11yReport } | { ok: false; message: string };

/** The half of a trial's frame that answers a request: each call is one round trip over the frame's channel. */
export interface TrialFrameCalls {
  send: Send;
  audit: () => Promise<A11yOutcome>;
}

/** What trial chrome can reach of the frame its trial shows. */
export interface TrialFrame {
  /** Null while no frame is connected. */
  send: Send | null;
  /** The frame's latest `vars` report. */
  vars: readonly CssVarReport[];
  /** Runs axe over the story and records the answer as `a11y`. Null while no frame is connected. */
  audit: (() => Promise<A11yOutcome>) | null;
  /** What the last audit found; null until one has run against the connected frame. */
  a11y: A11yOutcome | null;
}

/** Each trial's frame, keyed by trial id: `FrameView` connects and reports, trial chrome reads. */
export interface TrialFrames {
  /** Returns a disconnect that does nothing once a newer connection replaced this one. */
  connect(trialId: string, calls: TrialFrameCalls): () => void;
  report(trialId: string, vars: readonly CssVarReport[]): void;
  reportA11y(trialId: string, outcome: A11yOutcome): void;
  get(trialId: string): TrialFrame;
  subscribe(listener: () => void): () => void;
}

const NO_FRAME: TrialFrame = { send: null, vars: [], audit: null, a11y: null };

export function createTrialFrames(): TrialFrames {
  const frames = new Map<string, TrialFrame>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  const patch = (trialId: string, next: Partial<TrialFrame>) => {
    const frame = frames.get(trialId);
    if (!frame) return;
    frames.set(trialId, { ...frame, ...next });
    changed();
  };
  return {
    connect(trialId, calls) {
      frames.set(trialId, { send: calls.send, vars: [], audit: calls.audit, a11y: null });
      changed();
      return () => {
        if (frames.get(trialId)?.send !== calls.send) return;
        frames.delete(trialId);
        changed();
      };
    },
    report: (trialId, vars) => patch(trialId, { vars }),
    reportA11y: (trialId, a11y) => patch(trialId, { a11y }),
    get: (trialId) => frames.get(trialId) ?? NO_FRAME,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const TrialFramesContext = createContext<TrialFrames | null>(null);

/** The frame of the trial `trialId` names, re-read when it connects or reports. */
export function useTrialFrame(trialId: string): TrialFrame {
  const frames = useContext(TrialFramesContext);
  const subscribe = useCallback((listener: () => void) => frames?.subscribe(listener) ?? (() => {}), [frames]);
  const read = () => frames?.get(trialId) ?? NO_FRAME;
  return useSyncExternalStore(subscribe, read, read);
}
