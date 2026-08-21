import type { ReactNode } from 'react';
import type { ConfigField } from '../controls/types';
import type { SavedSnapshot } from '../state/types';

/** What a workspace hands its toolbar: which instrument is running, the undo
 *  state and commands, the zoom controls, and the snapshot commands. */
export interface WorkspaceToolbarContext {
  workspaceId: string;
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
  isLastWorkspace: boolean;
}

/** What a workspace hands its sidebar: the instrument's config schema, its
 *  current values, and the setter. */
export interface WorkspaceSidebarContext {
  workspaceId: string;
  instrumentName: string;
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;
}

/** What a workspace hands its status bar. */
export interface WorkspaceStatusBarContext {
  workspaceId: string;
  instrumentName: string;
  zoom: number;
}

/** Replaces a workspace's toolbar. Receives everything the default one uses,
 *  so a custom toolbar need not reach into the store. */
export type ToolbarSlot = (ctx: WorkspaceToolbarContext) => ReactNode;
/** Replaces a workspace's sidebar. */
export type SidebarSlot = (ctx: WorkspaceSidebarContext) => ReactNode;
/** Replaces a workspace's status bar. */
export type StatusBarSlot = (ctx: WorkspaceStatusBarContext) => ReactNode;
