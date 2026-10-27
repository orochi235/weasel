import { useAutosave, type DocPages } from '@editor/index';
import { useCallback, useMemo, useState } from 'react';
import { DOC_KEY, loadDoc } from './docPersistence';
import { paperSizeOf } from './pages/drawPages';
import { DEFAULT_PAPER_SIZE, PAPER_PRESETS, type PaperSizeKey } from './paperSizes';

/**
 * The document's own settings, saved 300 ms after a change under a key apart from the scene's,
 * and whether the document is what the Properties panel shows. `hasSelection` says a scene node
 * is selected, which takes the panel back from the document. The paper size is the shown page's,
 * and setting it resizes that page and fits the view to it.
 */
export function useDocumentState(pages: DocPages, hasSelection: boolean) {
  const [initialDoc] = useState(loadDoc);
  const [filename, setFilename] = useState<string>(initialDoc.filename);
  const [backgroundColor, setBackgroundColor] = useState<string>(initialDoc.backgroundColor);
  const [docSelected, setDocSelected] = useState<boolean>(false);

  if (hasSelection && docSelected) setDocSelected(false);

  const doc = useMemo(() => ({ filename, backgroundColor }), [filename, backgroundColor]);
  useAutosave(() => ({ primary: [DOC_KEY, JSON.stringify(doc)] }), { revision: doc });

  const { shown } = pages;
  const paperSize = (shown && paperSizeOf(shown)) ?? DEFAULT_PAPER_SIZE;
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
