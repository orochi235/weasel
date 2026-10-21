import { useAutosave } from '@editor/index';
import { useMemo, useState } from 'react';
import { DOC_KEY, loadDoc } from './docPersistence';
import type { PaperSizeKey } from './paperSizes';

/**
 * The document's own settings, saved 300 ms after a change under a key apart from the scene's,
 * and whether the document is what the Properties panel shows. `hasSelection` says a scene node
 * is selected, which takes the panel back from the document.
 */
export function useDocumentState(hasSelection: boolean) {
  const [initialDoc] = useState(loadDoc);
  const [paperSize, setPaperSize] = useState<PaperSizeKey>(initialDoc.paperSize);
  const [filename, setFilename] = useState<string>(initialDoc.filename);
  const [backgroundColor, setBackgroundColor] = useState<string>(initialDoc.backgroundColor);
  const [docSelected, setDocSelected] = useState<boolean>(false);

  if (hasSelection && docSelected) setDocSelected(false);

  const doc = useMemo(() => ({ filename, backgroundColor, paperSize }), [filename, backgroundColor, paperSize]);
  useAutosave(() => ({ primary: [DOC_KEY, JSON.stringify(doc)] }), { revision: doc });

  return {
    paperSize, setPaperSize,
    filename, setFilename,
    backgroundColor, setBackgroundColor,
    docSelected, setDocSelected,
  };
}
