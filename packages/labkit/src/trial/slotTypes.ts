import type { ReactNode } from 'react';
import type { ConfigField } from '../controls/types';
import type { SavedSnapshot } from '../state/types';

/** What a trial hands its toolbar: which instrument is running, the undo
 *  state and commands, the zoom controls, and the snapshot commands. */
export interface TrialToolbarContext {
  trialId: string;
  instrumentName: string;
  hasUndo: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  hasCanvas: boolean;
  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (name?: string) => void;
  loadSnapshot: (snapshotId: string) => void;
  clone: () => void;
  reset: () => void;
  close: () => void;
  isLastTrial: boolean;
}

/** What a trial hands its sidebar: the instrument's config schema, its
 *  current values, and the setter. */
export interface TrialSidebarContext {
  trialId: string;
  instrumentName: string;
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;
}

/** What a trial hands its status bar. */
export interface TrialStatusBarContext {
  trialId: string;
  instrumentName: string;
  /** Null when the trial holds a view that is not the 2D one. */
  zoom: number | null;
}

/** Replaces a trial's toolbar. Receives everything the default one uses,
 *  so a custom toolbar need not reach into the store. */
export type ToolbarSlot = (ctx: TrialToolbarContext) => ReactNode;
/** Replaces a trial's sidebar. */
export type SidebarSlot = (ctx: TrialSidebarContext) => ReactNode;
/** Replaces a trial's status bar. */
export type StatusBarSlot = (ctx: TrialStatusBarContext) => ReactNode;
