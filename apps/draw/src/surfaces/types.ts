import type { Measurements, SelectionApi } from '@weasel-js/core';
import type { CornerControlsSelection } from '@weasel-js/path-tools';
import type { PrefGroup, PrefOrder } from '@weasel-js/prefs';
import type { ReactNode } from 'react';
import type { DrawScene } from '../drawDocument';
import type { PaperSizeKey } from '../paperSizes';

/** Where an asset is drawn: a labeled bar in the command strip, a panel in the right sidebar, or a menu button in
 *  the command strip. */
export type SurfaceKind = 'bar' | 'panel' | 'menu';

/** One asset's persisted chrome: the surface chosen for it, and its panel's hidden and collapsed flags. */
export interface SurfaceState {
  surface?: SurfaceKind;
  hidden?: boolean;
  collapsed?: boolean;
  /** The order of the asset's items and groups, keyed by container path, as `orderPrefGroup` reads it. */
  order?: PrefOrder;
}

export type SurfacesValue = Record<string, SurfaceState>;

/** What a panel's title row binds: its hidden and collapsed state. */
export interface PanelChrome {
  hidden: boolean;
  collapsed: boolean;
  onToggleCollapse(): void;
  onHide(): void;
}

/** The editor state an asset's leaves read, on whichever surface draws them (`SurfaceHostContext`). */
export interface SidebarHost {
  scene: DrawScene;
  selection: SelectionApi;
  measurements: Measurements;
  filename: string;
  setFilename: (v: string) => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  paperSize: PaperSizeKey;
  setPaperSize: (v: PaperSizeKey) => void;
  docSelected: boolean;
  setDocSelected: (v: boolean) => void;
  /** The path open in path edit and its selected anchors, for Corner shape. */
  cornerSelection: CornerControlsSelection;
  /** What Simplify refits at, and the Simplify brush with it. */
  simplifyTolerance: number;
  setSimplifyTolerance: (v: number) => void;
}

/** What a host binds an asset's leaves to, by dotted path within the asset's schema. Each surface reads and writes
 *  the same paths. */
export interface SchemaBinding {
  values?: Readonly<Record<string, unknown>>;
  onChange?: (path: string, value: unknown) => void;
  /** The panel's title while bound to this state, where it is not the asset's label. */
  title?: string;
}

/** Draws one of a schema's app-defined leaves. It takes nothing: what it shows comes from hooks, so it reads the same
 *  state on every surface. */
export type AssetLeafRenderer = () => ReactNode;

/** Controls for a schema's app-defined kinds, by kind, for each surface that draws them differently. */
export interface AssetRenderers {
  panel?: Readonly<Record<string, AssetLeafRenderer>>;
  bar?: Readonly<Record<string, AssetLeafRenderer>>;
}

/** Something WeaselDraw can show as a toolbar, a panel, or a menu, drawn from a prefs schema on any surface it
 *  allows. */
export interface SurfaceAsset {
  id: string;
  label: string;
  schema: PrefGroup;
  /** The surfaces it may be drawn on, in the order a switch offers them. A menu draws no app-defined leaf, so an
   *  asset with one does not allow `'menu'`, nor `'bar'` without a `bar` renderer for it. */
  surfaces: readonly SurfaceKind[];
  defaultSurface: SurfaceKind;
  /** Where its bar and menu sit: the toolbar dock under the command row, or a fixed slot in the command row itself,
   *  drawn as the row's other buttons are. Default: the dock. */
  row?: 'dock' | 'command';
  /** A hook binding the schema's value leaves to state the asset shows. Unset for an asset of actions alone. Called
   *  by whichever surface draws the asset, so every surface shows the same state. */
  useBinding?: () => SchemaBinding;
  /** How the schema's app-defined leaves draw. */
  renderers?: AssetRenderers;
}
