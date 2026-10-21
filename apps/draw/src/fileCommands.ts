import { useCommand } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { importSvgFile, openSvgFile, type OpenSvgTarget } from './openSvg';
import { isPaperSize, PAPER_SIZES } from './paperSizes';
import { saveSvgFile, type SavedDoc } from './saveSvg';

export const FILE_ACTIONS = { new: 'file.new', open: 'file.open', import: 'file.import', save: 'file.save' } as const;

/** New, opening onto one row per paper size, in the File menu. */
export const FILE_NEW_MENU: PrefGroup = pref.group(
  'New',
  { sizes: pref.action(FILE_ACTIONS.new) },
  { as: 'menu', description: 'New document' },
);

/** The document the file commands read and write. */
export interface FileCommandsTarget extends OpenSvgTarget, SavedDoc {}

const NEW_VARIANTS = PAPER_SIZES.map(({ key, label }) => ({ key, label, params: { size: key } }));

const SAVE_KEY = { kind: 'key', key: 's', mods: { mod: true } } as const;

/** Register New, Open, Import and Save as actions on the nearest `<ActionsProvider>`. */
export function useFileCommands(target: FileCommandsTarget): void {
  const { scene } = target;
  useCommand(FILE_ACTIONS.new, 'New', (params) => {
    const size = params?.size;
    if (isPaperSize(size)) target.setPaperSize(size);
    // The batch is what names the entry and captures the prior selection.
    scene.batch('New document', () => {
      scene.removeMany([...scene.renderOrder()]);
    });
  }, { variants: NEW_VARIANTS, tags: ['new', 'document'] });
  useCommand(FILE_ACTIONS.open, 'Open…', () => { void openSvgFile(target); });
  useCommand(FILE_ACTIONS.import, 'Import…', () => { void importSvgFile(scene); });
  useCommand(FILE_ACTIONS.save, 'Save', () => {
    const { filename, paperSize, backgroundColor } = target;
    void saveSvgFile(scene, { filename, paperSize, backgroundColor });
  }, { keys: SAVE_KEY });
}
