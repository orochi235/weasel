import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { CssVarReport, ToFrame } from '../../protocol/messages';

type Send = (msg: ToFrame) => void;

/** What trial chrome can reach of the frame its trial shows. */
export interface TrialFrame {
  /** Null while no frame is connected. */
  send: Send | null;
  /** The frame's latest `vars` report. */
  vars: readonly CssVarReport[];
}

/** Each trial's frame, keyed by trial id: `FrameView` connects and reports, trial chrome reads. */
export interface TrialFrames {
  /** Returns a disconnect that does nothing once a newer connection replaced this one. */
  connect(trialId: string, send: Send): () => void;
  report(trialId: string, vars: readonly CssVarReport[]): void;
  get(trialId: string): TrialFrame;
  subscribe(listener: () => void): () => void;
}

const NO_FRAME: TrialFrame = { send: null, vars: [] };

export function createTrialFrames(): TrialFrames {
  const frames = new Map<string, TrialFrame>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    connect(trialId, send) {
      frames.set(trialId, { send, vars: [] });
      changed();
      return () => {
        if (frames.get(trialId)?.send !== send) return;
        frames.delete(trialId);
        changed();
      };
    },
    report(trialId, vars) {
      const frame = frames.get(trialId);
      if (!frame) return;
      frames.set(trialId, { ...frame, vars });
      changed();
    },
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
