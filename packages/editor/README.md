# @weasel-js/editor

The glue a weasel editor app needs around its canvas: saving the document as
it changes and restoring it on reload, opening and saving files, a document of
several pages, fitting the view to a page, and the page's paper and grid.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/editor).

## Install

```sh
npm install @weasel-js/editor
```

It runs beside `@weasel-js/core`, `@weasel-js/geom`, `@weasel-js/guides` and
`@weasel-js/ui`, which it takes as peers.

## What is in it

| Area | Exports |
|---|---|
| Session | `useSessionPersistence`, `useAutosave`, `readStored`, `writeSession` |
| Snapshots | `docFromSnapshot`, `nodeSpecsFromSnapshot`, `serializeReplacer`, `reviveTypedArrays` |
| Files | `downloadBlob`, `pickFile`, `describeFileWarnings`, `reportFileWarnings` |
| Pages | `usePages`, `usePageFit`, `usePaperLayer`, `usePageGrid` |
| Text editing | `TextEditDepPublisher` |

A saved snapshot keeps a path's typed arrays tagged (`serializeReplacer`), and
loading reads the tags back, along with the untagged shapes older saves wrote.
