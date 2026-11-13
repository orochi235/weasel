import { useSyncExternalStore } from 'react';
import {
  ActionDisabledReason, exportFormatRegistry, exportFormats, placedPagesOf, useCommand, type ExportFormat, type PlacedPage,
} from '@weasel-js/core';
import { useNewCommand, useOpenCommand, useSaveCommand } from '@weasel-js/editor';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { backgroundOf, setBackground } from './docBackground';
import { DEFAULT_BG_COLOR, DEFAULT_FILENAME } from './docPersistence';
import { exportPagesFile, exportSelectionFile } from './exportPage';
import { importSvgFile, openSvgFile, type OpenSvgTarget } from './openSvg';
import { onePage, replacePages } from './pages/drawPages';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_PRESETS, PAPER_SIZES, type PaperSizeKey } from './paperSizes';
import { saveSvgFile } from './saveSvg';

export const FILE_ACTIONS = {
  new: 'file.new', open: 'file.open', import: 'file.import', save: 'file.save', exportPage: 'file.exportPage',
  exportSelection: 'file.exportSelection',
} as const;

/** New, opening onto one row per paper size, in the File menu. A new document is one page, untitled, on white;
 *  undo takes back the page and the background, not the name. */
export const FILE_NEW_MENU: PrefGroup = pref.group(
  'New',
  { sizes: pref.action(FILE_ACTIONS.new) },
  { as: 'menu', description: 'New document' },
);

/** Export, opening onto a row per registered format for the page in view (every page, for a format that holds
 *  several), then a row per format for the selection. */
export const FILE_EXPORT_MENU: PrefGroup = pref.group(
  'Export',
  { pages: pref.action(FILE_ACTIONS.exportPage), selection: pref.action(FILE_ACTIONS.exportSelection) },
  { as: 'menu', description: 'Export to a file' },
);

/** The document the file commands read and write; its background is the scene's. */
export interface FileCommandsTarget extends OpenSvgTarget {
  filename: string;
  /** The shown page's paper size: what New with no size makes while no page is shown. */
  paperSize: PaperSizeKey | null;
  /** The page Export writes in a single-page format, and whose size New with no size keeps: the one in view, or the last that was. */
  page: PlacedPage | null;
  /** What Export Selection writes. Absent, nothing is selected. */
  selection?: { get(): readonly string[] };
}

const NEW_VARIANTS = PAPER_SIZES.map(({ key, label }) => ({ key, label, params: { size: key } }));

/** Register New, Open, Import, Save and the page exports as actions on the nearest `<ActionsProvider>`. */
export function useFileCommands(target: FileCommandsTarget): void {
  const { scene } = target;
  useNewCommand(FILE_ACTIONS.new, 'New', (params) => {
    const size = params?.size;
    const { page } = target;
    const paper = isPaperSize(size) ? PAPER_PRESETS[size]
      : page ? { width: page.width, height: page.height } : PAPER_PRESETS[target.paperSize ?? DEFAULT_PAPER_SIZE];
    target.leaveMode();
    // The batch is what names the entry and captures the prior selection.
    scene.batch('New document', () => {
      replacePages(scene, onePage(paper));
      setBackground(scene, DEFAULT_BG_COLOR);
    });
    target.setFilename(DEFAULT_FILENAME);
    target.showFirstPage();
  }, { variants: NEW_VARIANTS, tags: ['new', 'document'] });
  useOpenCommand(FILE_ACTIONS.open, 'Open…', () => { void openSvgFile(target); });
  useCommand(FILE_ACTIONS.import, 'Import…', () => { void importSvgFile(scene); });
  useSaveCommand(FILE_ACTIONS.save, 'Save', () => {
    void saveSvgFile(scene, { filename: target.filename, backgroundColor: backgroundOf(scene) });
  });
  useExportCommands(target);
}

const formatOf = (params?: Readonly<Record<string, unknown>>): ExportFormat | undefined =>
  exportFormats().find((f) => f.id === params?.format);

/** Export (a variant per registered format) and Export Selection (the same), as actions. */
function useExportCommands(target: FileCommandsTarget): void {
  const { scene } = target;
  const formats = useSyncExternalStore(exportFormatRegistry.subscribe, exportFormats);
  const doc = () => ({ filename: target.filename, backgroundColor: backgroundOf(scene) });
  const pagesFor = (format: ExportFormat): readonly PlacedPage[] =>
    format.multiRegion ? placedPagesOf(scene) : target.page === null ? [] : [target.page];
  const selected = () => target.selection?.get() ?? [];

  useCommand(FILE_ACTIONS.exportPage, 'Export', (params) => {
    const format = formatOf(params);
    const pages = format ? pagesFor(format) : [];
    if (format && pages.length > 0) void exportPagesFile(scene, format, pages, doc());
  }, {
    variants: formats.map((f) => ({ key: f.id, label: `${f.multiRegion ? 'Pages' : 'Page'} as ${f.label}…`, params: { format: f.id } })),
    enabled: (params) => {
      const format = formatOf(params);
      return (format !== undefined && pagesFor(format).length > 0) || ActionDisabledReason.NotApplicable;
    },
  });
  useCommand(FILE_ACTIONS.exportSelection, 'Export Selection', (params) => {
    const format = formatOf(params);
    const ids = selected();
    if (format && ids.length > 0) void exportSelectionFile(scene, format, ids, doc());
  }, {
    variants: formats.map((f) => ({ key: f.id, label: `Selection as ${f.label}…`, params: { format: f.id } })),
    enabled: () => selected().length > 0 || ActionDisabledReason.SelectionRequired,
  });
}
