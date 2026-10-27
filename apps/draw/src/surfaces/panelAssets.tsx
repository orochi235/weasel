import { useMemo, type ReactNode } from 'react';
import { pref, type PrefLeaf } from '@weasel-js/prefs';
import { BarPopover } from '@weasel-js/ui/components/Bar';
import { DEFAULT_FILENAME } from '../docPersistence';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_OPTIONS, type PaperSizeKey } from '../paperSizes';
import { backgroundHex, DocumentLayers, HistoryEntries, PaletteSwatches, SelectionProperties } from '../sidebarPanels';
import { useSurfaceHost } from './hostContext';
import type { AssetLeafRenderer, SurfaceAsset, SchemaBinding } from './types';

/** An app-defined leaf that brings its own chrome, drawn full width without a label row. */
const blockLeaf = (kind: string, name: string, rest?: Partial<PrefLeaf>): PrefLeaf =>
  ({ kind, name, description: '', default: undefined, block: true, ...rest });

/** Draws a leaf's control in a bar as a button named `label` opening it. */
const inPopover = (label: string, Content: () => ReactNode): AssetLeafRenderer => () => (
  <BarPopover label={label}><Content /></BarPopover>
);

const SELECTION_KIND = 'draw.selection';
const SWATCHES_KIND = 'draw.swatches';
const HISTORY_KIND = 'draw.history';
const LAYERS_KIND = 'draw.layers';

/** The document's fields show while the Layers panel's Background row is picked, the selection's otherwise. The
 *  selection leaf's value is whether it shows. */
const WHILE_DOCUMENT = { showIf: { not: { path: 'selection' } } } as const;

export const PROPERTIES_SCHEMA = pref.group('Properties', {
  file: pref.string('File', '', { placeholder: DEFAULT_FILENAME, ...WHILE_DOCUMENT }),
  paper: pref.enum<PaperSizeKey>('Paper', DEFAULT_PAPER_SIZE, PAPER_OPTIONS, WHILE_DOCUMENT),
  background: pref.color('Background', '#ffffffff', { alpha: true, ...WHILE_DOCUMENT }),
  selection: blockLeaf(SELECTION_KIND, 'Selection', { showIf: { path: 'selection' } }),
});

function usePropertiesBinding(): SchemaBinding {
  const host = useSurfaceHost();
  const { docSelected, filename, paperSize, backgroundColor, setFilename, setPaperSize, setBackgroundColor } = host;
  return useMemo((): SchemaBinding => ({
    title: docSelected ? 'Document' : 'Properties',
    values: { selection: !docSelected, file: filename, paper: paperSize, background: backgroundHex(backgroundColor) },
    onChange: (path, value) => {
      if (path === 'file' && typeof value === 'string') setFilename(value);
      else if (path === 'paper' && isPaperSize(value)) setPaperSize(value);
      else if (path === 'background' && typeof value === 'string') setBackgroundColor(value);
    },
  }), [docSelected, filename, paperSize, backgroundColor, setFilename, setPaperSize, setBackgroundColor]);
}

const COLORS_SCHEMA = pref.group('Colors', { palette: blockLeaf(SWATCHES_KIND, 'Colors') });
const LAYERS_SCHEMA = pref.group('Layers', { layers: blockLeaf(LAYERS_KIND, 'Layers') });
const HISTORY_SCHEMA = pref.group('History', { entries: blockLeaf(HISTORY_KIND, 'History') });

/**
 * The right sidebar's own assets. Properties stays a panel: the selection's editor needs the sidebar's width. Colors,
 * Layers, and History can also be a toolbar button opening what the panel shows.
 */
export const PANEL_ASSETS: readonly SurfaceAsset[] = [
  {
    id: 'properties', label: 'Properties', schema: PROPERTIES_SCHEMA, useBinding: usePropertiesBinding,
    surfaces: ['panel'], defaultSurface: 'panel',
    renderers: { panel: { [SELECTION_KIND]: () => <SelectionProperties /> } },
  },
  {
    id: 'colors', label: 'Colors', schema: COLORS_SCHEMA, surfaces: ['panel', 'bar'], defaultSurface: 'panel',
    renderers: { panel: { [SWATCHES_KIND]: () => <PaletteSwatches /> }, bar: { [SWATCHES_KIND]: inPopover('Colors', PaletteSwatches) } },
  },
  {
    id: 'layers', label: 'Layers', schema: LAYERS_SCHEMA, surfaces: ['panel', 'bar'], defaultSurface: 'panel',
    renderers: { panel: { [LAYERS_KIND]: () => <DocumentLayers /> }, bar: { [LAYERS_KIND]: inPopover('Layers', DocumentLayers) } },
  },
  {
    id: 'history', label: 'History', schema: HISTORY_SCHEMA, surfaces: ['panel', 'bar'], defaultSurface: 'panel',
    renderers: { panel: { [HISTORY_KIND]: () => <HistoryEntries /> }, bar: { [HISTORY_KIND]: inPopover('History', HistoryEntries) } },
  },
];
