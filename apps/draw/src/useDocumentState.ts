import { useAutosave, type DocPages } from '@weasel-js/editor';
import { useCallback, useMemo, useState } from 'react';
import { useBackground } from './docBackground';
import { DOC_KEY, docEntry, loadDoc, type PersistedDoc } from './docPersistence';
import type { DrawScene } from './drawDocument';
import { paperSizeOf } from './pages/drawPages';
import { DEFAULT_PAPER_SIZE, PAPER_PRESETS, type PaperSizeKey } from './paperSizes';

/**
 * The document's own settings, and whether the document is what the Properties panel shows. The
 * background is the scene's, so each change to it is an undo entry; the filename is not undone, and
 * is saved 300 ms after a change under a key apart from the scene's. `hasSelection` says a scene node
 * is selected, which takes the panel back from the document. The paper size is the shown page's
 * (`null` for a page of none of draw's sizes, the default with no page shown), and setting it
 * resizes that page and fits the view to it.
 */
export function useDocumentState(scene: DrawScene, pages: DocPages, hasSelection: boolean) {
  const [filename, setFilename] = useState(() => loadDoc().filename);
  const [backgroundColor, setBackgroundColor] = useBackground(scene);
  const [docSelected, setDocSelected] = useState<boolean>(false);

  if (hasSelection && docSelected) setDocSelected(false);

  const doc = useMemo((): PersistedDoc => ({ filename }), [filename]);
  useAutosave(() => ({ primary: [DOC_KEY, docEntry(doc)] }), { revision: doc });

  const { shown } = pages;
  const paperSize = shown ? paperSizeOf(shown) : DEFAULT_PAPER_SIZE;
  const setPaperSize = useCallback((size: PaperSizeKey) => {
    if (shown === null) return;
    pages.resize(shown.id, PAPER_PRESETS[size]);
    pages.goTo(shown.id);
  }, [pages, shown]);

  return {
    paperSize, setPaperSize,
    filename, setFilename,
    backgroundColor, setBackgroundColor,
    docSelected, setDocSelected,
  };
}
