import type { Measurements, SelectionApi } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
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
}

export type SurfacesValue = Record<string, SurfaceState>;

/** What a panel's title row binds: its hidden and collapsed state. */
export interface PanelChrome {
  hidden: boolean;
  collapsed: boolean;
  onToggleCollapse(): void;
  onHide(): void;
}

/** What the right sidebar hands a panel drawn by code rather than from a schema. */
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
}

interface AssetBase {
  id: string;
  label: string;
  /** The surfaces it may be drawn on, in the order a switch offers them. */
  surfaces: readonly SurfaceKind[];
  defaultSurface: SurfaceKind;
}

/** What a host binds a schema asset's leaves to, by dotted path within the asset's schema. Each surface reads and
 *  writes the same paths. */
export interface SchemaBinding {
  values?: Readonly<Record<string, unknown>>;
  onChange?: (path: string, value: unknown) => void;
}

/** An asset drawn from a prefs schema, on any surface it allows. */
export interface SchemaAsset extends AssetBase {
  schema: PrefGroup;
  /** A hook binding the schema's value leaves to state the asset shows. Unset for an asset of actions alone. Called
   *  by whichever surface draws the asset, so every surface shows the same state. */
  useBinding?: () => SchemaBinding;
  render?: never;
}

/** A panel drawn by its own code, which owns its `SidebarPanel`. */
export interface RenderAsset extends AssetBase {
  render: (host: SidebarHost, chrome: PanelChrome) => ReactNode;
  schema?: never;
}

export type SurfaceAsset = SchemaAsset | RenderAsset;

export const isSchemaAsset = (asset: SurfaceAsset): asset is SchemaAsset => asset.schema !== undefined;
