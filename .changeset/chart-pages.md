---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Scenes hold document values, and a document's pages are one of them.

- core: `scene.doc` holds named JSON values beside the tree (`get`, `set`, `keys`). A `set` is undoable, joins an enclosing `batch`, is skipped when the value is deep-equal, and notifies subscribers. `SerializedScene.doc` carries them, `sceneFromJSON` and `loadState` read them back, and `createScene` and `useScene` take `doc` for the starting values. The field is additive: a snapshot without it loads as before. New types: `SceneDoc`, `SceneDocValues`, `SerializedDoc`.
- core: the page list is the `core:pages` document value (`PAGES_DOC_KEY`, `PagesDoc`, `pagesOf`, `placedPagesOf`). `setPages` replaces it and moves each page's root nodes, with their descendants, by however far their page moved, in one undo entry; `addPage`, `removePage` (which deletes what is on the page and what derives from that), `movePage`, `resizePage`, and `renamePage` are built on it, with `pageMembers` and `nextPageId` beside them. `pageInView` answers the page a view shows most of.
- ui: `PageTabs` is a strip of tabs over any page list, built on `Tabs`: press to go to a page, press twice to rename, drag or Alt+arrow to reorder, + to add, and a right-click reported for a context menu. `useReorderDragList` takes `axis: 'x'` for a row of items, and `TabList` takes a `ref`.
