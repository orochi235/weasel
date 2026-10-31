---
'@weasel-js/editor': patch
---

New package: the session, file and page glue weasel's editor apps share, published as `@weasel-js/editor`. It saves a document as it changes and restores it on reload (`useSessionPersistence`, `useAutosave`), revives snapshots (`docFromSnapshot`, `nodeSpecsFromSnapshot`), opens and saves files (`downloadBlob`, `pickFile`), and runs a document's pages, their fit, paper and grid (`usePages`, `usePageFit`, `usePaperLayer`, `usePageGrid`).
