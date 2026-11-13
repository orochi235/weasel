import { ActionDisabledReason, placedPagesOf, useCommand, type PlacedPage } from '@weasel-js/core';
import { useNewCommand, useOpenCommand, useSaveCommand } from '@weasel-js/editor';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { backgroundOf, setBackground } from './docBackground';
import { DEFAULT_BG_COLOR, DEFAULT_FILENAME } from './docPersistence';
import { exportPagePngFile, exportPagesPdfFile } from './exportPage';
import { importSvgFile, openSvgFile, type OpenSvgTarget } from './openSvg';
import { onePage, replacePages } from './pages/drawPages';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_PRESETS, PAPER_SIZES, type PaperSizeKey } from './paperSizes';
import { exportPageSvgFile, saveSvgFile } from './saveSvg';

export const FILE_ACTIONS = {
  new: 'file.new', open: 'file.open', import: 'file.import', save: 'file.save', exportPage: 'file.exportPage',
  exportPng: 'file.exportPng', exportPdf: 'file.exportPdf',
} as const;

/** New, opening onto one row per paper size, in the File menu. A new document is one page, untitled, on white;
 *  undo takes back the page and the background, not the name. */
export const FILE_NEW_MENU: PrefGroup = pref.group(
  'New',
  { sizes: pref.action(FILE_ACTIONS.new) },
  { as: 'menu', description: 'New document' },
);

/** The document the file commands read and write; its background is the scene's. */
export interface FileCommandsTarget extends OpenSvgTarget {
  filename: string;
  /** The shown page's paper size: what New with no size makes while no page is shown. */
  paperSize: PaperSizeKey | null;
  /** The page Export Page writes as SVG or PNG, and whose size New with no size keeps: the one in view, or the last that was. */
  page: PlacedPage | null;
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
  useCommand(FILE_ACTIONS.exportPage, 'Export Page as SVG…', () => {
    const { filename, page } = target;
    if (page !== null) void exportPageSvgFile(scene, page, { filename, backgroundColor: backgroundOf(scene) });
  }, { enabled: () => target.page !== null || ActionDisabledReason.NotApplicable });
  useCommand(FILE_ACTIONS.exportPng, 'Export Page as PNG…', () => {
    const { filename, page } = target;
    if (page !== null) void exportPagePngFile(scene, page, { filename, backgroundColor: backgroundOf(scene) });
  }, { enabled: () => target.page !== null || ActionDisabledReason.NotApplicable });
  useCommand(FILE_ACTIONS.exportPdf, 'Export Pages as PDF…', () => {
    const pages = placedPagesOf(scene);
    if (pages.length > 0) void exportPagesPdfFile(scene, pages, { filename: target.filename, backgroundColor: backgroundOf(scene) });
  }, { enabled: () => placedPagesOf(scene).length > 0 || ActionDisabledReason.NotApplicable });
}
