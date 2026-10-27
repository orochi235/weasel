import { useCommand, type PlacedPage } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { importSvgFile, openSvgFile, type OpenSvgTarget } from './openSvg';
import { onePage, replacePages } from './pages/drawPages';
import { isPaperSize, PAPER_PRESETS, PAPER_SIZES, type PaperSizeKey } from './paperSizes';
import { exportPageSvgFile, saveSvgFile, type SavedDoc } from './saveSvg';

export const FILE_ACTIONS = {
  new: 'file.new', open: 'file.open', import: 'file.import', save: 'file.save', exportPage: 'file.exportPage',
} as const;

/** New, opening onto one row per paper size, in the File menu. A new document is one page. */
export const FILE_NEW_MENU: PrefGroup = pref.group(
  'New',
  { sizes: pref.action(FILE_ACTIONS.new) },
  { as: 'menu', description: 'New document' },
);

/** The document the file commands read and write. */
export interface FileCommandsTarget extends OpenSvgTarget, SavedDoc {
  /** The shown page's paper size, which New with no size keeps. */
  paperSize: PaperSizeKey;
  /** The page Export Page writes: the one in view, or the last that was. */
  page: PlacedPage | null;
}

const NEW_VARIANTS = PAPER_SIZES.map(({ key, label }) => ({ key, label, params: { size: key } }));

const SAVE_KEY = { kind: 'key', key: 's', mods: { mod: true } } as const;

/** Register New, Open, Import and Save as actions on the nearest `<ActionsProvider>`. */
export function useFileCommands(target: FileCommandsTarget): void {
  const { scene } = target;
  useCommand(FILE_ACTIONS.new, 'New', (params) => {
    const size = params?.size;
    const paper = PAPER_PRESETS[isPaperSize(size) ? size : target.paperSize];
    // The batch is what names the entry and captures the prior selection.
    scene.batch('New document', () => {
      scene.removeMany([...scene.renderOrder()]);
      replacePages(scene, onePage(paper));
    });
    target.showFirstPage();
  }, { variants: NEW_VARIANTS, tags: ['new', 'document'] });
  useCommand(FILE_ACTIONS.open, 'Open…', () => { void openSvgFile(target); });
  useCommand(FILE_ACTIONS.import, 'Import…', () => { void importSvgFile(scene); });
  useCommand(FILE_ACTIONS.save, 'Save', () => {
    const { filename, backgroundColor } = target;
    void saveSvgFile(scene, { filename, backgroundColor });
  }, { keys: SAVE_KEY });
  useCommand(FILE_ACTIONS.exportPage, 'Export Page as SVG…', () => {
    const { filename, backgroundColor, page } = target;
    if (page !== null) void exportPageSvgFile(scene, page, { filename, backgroundColor });
  });
}
