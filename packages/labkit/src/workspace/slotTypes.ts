import type { ReactNode } from 'react';
import type { ConfigField } from '../instrument/types';
import type { SavedSnapshot } from '../state/types';

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

export interface WorkspaceSidebarContext {
  workspaceId: string;
  instrumentName: string;
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;
}

export interface WorkspaceStatusBarContext {
  workspaceId: string;
  instrumentName: string;
  zoom: number;
}

export type ToolbarSlot = (ctx: WorkspaceToolbarContext) => ReactNode;
export type SidebarSlot = (ctx: WorkspaceSidebarContext) => ReactNode;
export type StatusBarSlot = (ctx: WorkspaceStatusBarContext) => ReactNode;
