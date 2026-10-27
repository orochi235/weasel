import type { ReactNode } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { BarPopover } from '@weasel-js/ui/components/Bar';
import type { AssetLeafRenderer } from './types';

/** An app-defined leaf, drawn by its asset's renderers. A form gives it a row labeled `name`. */
export const appLeaf = (kind: string, name: string, rest?: Partial<PrefLeaf>): PrefLeaf =>
  ({ kind, name, description: '', default: undefined, ...rest });

/** An app-defined leaf that brings its own chrome, drawn full width without a label row. */
export const blockLeaf = (kind: string, name: string, rest?: Partial<PrefLeaf>): PrefLeaf =>
  appLeaf(kind, name, { block: true, ...rest });

/** Draws a leaf's control in a bar as a button named `label` opening it. */
export const inPopover = (label: string, Content: () => ReactNode): AssetLeafRenderer => () => (
  <BarPopover label={label}><Content /></BarPopover>
);
